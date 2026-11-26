const { query } = require('../db');
const { asyncHandler } = require('../utils/errors');
const { getPublicArticleBySlug, getPublicCategories, listCards } = require('../services/articleService');
const { activeAds } = require('../services/adService');
const { renderArticlePage, renderNotFound, baseUrl } = require('../services/ssr');
const { loadShareSettings } = require('../services/shareSettingsService');

const LANGS = ['kn', 'en'];

const ARTICLE_AD_PLACEMENTS = [
  'article_top',
  'home_top',
  'category',
  'article_mid',
  'article_inline_second',
  'article_before_comments',
  'article_bottom',
  'article_sidebar',
  'home_mid',
  'article_sidebar_bottom',
  'global_top',
  'global_bottom',
  'footer',
];

function placementAds(ads, placements, excludeIds = new Set()) {
  for (const placement of placements) {
    const matches = ads.filter((ad) => ad.placement === placement && !excludeIds.has(ad.id));
    if (matches.length) return matches;
  }
  return [];
}

const articlePage = asyncHandler(async (req, res) => {
  const lang = LANGS.includes(req.params.lang) ? req.params.lang : 'en';
  const base = baseUrl(req);
  const [article, categories] = await Promise.all([
    getPublicArticleBySlug(lang, req.params.slug),
    getPublicCategories(lang),
  ]);

  if (!article) {
    res
      .status(404)
      .type('html')
      .send(renderNotFound({ lang, base, categories }));
    return;
  }

  const scope = {
    categorySlug: article.category_slug,
    districtSlug: article.district_slug,
    path: req.path,
  };
  const [latest, trending, breakingArticles, allAds, shareSettings] = await Promise.all([
    listCards({ lang, limit: 6 }),
    listCards({ lang, limit: 6, sort: 'trending' }),
    listCards({ lang, limit: 8, breaking: true }),
    activeAds(ARTICLE_AD_PLACEMENTS, scope),
    loadShareSettings(),
  ]);

  const topAdList = placementAds(allAds, ['article_top', 'home_top', 'category']);
  const usedIds = new Set(topAdList.map((ad) => ad.id));
  const sideAdList = placementAds(allAds, ['article_sidebar', 'home_mid'], usedIds);
  sideAdList.forEach((ad) => usedIds.add(ad.id));
  const midAdList = placementAds(allAds, ['article_mid'], usedIds);
  midAdList.forEach((ad) => usedIds.add(ad.id));
  const inlineSecondAdList = placementAds(allAds, ['article_inline_second'], usedIds);
  inlineSecondAdList.forEach((ad) => usedIds.add(ad.id));
  const beforeCommentsAdList = placementAds(allAds, ['article_before_comments'], usedIds);
  beforeCommentsAdList.forEach((ad) => usedIds.add(ad.id));
  const bottomAdList = placementAds(allAds, ['article_bottom'], usedIds);
  bottomAdList.forEach((ad) => usedIds.add(ad.id));
  const sideBottomAdList = placementAds(allAds, ['article_sidebar_bottom'], usedIds);
  sideBottomAdList.forEach((ad) => usedIds.add(ad.id));
  const footerAdList = placementAds(allAds, ['footer'], usedIds);
  const globalTopAdList = placementAds(allAds, ['global_top']);
  const globalBottomAdList = placementAds(allAds, ['global_bottom']);

  res
    .set('Cache-Control', 'public, max-age=60, s-maxage=600')
    .type('html')
    .send(
      renderArticlePage(article, {
        lang,
        base,
        categories,
        trending,
        latest: breakingArticles.length ? breakingArticles : latest,
        adsTop: topAdList,
        adsMid: midAdList,
        adsInlineSecond: inlineSecondAdList,
        adsBeforeComments: beforeCommentsAdList,
        adsBottom: bottomAdList,
        adsSide: sideAdList,
        adsSideBottom: sideBottomAdList,
        adsGlobalTop: globalTopAdList,
        adsGlobalBottom: globalBottomAdList,
        adsFooter: footerAdList,
        shareSettings,
      })
    );
});

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const sitemap = asyncHandler(async (req, res) => {
  const base = baseUrl(req);
  const { rows } = await query(
    `SELECT a.id, a.updated_at, t.language, t.slug, t.published_at
       FROM articles a
       JOIN article_translations t ON t.article_id = a.id AND t.status = 'published'
      WHERE a.status <> 'archived'
      ORDER BY a.updated_at DESC`
  );
  const stories = new Map();
  for (const row of rows) {
    if (!stories.has(row.id)) {
      stories.set(row.id, { updated_at: row.updated_at, translations: [] });
    }
    stories.get(row.id).translations.push(row);
  }
  const entries = [];
  for (const story of stories.values()) {
    for (const t of story.translations) {
      const loc = `${base}/${t.language}/news/${encodeURIComponent(t.slug)}`;
      const alternates = story.translations
        .filter((x) => x.language !== t.language)
        .map(
          (x) =>
            `    <xhtml:link rel="alternate" hreflang="${x.language}" href="${xmlEscape(
              `${base}/${x.language}/news/${encodeURIComponent(x.slug)}`
            )}" />`
        )
        .join('\n');
      entries.push(
        `  <url>
    <loc>${xmlEscape(loc)}</loc>
    <lastmod>${new Date(story.updated_at).toISOString()}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
${alternates}
  </url>`
      );
    }
  }
  const categories = await query('SELECT slug FROM categories WHERE is_active');
  for (const cat of categories.rows) {
    entries.push(
      `  <url>\n    <loc>${xmlEscape(`${base}/category/${cat.slug}`)}</loc>\n    <changefreq>daily</changefreq>\n    <priority>0.6</priority>\n  </url>`
    );
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries.join('\n')}
</urlset>`;
  res.type('application/xml').send(xml);
});

const robots = asyncHandler(async (req, res) => {
  const base = baseUrl(req);
  res
    .type('text/plain')
    .send(`User-agent: *
Allow: /
Disallow: /api/
Disallow: /dashboard
Disallow: /admin/
Disallow: /login
Disallow: /register

Sitemap: ${base}/sitemap.xml
`);
});

module.exports = { articlePage, sitemap, robots };
