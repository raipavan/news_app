const { query } = require('../db');
const { asyncHandler, ApiError } = require('../utils/errors');
const {
  listCards,
  countCards,
  getPublicArticleBySlug,
  getPublicCategories,
  getPublicDistricts,
} = require('../services/articleService');
const { activeAds, resolveClickDestination } = require('../services/adService');

const LANGS = ['kn', 'en'];

function langOf(req) {
  return LANGS.includes(req.query.lang) ? req.query.lang : 'en';
}

const home = asyncHandler(async (req, res) => {
  const lang = langOf(req);
  const [featured, latest, trending, breaking, categories, districts, ads] = await Promise.all([
    listCards({ lang, limit: 5, featured: true }),
    listCards({ lang, limit: 12 }),
    listCards({ lang, limit: 6, sort: 'trending' }),
    listCards({ lang, limit: 8, breaking: true }),
    getPublicCategories(lang),
    getPublicDistricts(lang),
    activeAds(
      [
        'home_top',
        'home_mid',
        'home_sidebar',
        'home_bottom',
        'home_hero',
        'home_after_latest',
        'home_between_sections',
      ],
      { path: '/' }
    ),
  ]);

  const featuredFill = featured.length >= 3 ? featured : latest.slice(0, 5);
  const categorySections = [];
  for (const category of categories.slice(0, 8)) {
    const items = await listCards({ lang, limit: 4, categorySlug: category.slug });
    if (items.length) categorySections.push({ category, items });
  }

  res.json({
    lang,
    ticker: (breaking.length ? breaking : latest.slice(0, 6)).map((item) => ({
      headline: item.headline,
      url: item.url,
    })),
    featured: featuredFill,
    latest,
    trending,
    categories,
    districts,
    categorySections,
    ads,
  });
});

const latest = asyncHandler(async (req, res) => {
  const lang = langOf(req);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 30);
  const params = { lang, limit, offset: (page - 1) * limit };
  const [items, total] = await Promise.all([listCards(params), countCards({ lang })]);
  res.json({ items, total, page, limit });
});

const trending = asyncHandler(async (req, res) => {
  const lang = langOf(req);
  const limit = Math.min(Number(req.query.limit) || 8, 20);
  const items = await listCards({ lang, limit, sort: 'trending' });
  res.json({ items });
});

const search = asyncHandler(async (req, res) => {
  const lang = langOf(req);
  const q = String(req.query.q || '').trim().slice(0, 120);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 30);
  if (!q) return res.json({ items: [], total: 0, page, limit, q });
  const filters = {
    lang,
    q,
    limit,
    offset: (page - 1) * limit,
    categorySlug: req.query.category || undefined,
    districtSlug: req.query.district || undefined,
  };
  const [items, total] = await Promise.all([
    listCards(filters),
    countCards({
      lang,
      q,
      categorySlug: filters.categorySlug,
      districtSlug: filters.districtSlug,
    }),
  ]);
  res.json({ items, total, page, limit, q });
});

const category = asyncHandler(async (req, res) => {
  const lang = langOf(req);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 30);
  const cat = await query('SELECT * FROM categories WHERE slug = $1 AND is_active', [req.params.slug]);
  if (!cat.rows[0]) throw new ApiError(404, 'Category not found', 'NOT_FOUND');
  const row = cat.rows[0];
  const filters = { lang, categorySlug: req.params.slug, limit, offset: (page - 1) * limit };
  const [items, total] = await Promise.all([
    listCards(filters),
    countCards({ lang, categorySlug: req.params.slug }),
  ]);
  res.json({
    category: {
      slug: row.slug,
      name: lang === 'kn' ? row.name_kn : row.name_en,
      name_en: row.name_en,
      name_kn: row.name_kn,
    },
    items,
    total,
    page,
    limit,
  });
});

const district = asyncHandler(async (req, res) => {
  const lang = langOf(req);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 30);
  const d = await query('SELECT * FROM districts WHERE slug = $1', [req.params.slug]);
  if (!d.rows[0]) throw new ApiError(404, 'District not found', 'NOT_FOUND');
  const row = d.rows[0];
  const filters = { lang, districtSlug: req.params.slug, limit, offset: (page - 1) * limit };
  const [items, total] = await Promise.all([
    listCards(filters),
    countCards({ lang, districtSlug: req.params.slug }),
  ]);
  res.json({
    district: {
      slug: row.slug,
      name: lang === 'kn' ? row.name_kn : row.name_en,
      name_en: row.name_en,
      name_kn: row.name_kn,
    },
    items,
    total,
    page,
    limit,
  });
});

const newsBySlug = asyncHandler(async (req, res) => {
  const lang = langOf(req);
  const article = await getPublicArticleBySlug(lang, req.params.slug);
  if (!article) throw new ApiError(404, 'Article not found', 'NOT_FOUND');
  res.json({ article });
});

const related = asyncHandler(async (req, res) => {
  const lang = langOf(req);
  const row = await query('SELECT category_id FROM articles WHERE id = $1', [req.params.id]);
  if (!row.rows[0]) throw new ApiError(404, 'Article not found', 'NOT_FOUND');
  const cat = await query('SELECT slug FROM categories WHERE id = $1', [row.rows[0].category_id]);
  const items = await listCards({
    lang,
    limit: 4,
    categorySlug: cat.rows[0]?.slug,
  });
  res.json({ items: items.filter((i) => i.id !== req.params.id).slice(0, 3) });
});

const taluks = asyncHandler(async (req, res) => {
  const lang = langOf(req);
  const d = await query('SELECT id FROM districts WHERE slug = $1', [req.params.slug]);
  if (!d.rows[0]) throw new ApiError(404, 'District not found', 'NOT_FOUND');
  const { rows } = await query(
    'SELECT id, name_en, name_kn FROM taluks WHERE district_id = $1 ORDER BY name_en',
    [d.rows[0].id]
  );
  res.json({
    items: rows.map((row) => ({
      id: row.id,
      name: lang === 'kn' ? row.name_kn : row.name_en,
      name_en: row.name_en,
      name_kn: row.name_kn,
    })),
  });
});

const categories = asyncHandler(async (req, res) => {
  res.json({ items: await getPublicCategories(langOf(req)) });
});

const districts = asyncHandler(async (req, res) => {
  res.json({ items: await getPublicDistricts(langOf(req)) });
});

const ads = asyncHandler(async (req, res) => {
  const placement = req.query.placement ? String(req.query.placement) : null;
  const categorySlug = req.query.category ? String(req.query.category) : null;
  const districtSlug = req.query.district ? String(req.query.district) : null;
  const path = req.query.path ? String(req.query.path).slice(0, 300) : null;
  const allowed = [
    'home_top',
    'home_mid',
    'home_sidebar',
    'home_bottom',
    'home_hero',
    'home_after_latest',
    'home_between_sections',
    'article_top',
    'article_mid',
    'article_inline_second',
    'article_before_comments',
    'article_bottom',
    'article_sidebar',
    'article_sidebar_bottom',
    'category',
    'category_bottom',
    'latest_top',
    'latest_bottom',
    'district_top',
    'district_bottom',
    'search_top',
    'search_bottom',
    'global_top',
    'global_bottom',
    'footer',
  ];
  if (placement && !allowed.includes(placement)) {
    throw new ApiError(422, 'Unknown placement', 'VALIDATION');
  }
  res.json({
    items: await activeAds(allowed, { placement, categorySlug, districtSlug, path }),
  });
});

const adImpression = asyncHandler(async (req, res) => {
  await query('INSERT INTO ad_impressions(advertisement_id, visitor_hash) VALUES ($1, $2)', [
    req.params.id,
    String(req.body?.visitor_id || '').slice(0, 120) || null,
  ]);
  res.status(204).end();
});

const adClick = asyncHandler(async (req, res) => {
  const placement = req.query.placement ? String(req.query.placement) : null;
  const destination = await resolveClickDestination(req.params.id, placement);
  if (!destination) throw new ApiError(404, 'Advertisement not found', 'NOT_FOUND');
  const visitorId = String(req.query.visitor_id || '').slice(0, 120) || null;
  await query('INSERT INTO ad_clicks(advertisement_id, visitor_id) VALUES ($1, $2)', [
    req.params.id,
    visitorId,
  ]);
  res.redirect(302, destination);
});

const ticker = asyncHandler(async (req, res) => {
  const lang = langOf(req);
  const breaking = await listCards({ lang, limit: 8, breaking: true });
  const items = breaking.length ? breaking : await listCards({ lang, limit: 8 });
  res.json({ items: items.map((i) => ({ headline: i.headline, url: i.url })) });
});

module.exports = {
  home,
  latest,
  trending,
  search,
  category,
  district,
  taluks,
  newsBySlug,
  related,
  categories,
  districts,
  ads,
  adImpression,
  adClick,
  ticker,
};
