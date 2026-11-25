const env = require('../config/env');
const { query } = require('../db');
const { audit } = require('../utils/audit');
const { ApiError } = require('../utils/errors');
const r2Storage = require('./r2Storage');
const cloudflareCache = require('./cloudflareCache');
const { extractInlineImageIds } = require('./imageService');

const SETTINGS_KEY = 'cloudflare_storage_flush';
const VALID_MODES = ['older_than_30d', 'all_news', 'orphans_only', 'cache_only'];
const DAY_MS = 24 * 60 * 60 * 1000;
const SCHEDULER_INTERVAL_MS = 12 * 60 * 60 * 1000;
const INITIAL_CHECK_DELAY_MS = 60 * 1000;

const DEFAULT_SETTINGS = {
  autoMonthly: true,
  retentionDays: 30,
  lastFlushedAt: null,
  lastResult: null,
};

function clampRetentionDays(value, fallback = 30) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(Math.max(Math.round(num), 1), 365);
}

/** Remove `<figure>` or standalone `<img>` tags referencing deleted image UUIDs from HTML. */
function stripDeletedInlineImages(html, deletedIdSet) {
  if (!html || !deletedIdSet || !deletedIdSet.size) return html;
  const figureRe =
    /<figure\b[^>]*>(?:(?!<\/figure>)[\s\S])*?\/images\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:(?!<\/figure>)[\s\S])*?<\/figure>/gi;
  const imgRe =
    /<img\b[^>]*?src\s*=\s*["'][^"']*\/images\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})[^"']*["'][^>]*\/?>/gi;

  return String(html)
    .replace(figureRe, (full, uuid) => (deletedIdSet.has(uuid.toLowerCase()) ? '' : full))
    .replace(imgRe, (full, uuid) => (deletedIdSet.has(uuid.toLowerCase()) ? '' : full));
}

async function loadFlushSettings(db = { query }) {
  const { rows } = await db.query('SELECT value FROM settings WHERE key = $1', [SETTINGS_KEY]);
  const stored = rows[0]?.value && typeof rows[0].value === 'object' ? rows[0].value : {};
  return {
    autoMonthly: stored.autoMonthly !== undefined ? Boolean(stored.autoMonthly) : DEFAULT_SETTINGS.autoMonthly,
    retentionDays: clampRetentionDays(stored.retentionDays, DEFAULT_SETTINGS.retentionDays),
    lastFlushedAt: stored.lastFlushedAt || null,
    lastResult: stored.lastResult || null,
  };
}

async function saveFlushSettings(next, db = { query }) {
  await db.query(
    `INSERT INTO settings(key, value)
     VALUES ($1, $2::jsonb)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [SETTINGS_KEY, JSON.stringify(next)]
  );
  return next;
}

async function updateFlushSettings({ autoMonthly, retentionDays }, db = { query }) {
  const current = await loadFlushSettings(db);
  const next = {
    ...current,
    ...(autoMonthly !== undefined ? { autoMonthly: Boolean(autoMonthly) } : {}),
    ...(retentionDays !== undefined
      ? { retentionDays: clampRetentionDays(retentionDays, current.retentionDays) }
      : {}),
  };
  return saveFlushSettings(next, db);
}

async function fetchTranslationsAndInlineSets(db) {
  const { rows } = await db.query(
    `SELECT t.id, t.content, a.is_sponsored
       FROM article_translations t
       JOIN articles a ON a.id = t.article_id`
  );
  const sponsoredInlineIds = new Set();
  const allInlineIds = new Set();

  for (const row of rows) {
    const ids = extractInlineImageIds(row.content);
    for (const id of ids) {
      allInlineIds.add(id);
      if (row.is_sponsored) sponsoredInlineIds.add(id);
    }
  }

  return { translations: rows, sponsoredInlineIds, allInlineIds };
}

function isProtectedRoot(row, sponsoredInlineIds) {
  const idLower = String(row.id || '').toLowerCase();
  return Boolean(
    row.is_ad_protected ||
      row.used_by_ad ||
      row.used_by_sponsored ||
      sponsoredInlineIds.has(idLower)
  );
}

/** Compute storage breakdown separating flushable news images from protected ad/sponsored media. */
async function getStorageStats(db = { query }, nowMs = Date.now()) {
  const [settings, { sponsoredInlineIds, allInlineIds }, rootStats] = await Promise.all([
    loadFlushSettings(db),
    fetchTranslationsAndInlineSets(db),
    db.query(`
      SELECT root.id,
             root.created_at,
             root.is_ad_protected,
             EXISTS (SELECT 1 FROM advertisements ad WHERE ad.image_id = root.id) AS used_by_ad,
             EXISTS (
               SELECT 1 FROM article_images ai
               JOIN articles a ON a.id = ai.article_id
              WHERE ai.image_id = root.id AND a.is_sponsored = TRUE
             ) AS used_by_sponsored,
             EXISTS (SELECT 1 FROM article_images ai WHERE ai.image_id = root.id) AS used_by_any_article,
             COUNT(i.id)::int AS file_count,
             COALESCE(SUM(i.file_size), 0)::bigint AS total_bytes
        FROM images root
        JOIN images i ON i.id = root.id OR i.parent_id = root.id
       WHERE root.parent_id IS NULL
       GROUP BY root.id, root.created_at, root.is_ad_protected
    `),
  ]);

  const retentionCutoffMs = nowMs - settings.retentionDays * DAY_MS;
  const protectedAds = { roots: 0, files: 0, bytes: 0 };
  const flushableNews = {
    totalRoots: 0,
    totalFiles: 0,
    totalBytes: 0,
    olderThanRetentionRoots: 0,
    olderThanRetentionBytes: 0,
    orphanRoots: 0,
    orphanBytes: 0,
  };

  for (const row of rootStats.rows) {
    const files = Number(row.file_count || 0);
    const bytes = Number(row.total_bytes || 0);
    if (isProtectedRoot(row, sponsoredInlineIds)) {
      protectedAds.roots += 1;
      protectedAds.files += files;
      protectedAds.bytes += bytes;
      continue;
    }

    flushableNews.totalRoots += 1;
    flushableNews.totalFiles += files;
    flushableNews.totalBytes += bytes;

    if (new Date(row.created_at).getTime() < retentionCutoffMs) {
      flushableNews.olderThanRetentionRoots += 1;
      flushableNews.olderThanRetentionBytes += bytes;
    }

    if (!row.used_by_any_article && !allInlineIds.has(String(row.id).toLowerCase())) {
      flushableNews.orphanRoots += 1;
      flushableNews.orphanBytes += bytes;
    }
  }

  return {
    r2Enabled: env.r2.enabled,
    purgeEnabled: env.cloudflare.purgeEnabled,
    protectedAds,
    flushableNews,
    settings,
  };
}

/**
 * Flush regular news storage from Cloudflare R2 and PostgreSQL while preserving
 * all banner advertisements, sponsored posts, and regular article text/URLs.
 */
async function flushCloudflareStorage(options = {}, deps = {}) {
  const mode = options.mode || 'older_than_30d';
  if (!VALID_MODES.includes(mode)) {
    throw new ApiError(422, 'Unsupported storage flush mode', 'VALIDATION');
  }

  const db = deps.db || { query };
  const r2 = deps.r2 || r2Storage;
  const cfCache = deps.cfCache || cloudflareCache;
  const auditFn = deps.auditFn || audit;
  const cfConfig = deps.cfConfig || env.cloudflare;
  const nowMs = deps.nowMs || Date.now();
  const actorId = options.actorId || null;
  const trigger = options.trigger || 'manual';

  const currentSettings = await loadFlushSettings(db);
  const retentionDays = clampRetentionDays(
    options.retentionDays !== undefined ? options.retentionDays : currentSettings.retentionDays,
    currentSettings.retentionDays
  );

  let rootsDeleted = 0;
  let filesDeleted = 0;
  let r2ObjectsDeleted = 0;
  let bytesFreed = 0;
  let htmlArticlesCleaned = 0;

  if (mode !== 'cache_only') {
    const [{ translations, sponsoredInlineIds, allInlineIds }, rootRows] = await Promise.all([
      fetchTranslationsAndInlineSets(db),
      db.query(`
        SELECT root.id,
               root.created_at,
               root.is_ad_protected,
               EXISTS (SELECT 1 FROM advertisements ad WHERE ad.image_id = root.id) AS used_by_ad,
               EXISTS (
                 SELECT 1 FROM article_images ai
                 JOIN articles a ON a.id = ai.article_id
                WHERE ai.image_id = root.id AND a.is_sponsored = TRUE
               ) AS used_by_sponsored,
               EXISTS (SELECT 1 FROM article_images ai WHERE ai.image_id = root.id) AS used_by_any_article
          FROM images root
         WHERE root.parent_id IS NULL
      `),
    ]);

    const cutoffMs = nowMs - retentionDays * DAY_MS;
    const targetRootIds = [];

    for (const row of rootRows.rows) {
      if (isProtectedRoot(row, sponsoredInlineIds)) continue;
      const idLower = String(row.id).toLowerCase();

      if (mode === 'older_than_30d') {
        if (new Date(row.created_at).getTime() >= cutoffMs) continue;
      } else if (mode === 'orphans_only') {
        if (row.used_by_any_article || allInlineIds.has(idLower)) continue;
      }
      targetRootIds.push(row.id);
    }

    if (targetRootIds.length > 0) {
      const imageRows = await db.query(
        `SELECT id, storage_provider, storage_key, file_size
           FROM images
          WHERE id = ANY($1::uuid[]) OR parent_id = ANY($1::uuid[])`,
        [targetRootIds]
      );

      const r2Keys = imageRows.rows
        .filter((row) => row.storage_provider === 'r2' && row.storage_key)
        .map((row) => row.storage_key);

      if (r2Keys.length) {
        r2ObjectsDeleted = await r2.deleteObjects(r2Keys);
      }

      filesDeleted = imageRows.rows.length;
      bytesFreed = imageRows.rows.reduce((sum, row) => sum + Number(row.file_size || 0), 0);
      rootsDeleted = targetRootIds.length;

      await db.query(
        'DELETE FROM images WHERE id = ANY($1::uuid[]) OR parent_id = ANY($1::uuid[])',
        [targetRootIds]
      );

      const deletedIdSet = new Set(targetRootIds.map((id) => String(id).toLowerCase()));
      for (const row of translations) {
        if (row.is_sponsored || !row.content) continue;
        const cleaned = stripDeletedInlineImages(row.content, deletedIdSet);
        if (cleaned !== row.content) {
          await db.query(
            'UPDATE article_translations SET content = $1, updated_at = NOW() WHERE id = $2',
            [cleaned, row.id]
          );
          htmlArticlesCleaned += 1;
        }
      }
    }
  }

  let cachePurged = false;
  if (cfConfig?.purgeEnabled) {
    const purgeResult = await cfCache.purgeUrls(['/sitemap.xml'], {
      cfConfig: { ...cfConfig, purgeMode: 'everything' },
    });
    cachePurged = Boolean(purgeResult?.ok);
  }

  const flushedAt = new Date(nowMs).toISOString();
  const summary = {
    ok: true,
    mode,
    trigger,
    retentionDays,
    rootsDeleted,
    filesDeleted,
    r2ObjectsDeleted,
    bytesFreed,
    htmlArticlesCleaned,
    cachePurged,
    flushedAt,
  };

  await saveFlushSettings(
    {
      ...currentSettings,
      lastFlushedAt: flushedAt,
      lastResult: summary,
    },
    db
  );

  await auditFn(null, actorId, 'admin.cloudflare_storage_flushed', 'storage', 'cloudflare', summary);

  return summary;
}

/** Check whether the monthly retention schedule is due and flush old non-ad news media. */
async function runScheduledMonthlyFlushIfDue() {
  const settings = await loadFlushSettings({ query });
  if (!settings.autoMonthly) return null;

  const intervalMs = settings.retentionDays * DAY_MS;
  const nowMs = Date.now();
  if (settings.lastFlushedAt) {
    const lastMs = new Date(settings.lastFlushedAt).getTime();
    if (Number.isFinite(lastMs) && nowMs - lastMs < intervalMs) {
      return null;
    }
  } else {
    const stats = await getStorageStats({ query }, nowMs);
    if (stats.flushableNews.olderThanRetentionRoots === 0) {
      return null;
    }
  }

  const summary = await flushCloudflareStorage({
    mode: 'older_than_30d',
    retentionDays: settings.retentionDays,
    trigger: 'monthly_auto',
  });
  console.log(
    `[storage-flush] monthly auto flush complete: roots=${summary.rootsDeleted}, r2=${summary.r2ObjectsDeleted}, bytes=${summary.bytesFreed}`
  );
  return summary;
}

function startMonthlyFlushScheduler() {
  const check = () => {
    runScheduledMonthlyFlushIfDue().catch((err) => {
      console.warn('[storage-flush] scheduled check failed:', err.message);
    });
  };
  setTimeout(check, INITIAL_CHECK_DELAY_MS).unref();
  const timer = setInterval(check, SCHEDULER_INTERVAL_MS);
  timer.unref();
  return timer;
}

module.exports = {
  SETTINGS_KEY,
  VALID_MODES,
  DEFAULT_SETTINGS,
  stripDeletedInlineImages,
  loadFlushSettings,
  updateFlushSettings,
  getStorageStats,
  flushCloudflareStorage,
  runScheduledMonthlyFlushIfDue,
  startMonthlyFlushScheduler,
};
