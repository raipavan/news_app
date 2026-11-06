const { query, one } = require('../db');
const { asyncHandler, ApiError } = require('../utils/errors');
const { hashVisitor } = require('../utils/tokens');
const { cleanText } = require('../utils/sanitize');
const { listCards } = require('../services/articleService');

const LANGS = ['kn', 'en'];

async function publishedArticle(id) {
  const row = await one(
    `SELECT a.id, a.status FROM articles a
      WHERE a.id = $1 AND a.status = 'published'
        AND EXISTS (
          SELECT 1 FROM article_translations t
           WHERE t.article_id = a.id AND t.status = 'published'
        )`,
    [id]
  );
  if (!row) throw new ApiError(404, 'Article not found', 'NOT_FOUND');
  return row;
}

const trackView = asyncHandler(async (req, res) => {
  await publishedArticle(req.params.id);
  const visitor = hashVisitor(req.body?.visitor_id || req.ip || 'anonymous');
  const recent = await query(
    `SELECT 1 FROM article_views
      WHERE article_id = $1 AND visitor_hash = $2 AND viewed_at > NOW() - INTERVAL '30 minutes'
      LIMIT 1`,
    [req.params.id, visitor]
  );
  await query('INSERT INTO article_views(article_id, visitor_hash) VALUES ($1, $2)', [
    req.params.id,
    visitor,
  ]);
  if (!recent.rowCount) {
    await query('UPDATE articles SET view_count = view_count + 1 WHERE id = $1', [req.params.id]);
  }
  const { rows } = await query('SELECT view_count FROM articles WHERE id = $1', [req.params.id]);
  res.json({ view_count: Number(rows[0].view_count) });
});

const toggleLike = asyncHandler(async (req, res) => {
  await publishedArticle(req.params.id);
  const visitorHash = req.user ? null : hashVisitor(req.body?.visitor_id || req.ip || 'anonymous');
  const existing = req.user
    ? await query('SELECT 1 FROM article_likes WHERE article_id = $1 AND user_id = $2', [
        req.params.id,
        req.user.id,
      ])
    : await query('SELECT 1 FROM article_likes WHERE article_id = $1 AND visitor_hash = $2', [
        req.params.id,
        visitorHash,
      ]);
  let liked;
  if (existing.rowCount) {
    if (req.user) {
      await query('DELETE FROM article_likes WHERE article_id = $1 AND user_id = $2', [
        req.params.id,
        req.user.id,
      ]);
    } else {
      await query('DELETE FROM article_likes WHERE article_id = $1 AND visitor_hash = $2', [
        req.params.id,
        visitorHash,
      ]);
    }
    liked = false;
  } else {
    if (req.user) {
      await query('INSERT INTO article_likes(article_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [
        req.params.id,
        req.user.id,
      ]);
    } else {
      await query(
        'INSERT INTO article_likes(article_id, visitor_hash) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [req.params.id, visitorHash]
      );
    }
    liked = true;
  }
  const count = await query('SELECT COUNT(*)::int AS c FROM article_likes WHERE article_id = $1', [
    req.params.id,
  ]);
  res.json({ liked, count: count.rows[0].c });
});

const toggleBookmark = asyncHandler(async (req, res) => {
  await publishedArticle(req.params.id);
  const existing = await query('SELECT 1 FROM bookmarks WHERE article_id = $1 AND user_id = $2', [
    req.params.id,
    req.user.id,
  ]);
  let bookmarked;
  if (existing.rowCount) {
    await query('DELETE FROM bookmarks WHERE article_id = $1 AND user_id = $2', [
      req.params.id,
      req.user.id,
    ]);
    bookmarked = false;
  } else {
    await query('INSERT INTO bookmarks(article_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [
      req.params.id,
      req.user.id,
    ]);
    bookmarked = true;
  }
  res.json({ bookmarked });
});

const listBookmarks = asyncHandler(async (req, res) => {
  const lang = LANGS.includes(req.query.lang) ? req.query.lang : 'en';
  const { rows } = await query(
    `SELECT t.slug FROM bookmarks b
       JOIN article_translations t ON t.article_id = b.article_id AND t.language = $1 AND t.status = 'published'
      WHERE b.user_id = $2 ORDER BY b.created_at DESC`,
    [lang, req.user.id]
  );
  const all = await listCards({ lang, limit: 50 });
  const slugs = new Set(rows.map((r) => r.slug));
  res.json({ items: all.filter((item) => slugs.has(item.slug)) });
});

const engagement = asyncHandler(async (req, res) => {
  await publishedArticle(req.params.id);
  const { rows } = await query(
    `SELECT
       (SELECT COUNT(*)::int FROM article_likes WHERE article_id = $1) AS likes,
       (SELECT COUNT(*)::int FROM comments WHERE article_id = $1 AND status = 'approved') AS comments,
       (SELECT COUNT(*)::int FROM article_shares WHERE article_id = $1) AS shares,
       (SELECT COUNT(*)::int FROM article_views WHERE article_id = $1) AS views`,
    [req.params.id]
  );
  let liked = false;
  let bookmarked = false;
  if (req.user) {
    const like = await query('SELECT 1 FROM article_likes WHERE article_id = $1 AND user_id = $2', [
      req.params.id,
      req.user.id,
    ]);
    const mark = await query('SELECT 1 FROM bookmarks WHERE article_id = $1 AND user_id = $2', [
      req.params.id,
      req.user.id,
    ]);
    liked = Boolean(like.rowCount);
    bookmarked = Boolean(mark.rowCount);
  } else if (req.query.visitor_id) {
    const visitorHash = hashVisitor(String(req.query.visitor_id));
    const like = await query(
      'SELECT 1 FROM article_likes WHERE article_id = $1 AND visitor_hash = $2',
      [req.params.id, visitorHash]
    );
    liked = Boolean(like.rowCount);
  }
  res.json({ ...rows[0], liked, bookmarked });
});

const listComments = asyncHandler(async (req, res) => {
  await publishedArticle(req.params.id);
  const { rows } = await query(
    `SELECT c.id, c.content, c.created_at, COALESCE(u.name, c.guest_name, 'Reader') AS user_name
       FROM comments c LEFT JOIN users u ON u.id = c.user_id
      WHERE c.article_id = $1 AND c.status = 'approved'
      ORDER BY c.created_at DESC LIMIT 60`,
    [req.params.id]
  );
  res.json({ items: rows });
});

function looksLikeSpam(content) {
  const links = (content.match(/https?:\/\//gi) || []).length;
  if (links > 3) return true;
  if (/(.)\1{12,}/.test(content)) return true;
  return content.length < 2;
}

const addComment = asyncHandler(async (req, res) => {
  await publishedArticle(req.params.id);
  const content = cleanText(req.body?.content, 1000);
  if (looksLikeSpam(content)) {
    throw new ApiError(422, 'Comment looks like spam or is too short', 'SPAM');
  }
  const guestName = cleanText(req.body?.guest_name, 80) || 'Reader';
  const { rows } = await query(
    `INSERT INTO comments(article_id, user_id, guest_name, content, status)
     VALUES ($1, $2, $3, $4, 'pending') RETURNING id, created_at`,
    [req.params.id, req.user?.id || null, req.user ? null : guestName, content]
  );
  res.status(201).json({
    comment: {
      id: rows[0].id,
      content,
      created_at: rows[0].created_at,
      user_name: req.user?.name || guestName,
      status: 'pending',
    },
    message: 'Comment submitted for moderation',
  });
});

const share = asyncHandler(async (req, res) => {
  await publishedArticle(req.params.id);
  const platform = String(req.body?.platform || 'other').slice(0, 30);
  await query('INSERT INTO article_shares(article_id, platform) VALUES ($1, $2)', [
    req.params.id,
    platform,
  ]);
  const count = await query('SELECT COUNT(*)::int AS c FROM article_shares WHERE article_id = $1', [
    req.params.id,
  ]);
  res.json({ shared: true, count: count.rows[0].c });
});

const report = asyncHandler(async (req, res) => {
  await publishedArticle(req.params.id);
  const reason = cleanText(req.body?.reason, 1000);
  if (!reason) throw new ApiError(422, 'Describe the issue with this article', 'VALIDATION');
  await query('INSERT INTO article_reports(article_id, reporter_id, reason) VALUES ($1, $2, $3)', [
    req.params.id,
    req.user?.id || null,
    reason,
  ]);
  res.status(201).json({ ok: true, message: 'Report received. Our editorial team will review it.' });
});

module.exports = {
  trackView,
  toggleLike,
  toggleBookmark,
  listBookmarks,
  engagement,
  listComments,
  addComment,
  share,
  report,
};
