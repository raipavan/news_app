const VIEW_DEDUP_WINDOW_MS = 30 * 60 * 1000;
const DEFAULT_FLUSH_INTERVAL_MS = 60 * 1000;
const RETRY_INTERVAL_MS = 60 * 1000;
const DRAIN_INTERVAL_MS = 5 * 1000;
const MAX_BATCH_SIZE = 1000;
const MAX_BACKLOG_ROWS = 10000;

const VIEW_ROUTE_RE = /^\/api\/v1\/articles\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/view$/i;
const IMPRESSION_ROUTE_RE = /^\/api\/v1\/public\/ads\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/impression$/i;

/** Compute SHA-256 visitor hash matching backend/src/utils/tokens.js (40 hex chars). */
export async function hashVisitor(value) {
  const bytes = new TextEncoder().encode(String(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 40);
}

/** Deterministically shard entity IDs across N Durable Objects to avoid single-DO bottlenecks. */
export function shardNameFor(entityId, shardCount = 4) {
  const count = Math.max(Number(shardCount) || 1, 1);
  let hash = 2166136261;
  const str = String(entityId || '');
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `shard-${(hash >>> 0) % count}`;
}

function getDoStub(namespace, shardName) {
  if (typeof namespace.getByName === 'function') {
    return namespace.getByName(shardName);
  }
  const id = namespace.idFromName(shardName);
  return namespace.get(id);
}

/** Core SQLite-backed Durable Object logic, isolated from cloudflare:workers for testability. */
export class AnalyticsBufferCore {
  constructor(ctx, env, deps = {}) {
    this.ctx = ctx;
    this.env = env || {};
    this.fetchImpl = deps.fetchImpl || globalThis.fetch;

    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS pending_views (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          article_id TEXT NOT NULL,
          visitor_hash TEXT NOT NULL,
          viewed_at TEXT NOT NULL,
          is_unique INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS view_dedup (
          article_id TEXT NOT NULL,
          visitor_hash TEXT NOT NULL,
          seen_at INTEGER NOT NULL,
          PRIMARY KEY (article_id, visitor_hash)
        );
        CREATE TABLE IF NOT EXISTS pending_impressions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          ad_id TEXT NOT NULL,
          visitor_hash TEXT,
          viewed_at TEXT NOT NULL
        );
      `);
    });
  }

  async scheduleFlushIfNeeded(nowMs = Date.now(), delayOverrideMs = null) {
    const delayMs =
      delayOverrideMs !== null
        ? delayOverrideMs
        : Math.max(Number(this.env.FLUSH_INTERVAL_MS) || DEFAULT_FLUSH_INTERVAL_MS, 1000);
    const existing = await this.ctx.storage.getAlarm();
    if (existing === null || existing === undefined) {
      await this.ctx.storage.setAlarm(nowMs + delayMs);
    }
  }

  enforceBacklogCap() {
    this.ctx.storage.sql.exec(
      `DELETE FROM pending_views
        WHERE id IN (
          SELECT id FROM pending_views
           ORDER BY id DESC
           LIMIT -1 OFFSET ?
        )`,
      MAX_BACKLOG_ROWS
    );
    this.ctx.storage.sql.exec(
      `DELETE FROM pending_impressions
        WHERE id IN (
          SELECT id FROM pending_impressions
           ORDER BY id DESC
           LIMIT -1 OFFSET ?
        )`,
      MAX_BACKLOG_ROWS
    );
  }

  async recordView(articleId, visitorHash, nowMs = Date.now()) {
    const cutoff = nowMs - VIEW_DEDUP_WINDOW_MS;
    const existing = this.ctx.storage.sql
      .exec(
        'SELECT seen_at FROM view_dedup WHERE article_id = ? AND visitor_hash = ?',
        articleId,
        visitorHash
      )
      .toArray()[0];

    const isRecent = Boolean(existing && existing.seen_at > cutoff);

    this.ctx.storage.sql.exec(
      `INSERT INTO view_dedup (article_id, visitor_hash, seen_at)
       VALUES (?, ?, ?)
       ON CONFLICT(article_id, visitor_hash) DO UPDATE SET seen_at = excluded.seen_at`,
      articleId,
      visitorHash,
      nowMs
    );

    this.ctx.storage.sql.exec(
      `INSERT INTO pending_views (article_id, visitor_hash, viewed_at, is_unique)
       VALUES (?, ?, ?, ?)`,
      articleId,
      visitorHash,
      new Date(nowMs).toISOString(),
      isRecent ? 0 : 1
    );

    await this.scheduleFlushIfNeeded(nowMs);
    return { buffered: true, counted: !isRecent };
  }

  async recordImpression(adId, visitorHash = null, nowMs = Date.now()) {
    this.ctx.storage.sql.exec(
      `INSERT INTO pending_impressions (ad_id, visitor_hash, viewed_at)
       VALUES (?, ?, ?)`,
      adId,
      visitorHash || null,
      new Date(nowMs).toISOString()
    );

    await this.scheduleFlushIfNeeded(nowMs);
    return { buffered: true };
  }

  async alarm(nowMs = Date.now()) {
    this.ctx.storage.sql.exec('DELETE FROM view_dedup WHERE seen_at < ?', nowMs - VIEW_DEDUP_WINDOW_MS);
    this.enforceBacklogCap();

    const views = this.ctx.storage.sql
      .exec(
        'SELECT id, article_id, visitor_hash, viewed_at, is_unique FROM pending_views ORDER BY id ASC LIMIT ?',
        MAX_BATCH_SIZE
      )
      .toArray();
    const impressions = this.ctx.storage.sql
      .exec(
        'SELECT id, ad_id, visitor_hash, viewed_at FROM pending_impressions ORDER BY id ASC LIMIT ?',
        MAX_BATCH_SIZE
      )
      .toArray();

    if (!views.length && !impressions.length) {
      return { flushed: false, reason: 'empty' };
    }

    const originBase = String(this.env.ORIGIN_BASE_URL || '').replace(/\/$/, '');
    const secret = String(this.env.INTERNAL_FLUSH_SECRET || '');
    if (!originBase || !secret) {
      console.warn('[analytics-buffer] ORIGIN_BASE_URL or INTERNAL_FLUSH_SECRET not configured');
      return { flushed: false, reason: 'unconfigured' };
    }

    const maxViewId = views.length ? views[views.length - 1].id : 0;
    const maxImpId = impressions.length ? impressions[impressions.length - 1].id : 0;

    try {
      const res = await this.fetchImpl(`${originBase}/api/v1/internal/analytics/flush`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': secret,
        },
        body: JSON.stringify({
          views: views.map((v) => ({
            articleId: v.article_id,
            visitorHash: v.visitor_hash,
            viewedAt: v.viewed_at,
            unique: v.is_unique === 1,
          })),
          impressions: impressions.map((imp) => ({
            adId: imp.ad_id,
            visitorHash: imp.visitor_hash,
            viewedAt: imp.viewed_at,
          })),
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.warn(`[analytics-buffer] origin flush failed (${res.status}): ${text}`);
        await this.ctx.storage.setAlarm(Date.now() + RETRY_INTERVAL_MS);
        return { flushed: false, status: res.status };
      }

      if (maxViewId > 0) {
        this.ctx.storage.sql.exec('DELETE FROM pending_views WHERE id <= ?', maxViewId);
      }
      if (maxImpId > 0) {
        this.ctx.storage.sql.exec('DELETE FROM pending_impressions WHERE id <= ?', maxImpId);
      }

      const remainingRow = this.ctx.storage.sql
        .exec(
          'SELECT (SELECT COUNT(*) FROM pending_views) + (SELECT COUNT(*) FROM pending_impressions) AS total'
        )
        .toArray()[0];
      const remaining = Number(remainingRow?.total || 0);
      if (remaining > 0) {
        await this.ctx.storage.setAlarm(Date.now() + DRAIN_INTERVAL_MS);
      }

      return {
        flushed: true,
        views: views.length,
        impressions: impressions.length,
        remaining,
      };
    } catch (err) {
      console.warn(`[analytics-buffer] origin flush error: ${err.message}`);
      await this.ctx.storage.setAlarm(Date.now() + RETRY_INTERVAL_MS);
      return { flushed: false, error: err.message };
    }
  }
}

/** Edge fetch handler scoped strictly to article views and ad impressions; fails open to origin. */
export async function handleAnalyticsRequest(request, env, fallbackFetch = globalThis.fetch) {
  if (request.method !== 'POST' || !env?.ANALYTICS_BUFFER) {
    return fallbackFetch(request);
  }

  const url = new URL(request.url);
  const viewMatch = url.pathname.match(VIEW_ROUTE_RE);
  const impMatch = viewMatch ? null : url.pathname.match(IMPRESSION_ROUTE_RE);

  if (!viewMatch && !impMatch) {
    return fallbackFetch(request);
  }

  let body = {};
  try {
    body = await request.clone().json();
  } catch {
    body = {};
  }

  const shardCount = Number(env.SHARD_COUNT) || 4;

  try {
    if (viewMatch) {
      const articleId = viewMatch[1];
      const rawVisitor =
        body?.visitor_id || request.headers.get('cf-connecting-ip') || 'anonymous';
      const visitorHash = await hashVisitor(rawVisitor);
      const stub = getDoStub(env.ANALYTICS_BUFFER, shardNameFor(articleId, shardCount));
      const result = await stub.recordView(articleId, visitorHash);
      return Response.json(result, {
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    const adId = impMatch[1];
    const visitorId = body?.visitor_id ? String(body.visitor_id).slice(0, 120) : null;
    const stub = getDoStub(env.ANALYTICS_BUFFER, shardNameFor(adId, shardCount));
    await stub.recordImpression(adId, visitorId);
    return new Response(null, {
      status: 204,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    console.warn(`[analytics-buffer] edge fallback to origin: ${err.message}`);
    return fallbackFetch(request);
  }
}
