const crypto = require('crypto');
const { z } = require('zod');
const env = require('../config/env');
const { tx } = require('../db');
const { ApiError, asyncHandler } = require('../utils/errors');

const flushSchema = z.object({
  views: z
    .array(
      z.object({
        articleId: z.string().uuid(),
        visitorHash: z.string().min(1).max(120),
        viewedAt: z.string().datetime().optional(),
        unique: z.boolean().optional().default(true),
      })
    )
    .max(2000)
    .optional()
    .default([]),
  impressions: z
    .array(
      z.object({
        adId: z.string().uuid(),
        visitorHash: z.string().max(120).nullable().optional(),
        viewedAt: z.string().datetime().optional(),
      })
    )
    .max(2000)
    .optional()
    .default([]),
});

/** Build middleware validating X-Internal-Secret with timing-safe comparison. */
function makeRequireInternalSecret(getSecret = () => env.internalFlushSecret) {
  return (req, res, next) => {
    const expected = String(getSecret() || '');
    if (!expected) {
      return next(new ApiError(404, 'Not found', 'NOT_FOUND'));
    }
    const provided = String(req.headers['x-internal-secret'] || '');
    const expectedBuf = Buffer.from(expected, 'utf8');
    const providedBuf = Buffer.from(provided, 'utf8');
    if (
      providedBuf.length !== expectedBuf.length ||
      !crypto.timingSafeEqual(providedBuf, expectedBuf)
    ) {
      return next(new ApiError(401, 'Unauthorized', 'UNAUTHORIZED'));
    }
    return next();
  };
}

/** Build handler that applies batched edge analytics deltas in bulk SQL statements. */
function makeFlushAnalytics(txFn = tx) {
  return asyncHandler(async (req, res) => {
    const data = flushSchema.parse(req.body || {});
    if (!data.views.length && !data.impressions.length) {
      return res.json({
        ok: true,
        viewsInserted: 0,
        uniqueIncremented: 0,
        impressionsInserted: 0,
      });
    }

    const result = await txFn(async (client) => {
      let viewsInserted = 0;
      let uniqueIncremented = 0;
      let impressionsInserted = 0;

      if (data.views.length) {
        const nowIso = new Date().toISOString();
        const viewArticleIds = data.views.map((v) => v.articleId);
        const viewVisitorHashes = data.views.map((v) => v.visitorHash);
        const viewTimestamps = data.views.map((v) => v.viewedAt || nowIso);

        const insertedViews = await client.query(
          `INSERT INTO article_views(article_id, visitor_hash, viewed_at)
           SELECT v.article_id, v.visitor_hash, COALESCE(v.viewed_at, NOW())
             FROM UNNEST($1::uuid[], $2::text[], $3::timestamptz[]) AS v(article_id, visitor_hash, viewed_at)
             JOIN articles a ON a.id = v.article_id AND a.status = 'published'`,
          [viewArticleIds, viewVisitorHashes, viewTimestamps]
        );
        viewsInserted = insertedViews.rowCount || 0;

        const uniqueByArticle = new Map();
        for (const view of data.views) {
          if (!view.unique) continue;
          uniqueByArticle.set(view.articleId, (uniqueByArticle.get(view.articleId) || 0) + 1);
        }

        if (uniqueByArticle.size > 0) {
          const aggIds = [...uniqueByArticle.keys()];
          const aggCounts = [...uniqueByArticle.values()];
          const updatedArticles = await client.query(
            `UPDATE articles a
                SET view_count = a.view_count + agg.cnt
               FROM UNNEST($1::uuid[], $2::bigint[]) AS agg(id, cnt)
              WHERE a.id = agg.id AND a.status = 'published'`,
            [aggIds, aggCounts]
          );
          uniqueIncremented = updatedArticles.rowCount || 0;
        }
      }

      if (data.impressions.length) {
        const nowIso = new Date().toISOString();
        const adIds = data.impressions.map((imp) => imp.adId);
        const visitorHashes = data.impressions.map((imp) => imp.visitorHash || '');
        const timestamps = data.impressions.map((imp) => imp.viewedAt || nowIso);

        const insertedImpressions = await client.query(
          `INSERT INTO ad_impressions(advertisement_id, visitor_hash, viewed_at)
           SELECT i.ad_id, NULLIF(i.visitor_hash, ''), COALESCE(i.viewed_at, NOW())
             FROM UNNEST($1::uuid[], $2::text[], $3::timestamptz[]) AS i(ad_id, visitor_hash, viewed_at)
             JOIN advertisements ad ON ad.id = i.ad_id`,
          [adIds, visitorHashes, timestamps]
        );
        impressionsInserted = insertedImpressions.rowCount || 0;
      }

      return { viewsInserted, uniqueIncremented, impressionsInserted };
    });

    return res.json({ ok: true, ...result });
  });
}

const requireInternalSecret = makeRequireInternalSecret();
const flushAnalytics = makeFlushAnalytics();

module.exports = {
  flushSchema,
  makeRequireInternalSecret,
  makeFlushAnalytics,
  requireInternalSecret,
  flushAnalytics,
};
