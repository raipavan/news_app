import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

import {
  AnalyticsBufferCore,
  hashVisitor,
  shardNameFor,
  handleAnalyticsRequest,
} from '../src/analyticsBuffer.js';

function createMockCtx() {
  const db = new DatabaseSync(':memory:');
  let scheduledAlarm = null;

  return {
    db,
    getAlarmValue: () => scheduledAlarm,
    clearAlarmForFire: () => {
      scheduledAlarm = null;
    },
    blockConcurrencyWhile: (fn) => fn(),
    storage: {
      sql: {
        exec(sql, ...params) {
          const trimmed = sql.trim();
          // Multi-statement schema initialization has no bound params.
          if (params.length === 0 && trimmed.includes(';') && /CREATE\s+TABLE/i.test(trimmed)) {
            db.exec(sql);
            return { toArray: () => [] };
          }
          const stmt = db.prepare(sql);
          if (/^\s*SELECT/i.test(trimmed)) {
            const rows = stmt.all(...params);
            return { toArray: () => rows };
          }
          stmt.run(...params);
          return { toArray: () => [] };
        },
      },
      getAlarm: async () => scheduledAlarm,
      setAlarm: async (ts) => {
        scheduledAlarm = ts;
      },
    },
  };
}

describe('AnalyticsBufferCore (SQLite Durable Object)', () => {
  it('deduplicates views within 30 minutes and schedules a single alarm', async () => {
    const ctx = createMockCtx();
    const core = new AnalyticsBufferCore(ctx, {
      ORIGIN_BASE_URL: 'https://news.test',
      INTERNAL_FLUSH_SECRET: 'sec-1',
      FLUSH_INTERVAL_MS: '60000',
    });

    const t0 = 1_700_000_000_000;
    const r1 = await core.recordView('art-1', 'vis-a', t0);
    assert.deepEqual(r1, { buffered: true, counted: true });
    assert.equal(ctx.getAlarmValue(), t0 + 60_000);

    const r2 = await core.recordView('art-1', 'vis-a', t0 + 10 * 60_000);
    assert.deepEqual(r2, { buffered: true, counted: false });
    // Alarm remains anchored to first event.
    assert.equal(ctx.getAlarmValue(), t0 + 60_000);

    // 21m after r2 (sliding 30m window still active)
    const r2b = await core.recordView('art-1', 'vis-a', t0 + 31 * 60_000);
    assert.deepEqual(r2b, { buffered: true, counted: false });

    // 31m after r2b (sliding window expired)
    const r3 = await core.recordView('art-1', 'vis-a', t0 + 62 * 60_000);
    assert.deepEqual(r3, { buffered: true, counted: true });

    const r4 = await core.recordImpression('ad-1', 'vis-a', t0 + 1000);
    assert.deepEqual(r4, { buffered: true });
  });

  it('flushes batched views/impressions and preserves concurrent rows written mid-flush', async () => {
    const ctx = createMockCtx();
    let flushPayload = null;
    let core;

    const fakeFetch = async (url, init) => {
      flushPayload = { url, headers: init.headers, body: JSON.parse(init.body) };
      // Simulate a new view arriving concurrently while HTTP flush is in flight.
      await core.recordView('art-2', 'vis-concurrent', 1_700_000_005_000);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };

    core = new AnalyticsBufferCore(
      ctx,
      {
        ORIGIN_BASE_URL: 'https://news.test/',
        INTERNAL_FLUSH_SECRET: 'flush-secret',
      },
      { fetchImpl: fakeFetch }
    );

    await core.recordView('art-1', 'vis-1', 1_700_000_000_000);
    await core.recordImpression('ad-1', 'vis-1', 1_700_000_001_000);
    ctx.clearAlarmForFire();

    const flushRes = await core.alarm(1_700_000_060_000);
    assert.equal(flushRes.flushed, true);
    assert.equal(flushRes.views, 1);
    assert.equal(flushRes.impressions, 1);
    assert.equal(flushRes.remaining, 1);
    assert.equal(flushPayload.url, 'https://news.test/api/v1/internal/analytics/flush');
    assert.equal(flushPayload.headers['X-Internal-Secret'], 'flush-secret');
    assert.equal(flushPayload.body.views[0].unique, true);

    const remainingRows = ctx.db.prepare('SELECT article_id FROM pending_views').all();
    assert.equal(remainingRows.length, 1);
    assert.equal(remainingRows[0].article_id, 'art-2');
    assert.ok(ctx.getAlarmValue() !== null);
  });

  it('preserves pending rows and schedules retry alarm when origin returns 500', async () => {
    const ctx = createMockCtx();
    const core = new AnalyticsBufferCore(
      ctx,
      {
        ORIGIN_BASE_URL: 'https://news.test',
        INTERNAL_FLUSH_SECRET: 'flush-secret',
      },
      {
        fetchImpl: async () => new Response('origin error', { status: 500 }),
      }
    );

    await core.recordView('art-1', 'vis-1', 1_700_000_000_000);
    ctx.clearAlarmForFire();

    const flushRes = await core.alarm(1_700_000_060_000);
    assert.equal(flushRes.flushed, false);
    assert.equal(flushRes.status, 500);
    assert.equal(ctx.db.prepare('SELECT COUNT(*) AS c FROM pending_views').get().c, 1);
    assert.ok(ctx.getAlarmValue() !== null);
  });
});

describe('Edge Worker routing & visitor hashing', () => {
  it('computes SHA-256 40-char hash matching backend tokens.js and shards deterministically', async () => {
    const expected = crypto.createHash('sha256').update('visitor-42').digest('hex').slice(0, 40);
    assert.equal(await hashVisitor('visitor-42'), expected);
    assert.match(shardNameFor('11111111-1111-4111-8111-111111111111', 4), /^shard-[0-3]$/);
  });

  it('handles view & impression routes and fails open on unmatched or errored requests', async () => {
    const recorded = [];
    const env = {
      SHARD_COUNT: '4',
      ANALYTICS_BUFFER: {
        getByName: (name) => ({
          recordView: async (articleId, visitorHash) => {
            recorded.push({ name, type: 'view', articleId, visitorHash });
            return { buffered: true, counted: true };
          },
          recordImpression: async (adId, visitorId) => {
            recorded.push({ name, type: 'impression', adId, visitorId });
            return { buffered: true };
          },
        }),
      },
    };

    const artId = '11111111-1111-4111-8111-111111111111';
    const adId = '22222222-2222-4222-8222-222222222222';
    let fallbackCalled = 0;
    const fallbackFetch = async () => {
      fallbackCalled += 1;
      return new Response('origin-ok', { status: 200 });
    };

    const viewRes = await handleAnalyticsRequest(
      new Request(`https://news.test/api/v1/articles/${artId}/view`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitor_id: 'v-abc' }),
      }),
      env,
      fallbackFetch
    );
    assert.equal(viewRes.status, 200);
    assert.deepEqual(await viewRes.json(), { buffered: true, counted: true });

    const impRes = await handleAnalyticsRequest(
      new Request(`https://news.test/api/v1/public/ads/${adId}/impression`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitor_id: 'v-abc' }),
      }),
      env,
      fallbackFetch
    );
    assert.equal(impRes.status, 204);
    assert.equal(recorded.length, 2);
    assert.equal(fallbackCalled, 0);

    // Unmatched route fails open to origin
    const getRes = await handleAnalyticsRequest(
      new Request('https://news.test/api/v1/public/home'),
      env,
      fallbackFetch
    );
    assert.equal(await getRes.text(), 'origin-ok');
    assert.equal(fallbackCalled, 1);

    // DO RPC error fails open to origin
    const brokenEnv = {
      ANALYTICS_BUFFER: {
        getByName: () => ({
          recordView: async () => {
            throw new Error('DO unavailable');
          },
        }),
      },
    };
    const failOpenRes = await handleAnalyticsRequest(
      new Request(`https://news.test/api/v1/articles/${artId}/view`, { method: 'POST' }),
      brokenEnv,
      fallbackFetch
    );
    assert.equal(await failOpenRes.text(), 'origin-ok');
    assert.equal(fallbackCalled, 2);
  });
});
