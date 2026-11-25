const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  extractInlineImageIds,
  deleteImageIfUnreferenced,
} = require('../src/services/imageService');
const {
  stripDeletedInlineImages,
  flushCloudflareStorage,
  getStorageStats,
} = require('../src/services/storageFlushService');

describe('ad media protection & HTML inline image helpers', () => {
  it('extracts UUIDs from PG and R2 image URLs and strips only deleted inline tags', () => {
    const id1 = '11111111-1111-4111-8111-111111111111';
    const id2 = '22222222-2222-4222-8222-222222222222';
    const html = `
      <p>Lead paragraph</p>
      <figure style="width:100%"><img src="https://media.tajasuddinews.in/images/${id1}/optimized.webp" alt=""><figcaption>Old news photo</figcaption></figure>
      <p>Keep me <img src="/api/v1/images/${id2}?variant=optimized" alt="keep"></p>
    `;

    assert.deepEqual(extractInlineImageIds(html), [id1, id2]);

    const cleaned = stripDeletedInlineImages(html, new Set([id1]));
    assert.ok(!cleaned.includes(id1));
    assert.ok(!cleaned.includes('Old news photo'));
    assert.ok(cleaned.includes('Lead paragraph'));
    assert.ok(cleaned.includes(id2));
  });

  it('deleteImageIfUnreferenced deletes DB + R2 only when no ad or article references it', async () => {
    const id = '33333333-3333-4333-8333-333333333333';
    const r2Deleted = [];
    const mockR2 = {
      deleteObjects: async (keys) => {
        r2Deleted.push(...keys);
      },
    };

    const inUseDb = {
      query: async (sql) => {
        if (sql.startsWith('SELECT id, parent_id')) return { rows: [{ id, parent_id: null }] };
        if (sql.includes('FROM article_images')) return { rowCount: 1, rows: [{ '?column?': 1 }] };
        return { rowCount: 0, rows: [] };
      },
    };
    assert.equal(await deleteImageIfUnreferenced(inUseDb, id, mockR2), false);
    assert.equal(r2Deleted.length, 0);

    let dbDeleted = false;
    const freeDb = {
      query: async (sql) => {
        if (sql.startsWith('SELECT id, parent_id')) return { rows: [{ id, parent_id: null }] };
        if (sql.includes('FROM article_images')) return { rowCount: 0, rows: [] };
        if (sql.startsWith('SELECT storage_provider')) {
          return {
            rows: [
              { storage_provider: 'r2', storage_key: `images/${id}/original.png` },
              { storage_provider: 'r2', storage_key: `images/${id}/optimized.webp` },
            ],
          };
        }
        if (sql.startsWith('DELETE FROM images')) {
          dbDeleted = true;
          return { rowCount: 2, rows: [] };
        }
        return { rowCount: 0, rows: [] };
      },
    };
    assert.equal(await deleteImageIfUnreferenced(freeDb, id, mockR2), true);
    assert.equal(dbDeleted, true);
    assert.deepEqual(r2Deleted, [
      `images/${id}/original.png`,
      `images/${id}/optimized.webp`,
    ]);
  });
});

describe('storageFlushService (monthly flush keeps ads & sponsored posts untouched)', () => {
  function buildDataset() {
    const now = Date.UTC(2026, 10, 23);
    const oldDate = new Date(now - 45 * 24 * 60 * 60 * 1000).toISOString();
    const recentDate = new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString();

    const oldNewsId = 'aaaa1111-1111-4111-8111-111111111111';
    const recentNewsId = 'bbbb2222-2222-4222-8222-222222222222';
    const orphanNewsId = 'cccc3333-3333-4333-8333-333333333333';
    const bannerAdId = 'dddd4444-4444-4444-8444-444444444444';
    const sponsoredMainId = 'eeee5555-5555-4555-8555-555555555555';
    const sponsoredInlineId = 'ffff6666-6666-4666-8666-666666666666';

    const roots = [
      {
        id: oldNewsId,
        created_at: oldDate,
        is_ad_protected: false,
        used_by_ad: false,
        used_by_sponsored: false,
        used_by_any_article: true,
        file_count: 2,
        total_bytes: 50000,
      },
      {
        id: recentNewsId,
        created_at: recentDate,
        is_ad_protected: false,
        used_by_ad: false,
        used_by_sponsored: false,
        used_by_any_article: true,
        file_count: 2,
        total_bytes: 30000,
      },
      {
        id: orphanNewsId,
        created_at: oldDate,
        is_ad_protected: false,
        used_by_ad: false,
        used_by_sponsored: false,
        used_by_any_article: false,
        file_count: 1,
        total_bytes: 10000,
      },
      {
        id: bannerAdId,
        created_at: oldDate,
        is_ad_protected: true,
        used_by_ad: true,
        used_by_sponsored: false,
        used_by_any_article: false,
        file_count: 2,
        total_bytes: 80000,
      },
      {
        id: sponsoredMainId,
        created_at: oldDate,
        is_ad_protected: true,
        used_by_ad: false,
        used_by_sponsored: true,
        used_by_any_article: true,
        file_count: 2,
        total_bytes: 60000,
      },
      {
        id: sponsoredInlineId,
        created_at: oldDate,
        is_ad_protected: false, // Even if flag were false, inline sponsored check still protects it
        used_by_ad: false,
        used_by_sponsored: false,
        used_by_any_article: false,
        file_count: 1,
        total_bytes: 20000,
      },
    ];

    const translations = [
      {
        id: 'tr-news',
        is_sponsored: false,
        content: `<p>News story text</p><figure><img src="https://media.tajasuddinews.in/images/${oldNewsId}/optimized.webp"></figure>`,
      },
      {
        id: 'tr-sponsored',
        is_sponsored: true,
        content: `<p>Sponsored text</p><img src="https://media.tajasuddinews.in/images/${sponsoredInlineId}/optimized.webp">`,
      },
    ];

    const deletedR2Keys = [];
    const deletedRootIds = [];
    const htmlUpdates = [];
    let savedSettings = null;
    const audits = [];

    const db = {
      query: async (sql, params = []) => {
        if (sql.startsWith('SELECT value FROM settings')) {
          return { rows: savedSettings ? [{ value: savedSettings }] : [] };
        }
        if (sql.startsWith('INSERT INTO settings')) {
          savedSettings = JSON.parse(params[1]);
          return { rowCount: 1, rows: [] };
        }
        if (sql.includes('FROM article_translations t')) {
          return { rows: translations };
        }
        if (sql.includes('FROM images root')) {
          return { rows: roots };
        }
        if (sql.startsWith('SELECT id, storage_provider, storage_key, file_size')) {
          const ids = params[0] || [];
          const rows = [];
          for (const id of ids) {
            const r = roots.find((x) => x.id === id);
            rows.push({
              id,
              storage_provider: 'r2',
              storage_key: `images/${id}/optimized.webp`,
              file_size: r ? r.total_bytes : 0,
            });
          }
          return { rows };
        }
        if (sql.startsWith('DELETE FROM images')) {
          deletedRootIds.push(...(params[0] || []));
          return { rowCount: (params[0] || []).length, rows: [] };
        }
        if (sql.startsWith('UPDATE article_translations SET content')) {
          htmlUpdates.push({ id: params[1], content: params[0] });
          return { rowCount: 1, rows: [] };
        }
        return { rows: [], rowCount: 0 };
      },
    };

    const r2 = {
      deleteObjects: async (keys) => {
        deletedR2Keys.push(...keys);
        return keys.length;
      },
    };
    const cfCache = {
      purgeUrls: async () => ({ ok: true, purged: 1 }),
    };
    const auditFn = async (...args) => {
      audits.push(args);
    };

    return {
      now,
      ids: { oldNewsId, recentNewsId, orphanNewsId, bannerAdId, sponsoredMainId, sponsoredInlineId },
      db,
      r2,
      cfCache,
      auditFn,
      deletedR2Keys,
      deletedRootIds,
      htmlUpdates,
      audits,
    };
  }

  it('computes separated stats for flushable news vs protected ads', async () => {
    const ctx = buildDataset();
    const stats = await getStorageStats(ctx.db, ctx.now);
    assert.equal(stats.protectedAds.roots, 3);
    assert.equal(stats.protectedAds.bytes, 160000);
    assert.equal(stats.flushableNews.totalRoots, 3);
    assert.equal(stats.flushableNews.olderThanRetentionRoots, 2);
    assert.equal(stats.flushableNews.orphanRoots, 1);
  });

  it('flushes only older_than_30d non-ad news images and preserves ads, sponsored posts, and article text', async () => {
    const ctx = buildDataset();
    const res = await flushCloudflareStorage(
      { mode: 'older_than_30d', retentionDays: 30, actorId: 'admin-1' },
      {
        db: ctx.db,
        r2: ctx.r2,
        cfCache: ctx.cfCache,
        auditFn: ctx.auditFn,
        cfConfig: { purgeEnabled: true },
        nowMs: ctx.now,
      }
    );

    assert.equal(res.rootsDeleted, 2);
    assert.equal(res.cachePurged, true);
    assert.deepEqual(ctx.deletedRootIds, [ctx.ids.oldNewsId, ctx.ids.orphanNewsId]);
    assert.ok(!ctx.deletedRootIds.includes(ctx.ids.recentNewsId));
    assert.ok(!ctx.deletedRootIds.includes(ctx.ids.bannerAdId));
    assert.ok(!ctx.deletedRootIds.includes(ctx.ids.sponsoredMainId));
    assert.ok(!ctx.deletedRootIds.includes(ctx.ids.sponsoredInlineId));
    assert.equal(ctx.htmlUpdates.length, 1);
    assert.ok(ctx.htmlUpdates[0].content.includes('News story text'));
    assert.ok(!ctx.htmlUpdates[0].content.includes(ctx.ids.oldNewsId));
  });

  it('protects all ad & sponsored media even during all_news and orphans_only flushes', async () => {
    const ctxAll = buildDataset();
    const allRes = await flushCloudflareStorage(
      { mode: 'all_news', actorId: 'admin-1' },
      {
        db: ctxAll.db,
        r2: ctxAll.r2,
        cfCache: ctxAll.cfCache,
        auditFn: ctxAll.auditFn,
        cfConfig: { purgeEnabled: false },
        nowMs: ctxAll.now,
      }
    );
    assert.equal(allRes.rootsDeleted, 3);
    assert.deepEqual(ctxAll.deletedRootIds, [
      ctxAll.ids.oldNewsId,
      ctxAll.ids.recentNewsId,
      ctxAll.ids.orphanNewsId,
    ]);
    assert.ok(!ctxAll.deletedRootIds.includes(ctxAll.ids.bannerAdId));
    assert.ok(!ctxAll.deletedRootIds.includes(ctxAll.ids.sponsoredMainId));
    assert.ok(!ctxAll.deletedRootIds.includes(ctxAll.ids.sponsoredInlineId));

    const ctxOrphan = buildDataset();
    const orphanRes = await flushCloudflareStorage(
      { mode: 'orphans_only', actorId: 'admin-1' },
      {
        db: ctxOrphan.db,
        r2: ctxOrphan.r2,
        cfCache: ctxOrphan.cfCache,
        auditFn: ctxOrphan.auditFn,
        cfConfig: { purgeEnabled: false },
        nowMs: ctxOrphan.now,
      }
    );
    assert.equal(orphanRes.rootsDeleted, 1);
    assert.deepEqual(ctxOrphan.deletedRootIds, [ctxOrphan.ids.orphanNewsId]);
  });

  it('supports cache_only purge without deleting any images', async () => {
    const ctx = buildDataset();
    const res = await flushCloudflareStorage(
      { mode: 'cache_only', actorId: 'admin-1' },
      {
        db: ctx.db,
        r2: ctx.r2,
        cfCache: ctx.cfCache,
        auditFn: ctx.auditFn,
        cfConfig: { purgeEnabled: true },
        nowMs: ctx.now,
      }
    );
    assert.equal(res.rootsDeleted, 0);
    assert.equal(res.cachePurged, true);
    assert.equal(ctx.deletedR2Keys.length, 0);
  });
});
