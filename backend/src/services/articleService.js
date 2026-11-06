const { query } = require('../db');
const { imageUrl } = require('./imageService');

const CARD_COLUMNS = `
  a.id, a.is_featured, a.is_sponsored, a.is_breaking, a.sponsor_label, a.view_count,
  a.published_at, a.created_at,
  t.id AS translation_id, t.language, t.headline, t.summary, t.slug,
  t.published_at AS translation_published_at,
  c.name_en AS category_name_en, c.name_kn AS category_name_kn, c.slug AS category_slug,
  d.name_en AS district_name_en, d.name_kn AS district_name_kn, d.slug AS district_slug,
  ai.image_id AS main_image_id,
  u.name AS author_name`;

const CARD_JOINS = `
  JOIN article_translations t ON t.article_id = a.id AND t.language = $1 AND t.status = 'published'
  LEFT JOIN categories c ON c.id = a.category_id
  LEFT JOIN districts d ON d.id = a.district_id
  LEFT JOIN article_images ai ON ai.article_id = a.id AND ai.image_type = 'main'
  JOIN users u ON u.id = a.author_id`;

function serializeCard(row, lang) {
  const localized = lang === 'kn';
  return {
    id: row.id,
    translation_id: row.translation_id,
    language: row.language,
    headline: row.headline,
    summary: row.summary,
    slug: row.slug,
    url: `/${lang}/news/${row.slug}`,
    published_at: row.translation_published_at || row.published_at,
    view_count: Number(row.view_count || 0),
    is_featured: row.is_featured,
    is_sponsored: row.is_sponsored,
    is_breaking: row.is_breaking,
    sponsor_label: row.sponsor_label,
    author_name: row.author_name,
    category: row.category_slug
      ? {
          slug: row.category_slug,
          name: localized ? row.category_name_kn : row.category_name_en,
        }
      : null,
    district: row.district_slug
      ? {
          slug: row.district_slug,
          name: localized ? row.district_name_kn : row.district_name_en,
        }
      : null,
    image: row.main_image_id
      ? {
          id: row.main_image_id,
          thumb: imageUrl(row.main_image_id, 'thumb'),
          optimized: imageUrl(row.main_image_id, 'optimized'),
        }
      : null,
  };
}

async function listCards({
  lang = 'en',
  limit = 12,
  offset = 0,
  categorySlug,
  districtSlug,
  q,
  featured,
  breaking,
  sort = 'latest',
}) {
  const params = [lang];
  const where = ["a.status <> 'archived'"];
  if (categorySlug) {
    params.push(categorySlug);
    where.push(`c.slug = $${params.length}`);
  }
  if (districtSlug) {
    params.push(districtSlug);
    where.push(`d.slug = $${params.length}`);
  }
  if (featured === true) where.push('a.is_featured = TRUE');
  if (breaking === true) where.push('a.is_breaking = TRUE');
  if (q) {
    params.push(`%${q}%`);
    where.push(
      `(t.headline ILIKE $${params.length} OR t.summary ILIKE $${params.length} OR t.content ILIKE $${params.length})`
    );
  }
  const order =
    sort === 'trending'
      ? 'a.view_count DESC, t.published_at DESC'
      : 't.published_at DESC';
  params.push(Math.min(Number(limit) || 12, 50), Math.max(Number(offset) || 0, 0));
  const sql = `
    SELECT ${CARD_COLUMNS}
      FROM articles a ${CARD_JOINS}
     WHERE ${where.join(' AND ')}
     ORDER BY ${order}
     LIMIT $${params.length - 1} OFFSET $${params.length}`;
  const { rows } = await query(sql, params);
  return rows.map((row) => serializeCard(row, lang));
}

async function countCards({ lang = 'en', categorySlug, districtSlug, q }) {
  const params = [lang];
  const where = ["a.status <> 'archived'"];
  if (categorySlug) {
    params.push(categorySlug);
    where.push(`c.slug = $${params.length}`);
  }
  if (districtSlug) {
    params.push(districtSlug);
    where.push(`d.slug = $${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    where.push(
      `(t.headline ILIKE $${params.length} OR t.summary ILIKE $${params.length} OR t.content ILIKE $${params.length})`
    );
  }
  const { rows } = await query(
    `SELECT COUNT(*)::int AS total
       FROM articles a ${CARD_JOINS}
      WHERE ${where.join(' AND ')}`,
    params
  );
  return rows[0].total;
}

async function getPublicArticleBySlug(lang, slug) {
  const { rows } = await query(
    `SELECT a.id, a.category_id, a.district_id, a.taluk_id, a.status,
            a.is_featured, a.is_sponsored, a.sponsor_label, a.view_count,
            a.published_at, a.created_at, a.updated_at,
            t.id AS translation_id, t.language, t.headline, t.summary, t.content,
            t.slug, t.source, t.caption, t.seo_title, t.seo_description,
            t.status AS translation_status, t.published_at AS translation_published_at,
            c.name_en AS category_name_en, c.name_kn AS category_name_kn, c.slug AS category_slug,
            d.name_en AS district_name_en, d.name_kn AS district_name_kn, d.slug AS district_slug,
            tl.name_en AS taluk_name_en, tl.name_kn AS taluk_name_kn,
            u.name AS author_name, ai.image_id AS main_image_id
       FROM article_translations t
       JOIN articles a ON a.id = t.article_id
       LEFT JOIN categories c ON c.id = a.category_id
       LEFT JOIN districts d ON d.id = a.district_id
       LEFT JOIN taluks tl ON tl.id = a.taluk_id
       LEFT JOIN article_images ai ON ai.article_id = a.id AND ai.image_type = 'main'
       JOIN users u ON u.id = a.author_id
      WHERE t.slug = $1 AND t.language = $2 AND t.status = 'published'
        AND a.status <> 'archived'
      LIMIT 1`,
    [slug, lang]
  );
  const article = rows[0];
  if (!article) return null;

  const [images, tags, alternates, related] = await Promise.all([
    query(
      `SELECT i.id, ai.image_type, ai.position, ai.caption, i.width, i.height
         FROM article_images ai JOIN images i ON i.id = ai.image_id
        WHERE ai.article_id = $1 ORDER BY ai.image_type DESC, ai.position`,
      [article.id]
    ),
    query(
      `SELECT tg.name FROM article_tags at JOIN tags tg ON tg.id = at.tag_id
        WHERE at.article_id = $1 ORDER BY tg.name`,
      [article.id]
    ),
    query(
      `SELECT language, slug FROM article_translations
        WHERE article_id = $1 AND status = 'published' AND language <> $2`,
      [article.id, lang]
    ),
    listCards({ lang, limit: 4, categorySlug: article.category_slug }),
  ]);

  return {
    ...article,
    view_count: Number(article.view_count || 0),
    images: images.rows.map((img) => ({
      ...img,
      url: imageUrl(img.id, 'optimized'),
      thumb: imageUrl(img.id, 'thumb'),
    })),
    tags: tags.rows.map((t) => t.name),
    alternates: alternates.rows,
    related: related.filter((r) => r.id !== article.id).slice(0, 3),
  };
}

async function getArticleForEditor(id) {
  const { rows } = await query(
    `SELECT a.*, u.name AS author_name, u.email AS author_email,
            c.name_en AS category_name_en, c.name_kn AS category_name_kn, c.slug AS category_slug,
            d.name_en AS district_name_en, d.name_kn AS district_name_kn, d.slug AS district_slug
       FROM articles a
       JOIN users u ON u.id = a.author_id
       LEFT JOIN categories c ON c.id = a.category_id
       LEFT JOIN districts d ON d.id = a.district_id
      WHERE a.id = $1`,
    [id]
  );
  const article = rows[0];
  if (!article) return null;

  const [translations, images, tags, reviews, revisions] = await Promise.all([
    query(
      `SELECT t.*, u.name AS reviewer_name
         FROM article_translations t
         LEFT JOIN users u ON u.id = t.reviewer_id
        WHERE t.article_id = $1 ORDER BY t.language`,
      [id]
    ),
    query(
      `SELECT i.id, ai.image_type, ai.position, ai.caption, i.width, i.height,
              i.original_filename
         FROM article_images ai JOIN images i ON i.id = ai.image_id
        WHERE ai.article_id = $1 ORDER BY ai.image_type DESC, ai.position`,
      [id]
    ),
    query(
      `SELECT tg.id, tg.name FROM article_tags at JOIN tags tg ON tg.id = at.tag_id
        WHERE at.article_id = $1 ORDER BY tg.name`,
      [id]
    ),
    query(
      `SELECT r.*, u.name AS reviewer_name FROM article_reviews r
         LEFT JOIN users u ON u.id = r.reviewer_id
        WHERE r.article_id = $1 ORDER BY r.created_at DESC`,
      [id]
    ),
    query(
      `SELECT rv.id, rv.translation_id, rv.snapshot, rv.note, rv.created_at,
              u.name AS editor_name
         FROM article_revisions rv LEFT JOIN users u ON u.id = rv.editor_id
        WHERE rv.article_id = $1 ORDER BY rv.created_at DESC LIMIT 20`,
      [id]
    ),
  ]);

  return {
    ...article,
    view_count: Number(article.view_count || 0),
    translations: translations.rows,
    images: images.rows.map((img) => ({
      ...img,
      url: imageUrl(img.id, 'thumb'),
    })),
    tags: tags.rows,
    reviews: reviews.rows,
    revisions: revisions.rows,
  };
}

async function getPublicCategories(lang = 'en') {
  const { rows } = await query(
    `SELECT id, name_en, name_kn, slug FROM categories WHERE is_active = TRUE ORDER BY sort_order, name_en`
  );
  return rows.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: lang === 'kn' ? c.name_kn : c.name_en,
    name_en: c.name_en,
    name_kn: c.name_kn,
  }));
}

async function getPublicDistricts(lang = 'en') {
  const { rows } = await query(
    `SELECT id, name_en, name_kn, slug FROM districts WHERE is_active = TRUE ORDER BY name_en`
  );
  return rows.map((d) => ({
    id: d.id,
    slug: d.slug,
    name: lang === 'kn' ? d.name_kn : d.name_en,
    name_en: d.name_en,
    name_kn: d.name_kn,
  }));
}

module.exports = {
  listCards,
  countCards,
  getPublicArticleBySlug,
  getArticleForEditor,
  getPublicCategories,
  getPublicDistricts,
  serializeCard,
};
