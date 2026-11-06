const { z } = require('zod');
const { query, one, tx } = require('../db');
const { ApiError, asyncHandler } = require('../utils/errors');
const { slugify, uniqueSlug } = require('../utils/slug');
const { cleanArticleHtml, cleanText } = require('../utils/sanitize');
const { audit } = require('../utils/audit');
const { isStaff } = require('../utils/permissions');
const {
  getArticleForEditor,
  listCards,
  countCards,
} = require('../services/articleService');

const LANGS = ['kn', 'en'];

const translationFields = {
  headline: z.string().trim().min(5).max(300),
  summary: z.string().trim().max(2000).optional().default(''),
  content: z.string().min(20),
  slug: z.string().trim().max(350).optional(),
  source: z.string().trim().max(1000).optional().nullable(),
  caption: z.string().trim().max(1000).optional().nullable(),
  seo_title: z.string().trim().max(300).optional().nullable(),
  seo_description: z.string().trim().max(600).optional().nullable(),
};

const createSchema = z.object({
  language: z.enum(LANGS),
  ...translationFields,
  category_id: z.string().uuid(),
  district_id: z.coerce.number().int().positive().optional().nullable(),
  taluk_id: z.coerce.number().int().positive().optional().nullable(),
  tags: z.array(z.string().trim().max(60)).max(12).optional().default([]),
  main_image_id: z.string().uuid().optional().nullable(),
  image_ids: z.array(z.string().uuid()).max(8).optional().default([]),
  is_featured: z.boolean().optional().default(false),
  is_sponsored: z.boolean().optional().default(false),
  is_breaking: z.boolean().optional().default(false),
  sponsor_label: z.string().trim().max(150).optional().nullable(),
  submit: z.boolean().optional().default(false),
});

const updateSchema = z.object({
  language: z.enum(LANGS).optional(),
  headline: z.string().trim().min(5).max(300).optional(),
  summary: z.string().trim().max(2000).optional(),
  content: z.string().min(20).optional(),
  slug: z.string().trim().max(350).optional(),
  source: z.string().trim().max(1000).optional().nullable(),
  caption: z.string().trim().max(1000).optional().nullable(),
  seo_title: z.string().trim().max(300).optional().nullable(),
  seo_description: z.string().trim().max(600).optional().nullable(),
  category_id: z.string().uuid().optional(),
  district_id: z.coerce.number().int().positive().optional().nullable(),
  taluk_id: z.coerce.number().int().positive().optional().nullable(),
  tags: z.array(z.string().trim().max(60)).max(12).optional(),
  main_image_id: z.string().uuid().optional().nullable(),
  image_ids: z.array(z.string().uuid()).max(8).optional(),
  is_featured: z.boolean().optional(),
  is_sponsored: z.boolean().optional(),
  is_breaking: z.boolean().optional(),
  sponsor_label: z.string().trim().max(150).optional().nullable(),
});

function canEditArticle(user, article, translation) {
  if (isStaff(user)) return true;
  if (article.author_id !== user.id) return false;
  if (!translation) return false;
  if (translation.status === 'published') return false;
  return ['draft', 'rejected'].includes(translation.status);
}

function assertOwnershipOrStaff(user, article) {
  if (isStaff(user) || article.author_id === user.id) return;
  throw new ApiError(403, 'You can only work on your own articles', 'FORBIDDEN');
}

async function syncArticleStatus(db, articleId) {
  const { rows } = await db.query(
    'SELECT status FROM article_translations WHERE article_id = $1',
    [articleId]
  );
  const current = await db.query('SELECT status, published_at FROM articles WHERE id = $1', [articleId]);
  if (!current.rows[0] || current.rows[0].status === 'archived') return;
  const statuses = rows.map((r) => r.status);
  let next = 'draft';
  let publishedAt = current.rows[0].published_at;
  if (statuses.includes('published')) {
    next = 'published';
  } else if (statuses.includes('submitted') || statuses.includes('in_review')) {
    next = 'submitted';
  } else if (statuses.includes('approved')) {
    next = 'approved';
  } else if (statuses.length && statuses.every((s) => s === 'rejected')) {
    next = 'rejected';
  }
  if (next === 'published' && !publishedAt) publishedAt = new Date();
  await db.query(
    'UPDATE articles SET status = $1, published_at = COALESCE($2, published_at), updated_at = NOW() WHERE id = $3',
    [next, publishedAt, articleId]
  );
}

async function attachImages(db, articleId, userId, user, mainImageId, imageIds) {
  const ids = [...new Set([mainImageId, ...(imageIds || [])].filter(Boolean))];
  if (ids.length) {
    const { rows } = await db.query(
      `SELECT id, uploaded_by FROM images WHERE id = ANY($1::uuid[]) AND variant = 'original'`,
      [ids]
    );
    const allowed = rows.filter((img) => isStaff(user) || img.uploaded_by === userId);
    if (allowed.length !== ids.length) {
      throw new ApiError(422, 'One or more images are unavailable', 'INVALID_IMAGE');
    }
  }
  if (mainImageId !== undefined) {
    await db.query(
      `DELETE FROM article_images WHERE article_id = $1 AND image_type = 'main'`,
      [articleId]
    );
    if (mainImageId) {
      await db.query(
        `INSERT INTO article_images(article_id, image_id, image_type, position)
         VALUES ($1, $2, 'main', 0)`,
        [articleId, mainImageId]
      );
    }
  }
  if (Array.isArray(imageIds)) {
    const keep = imageIds.filter((id) => id && id !== mainImageId);
    await db.query(
      `DELETE FROM article_images
        WHERE article_id = $1 AND image_type = 'gallery'
          AND image_id <> ALL($2::uuid[])`,
      [articleId, keep]
    );
    let position = 1;
    for (const id of keep) {
      await db.query(
        `INSERT INTO article_images(article_id, image_id, image_type, position)
         VALUES ($1, $2, 'gallery', $3) ON CONFLICT DO NOTHING`,
        [articleId, id, position]
      );
      position += 1;
    }
  }
}

async function replaceTags(db, articleId, tags) {
  if (!Array.isArray(tags)) return;
  await db.query('DELETE FROM article_tags WHERE article_id = $1', [articleId]);
  for (const raw of tags) {
    const name = cleanText(raw, 60).toLowerCase();
    if (!name) continue;
    const tag = await db.query(
      `INSERT INTO tags(name) VALUES ($1)
       ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
      [name]
    );
    await db.query(
      `INSERT INTO article_tags(article_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [articleId, tag.rows[0].id]
    );
  }
}

async function resolveSlug(db, desired, headline, excludeId) {
  const base = slugify(desired || headline, 'karnataka-news');
  return uniqueSlug(db, 'article_translations', base, excludeId);
}

async function assertTaxonomy(db, categoryId, districtId, talukId) {
  if (categoryId) {
    const c = await db.query('SELECT 1 FROM categories WHERE id = $1 AND is_active', [categoryId]);
    if (!c.rowCount) throw new ApiError(422, 'Category not found', 'INVALID_CATEGORY');
  }
  if (districtId) {
    const d = await db.query('SELECT 1 FROM districts WHERE id = $1', [districtId]);
    if (!d.rowCount) throw new ApiError(422, 'District not found', 'INVALID_DISTRICT');
  }
  if (talukId) {
    const t = await db.query('SELECT district_id FROM taluks WHERE id = $1', [talukId]);
    if (!t.rowCount) throw new ApiError(422, 'Taluk not found', 'INVALID_TALUK');
    if (districtId && t.rows[0].district_id !== districtId) {
      throw new ApiError(422, 'Taluk does not belong to the selected district', 'INVALID_TALUK');
    }
  }
}

const createArticle = asyncHandler(async (req, res) => {
  const data = createSchema.parse(req.body);
  const user = req.user;
  const articleId = await tx(async (client) => {
    await assertTaxonomy(client, data.category_id, data.district_id, data.taluk_id);
    const slug = await resolveSlug(client, data.slug, data.headline, null);
    const article = await client.query(
      `INSERT INTO articles(author_id, category_id, district_id, taluk_id, is_featured, is_sponsored, is_breaking, sponsor_label)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [
        user.id,
        data.category_id,
        data.district_id || null,
        data.taluk_id || null,
        isStaff(user) ? data.is_featured : false,
        isStaff(user) ? data.is_sponsored : false,
        isStaff(user) ? data.is_breaking : false,
        isStaff(user) ? data.sponsor_label || null : null,
      ]
    );
    const id = article.rows[0].id;
    await client.query(
      `INSERT INTO article_translations(article_id, language, headline, summary, content, slug,
          source, caption, seo_title, seo_description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        id,
        data.language,
        cleanText(data.headline, 300),
        cleanText(data.summary, 2000),
        cleanArticleHtml(data.content),
        slug,
        data.source || null,
        data.caption || null,
        data.seo_title || null,
        data.seo_description || null,
      ]
    );
    await attachImages(client, id, user.id, user, data.main_image_id, data.image_ids);
    await replaceTags(client, id, data.tags);

    if (data.submit) {
      const translation = await client.query(
        'SELECT id FROM article_translations WHERE article_id = $1 AND language = $2',
        [id, data.language]
      );
      await client.query(
        `UPDATE article_translations
            SET status = 'submitted', submitted_at = NOW(), updated_at = NOW()
          WHERE id = $1`,
        [translation.rows[0].id]
      );
      await client.query(`UPDATE articles SET status = 'submitted', updated_at = NOW() WHERE id = $1`, [id]);
      await audit(client, user.id, 'article.submitted', 'article', id, { language: data.language });
    }
    await audit(client, user.id, 'article.created', 'article', id, {
      language: data.language,
      submit: data.submit,
    });
    return id;
  });

  const article = await getArticleForEditor(articleId);
  res.status(201).json({ article });
});

const listArticles = asyncHandler(async (req, res) => {
  const user = req.user;
  const status = req.query.status ? String(req.query.status) : null;
  const mine = req.query.mine === 'true' || !isStaff(user);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
  const params = [];
  const where = [];
  if (mine) {
    params.push(user.id);
    where.push(`a.author_id = $${params.length}`);
  }
  if (status) {
    params.push(status);
    where.push(`a.status = $${params.length}`);
  }
  if (req.query.language) {
    params.push(req.query.language);
    where.push(`EXISTS (SELECT 1 FROM article_translations x WHERE x.article_id = a.id AND x.language = $${params.length})`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  params.push(limit, (page - 1) * limit);
  const { rows } = await query(
    `SELECT a.id, a.status, a.is_featured, a.is_sponsored, a.created_at, a.updated_at,
            a.published_at, a.view_count, a.author_id, u.name AS author_name,
            c.name_en AS category_name_en, c.name_kn AS category_name_kn, c.slug AS category_slug,
            d.name_en AS district_name_en, d.name_kn AS district_name_kn,
            json_agg(json_build_object(
              'id', t.id, 'language', t.language, 'headline', t.headline,
              'slug', t.slug, 'status', t.status,
              'rejection_reason', t.rejection_reason,
              'submitted_at', t.submitted_at, 'published_at', t.published_at
            ) ORDER BY t.language) AS translations,
            (SELECT ai.image_id FROM article_images ai
              WHERE ai.article_id = a.id AND ai.image_type = 'main' LIMIT 1) AS main_image_id
       FROM articles a
       JOIN users u ON u.id = a.author_id
       LEFT JOIN categories c ON c.id = a.category_id
       LEFT JOIN districts d ON d.id = a.district_id
       LEFT JOIN article_translations t ON t.article_id = a.id
       ${whereSql}
      GROUP BY a.id, u.name, c.name_en, c.name_kn, c.slug, d.name_en, d.name_kn
      ORDER BY a.updated_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  const total = await query(
    `SELECT COUNT(*)::int AS total FROM articles a ${whereSql}`,
    params.slice(0, params.length - 2)
  );
  res.json({ items: rows, total: total.rows[0].total, page, limit });
});

const getArticle = asyncHandler(async (req, res) => {
  const article = await getArticleForEditor(req.params.id);
  if (!article) throw new ApiError(404, 'Article not found', 'NOT_FOUND');
  assertOwnershipOrStaff(req.user, article);
  res.json({ article });
});

const getArticleBySlug = asyncHandler(async (req, res) => {
  const lang = LANGS.includes(req.query.lang) ? req.query.lang : 'en';
  const { getPublicArticleBySlug } = require('../services/articleService');
  const article = await getPublicArticleBySlug(lang, req.params.slug);
  if (!article) throw new ApiError(404, 'Article not found', 'NOT_FOUND');
  res.json({ article });
});

const updateArticle = asyncHandler(async (req, res) => {
  const data = updateSchema.parse(req.body);
  const user = req.user;
  const existing = await one(
    'SELECT id, author_id, status, district_id, taluk_id FROM articles WHERE id = $1',
    [req.params.id]
  );
  if (!existing) throw new ApiError(404, 'Article not found', 'NOT_FOUND');

  const translations = await query(
    'SELECT * FROM article_translations WHERE article_id = $1 ORDER BY language',
    [req.params.id]
  );
  const lang = data.language || translations.rows[0]?.language;
  const translation = translations.rows.find((t) => t.language === lang);
  if (!translation) throw new ApiError(404, 'Translation not found', 'NOT_FOUND');

  const staff = isStaff(user);
  if (!staff) {
    if (existing.author_id !== user.id) {
      throw new ApiError(403, 'You can only edit your own articles', 'FORBIDDEN');
    }
    if (translation.status === 'published') {
      throw new ApiError(
        409,
        'Published articles cannot be edited directly. Submit a correction for editorial review.',
        'CORRECTION_REQUIRED'
      );
    }
    if (!['draft', 'rejected'].includes(translation.status)) {
      throw new ApiError(409, 'This article is under editorial review and cannot be edited', 'LOCKED');
    }
    if (
      data.is_featured !== undefined ||
      data.is_sponsored !== undefined ||
      data.is_breaking !== undefined
    ) {
      throw new ApiError(403, 'Only editors can change featured, sponsored or breaking status', 'FORBIDDEN');
    }
  }

  await tx(async (client) => {
    await assertTaxonomy(client, data.category_id, data.district_id, data.taluk_id);
    const snapshot = {
      headline: translation.headline,
      summary: translation.summary,
      content: translation.content,
      slug: translation.slug,
      status: translation.status,
    };
    await client.query(
      `INSERT INTO article_revisions(article_id, translation_id, snapshot, editor_id, note)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.params.id, translation.id, snapshot, user.id, staff ? 'Editor update' : 'Author update']
    );

    if (data.category_id || data.district_id !== undefined || data.taluk_id !== undefined) {
      await client.query(
        `UPDATE articles SET
           category_id = COALESCE($1, category_id),
           district_id = $2,
           taluk_id = $3,
           is_featured = COALESCE($4, is_featured),
           is_sponsored = COALESCE($5, is_sponsored),
           is_breaking = COALESCE($6, is_breaking),
           sponsor_label = COALESCE($7, sponsor_label),
           updated_at = NOW()
         WHERE id = $8`,
        [
          data.category_id || null,
          data.district_id === undefined ? existing.district_id : data.district_id,
          data.taluk_id === undefined ? existing.taluk_id : data.taluk_id,
          data.is_featured === undefined ? null : data.is_featured,
          data.is_sponsored === undefined ? null : data.is_sponsored,
          data.is_breaking === undefined ? null : data.is_breaking,
          data.sponsor_label === undefined ? null : data.sponsor_label,
          req.params.id,
        ]
      );
    } else if (
      data.is_featured !== undefined ||
      data.is_sponsored !== undefined ||
      data.is_breaking !== undefined
    ) {
      await client.query(
        `UPDATE articles SET is_featured = COALESCE($1, is_featured),
                is_sponsored = COALESCE($2, is_sponsored),
                is_breaking = COALESCE($3, is_breaking), updated_at = NOW()
          WHERE id = $4`,
        [
          data.is_featured === undefined ? null : data.is_featured,
          data.is_sponsored === undefined ? null : data.is_sponsored,
          data.is_breaking === undefined ? null : data.is_breaking,
          req.params.id,
        ]
      );
    }

    let slug = translation.slug;
    if (data.slug || data.headline) {
      const desired = data.slug || translation.slug;
      slug = await resolveSlug(client, desired, data.headline || translation.headline, translation.id);
    }
    await client.query(
      `UPDATE article_translations SET
         headline = $1, summary = $2, content = $3, slug = $4,
         source = $5, caption = $6, seo_title = $7, seo_description = $8,
         status = $9, updated_at = NOW()
       WHERE id = $10`,
      [
        data.headline ? cleanText(data.headline, 300) : translation.headline,
        data.summary !== undefined ? cleanText(data.summary, 2000) : translation.summary,
        data.content ? cleanArticleHtml(data.content) : translation.content,
        slug,
        data.source !== undefined ? data.source : translation.source,
        data.caption !== undefined ? data.caption : translation.caption,
        data.seo_title !== undefined ? data.seo_title : translation.seo_title,
        data.seo_description !== undefined ? data.seo_description : translation.seo_description,
        translation.status === 'rejected' ? 'rejected' : translation.status,
        translation.id,
      ]
    );

    if (data.main_image_id !== undefined || data.image_ids !== undefined) {
      await attachImages(client, req.params.id, user.id, user, data.main_image_id, data.image_ids);
    }
    if (data.tags) await replaceTags(client, req.params.id, data.tags);
    await syncArticleStatus(client, req.params.id);
    await audit(client, user.id, 'article.updated', 'article', req.params.id, { language: lang });
  });

  res.json({ article: await getArticleForEditor(req.params.id) });
});

const submitArticle = asyncHandler(async (req, res) => {
  const lang = req.body?.language;
  const article = await one('SELECT * FROM articles WHERE id = $1', [req.params.id]);
  if (!article) throw new ApiError(404, 'Article not found', 'NOT_FOUND');
  assertOwnershipOrStaff(req.user, article);
  const translation = await one(
    'SELECT * FROM article_translations WHERE article_id = $1 AND language = $2',
    [req.params.id, lang]
  );
  if (!translation) throw new ApiError(404, 'Translation not found', 'NOT_FOUND');
  if (!['draft', 'rejected'].includes(translation.status)) {
    throw new ApiError(409, 'Only drafts or rejected articles can be submitted', 'INVALID_STATE');
  }
  if (!translation.summary || translation.summary.length < 20) {
    throw new ApiError(422, 'Add a short description of at least 20 characters', 'INCOMPLETE_ARTICLE');
  }
  const main = await query(
    `SELECT 1 FROM article_images WHERE article_id = $1 AND image_type = 'main'`,
    [req.params.id]
  );
  if (!main.rowCount) {
    throw new ApiError(422, 'A main image is required before submitting', 'INCOMPLETE_ARTICLE');
  }
  await tx(async (client) => {
    await client.query(
      `UPDATE article_translations SET status = 'submitted', submitted_at = NOW(),
              rejection_reason = NULL, updated_at = NOW() WHERE id = $1`,
      [translation.id]
    );
    await syncArticleStatus(client, req.params.id);
    await audit(client, req.user.id, 'article.submitted', 'article', req.params.id, { language: lang });
  });
  res.json({ article: await getArticleForEditor(req.params.id) });
});

async function reviewTranslation(req, decision) {
  const lang = req.body?.language;
  const article = await one('SELECT * FROM articles WHERE id = $1', [req.params.id]);
  if (!article) throw new ApiError(404, 'Article not found', 'NOT_FOUND');
  const translation = await one(
    'SELECT * FROM article_translations WHERE article_id = $1 AND language = $2',
    [req.params.id, lang]
  );
  if (!translation) throw new ApiError(404, 'Translation not found', 'NOT_FOUND');
  if (translation.status === 'published') {
    throw new ApiError(409, 'This language version is already published', 'INVALID_STATE');
  }
  if (decision === 'approved') {
    if (!['submitted', 'in_review', 'rejected'].includes(translation.status)) {
      throw new ApiError(409, 'Only submitted articles can be approved', 'INVALID_STATE');
    }
  } else if (!['submitted', 'in_review', 'approved'].includes(translation.status)) {
    throw new ApiError(409, 'Only submitted or approved articles can be rejected', 'INVALID_STATE');
  }
  const comments = cleanText(req.body?.comments || req.body?.reason || '', 2000);
  if (decision === 'rejected' && !comments) {
    throw new ApiError(422, 'A rejection reason is required', 'REASON_REQUIRED');
  }
  await tx(async (client) => {
    await client.query(
      `UPDATE article_translations SET status = $1, reviewer_id = $2,
              rejection_reason = $3, updated_at = NOW() WHERE id = $4`,
      [decision, req.user.id, decision === 'rejected' ? comments : null, translation.id]
    );
    await client.query(
      `INSERT INTO article_reviews(article_id, translation_id, reviewer_id, decision, comments)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.params.id, translation.id, req.user.id, decision, comments || null]
    );
    await syncArticleStatus(client, req.params.id);
    await audit(client, req.user.id, `article.${decision}`, 'article', req.params.id, {
      language: lang,
      comments,
    });
  });
  return getArticleForEditor(req.params.id);
}

const approveArticle = asyncHandler(async (req, res) => {
  const article = await reviewTranslation(req, 'approved');
  res.json({ article });
});

const rejectArticle = asyncHandler(async (req, res) => {
  const article = await reviewTranslation(req, 'rejected');
  res.json({ article });
});

const publishArticle = asyncHandler(async (req, res) => {
  const lang = req.body?.language;
  const article = await one('SELECT * FROM articles WHERE id = $1', [req.params.id]);
  if (!article) throw new ApiError(404, 'Article not found', 'NOT_FOUND');
  const staff = isStaff(req.user);
  const canPublishOwn =
    article.author_id === req.user.id && req.user.can_publish && req.user.permissions.includes('article.publish_own');
  if (!staff && !canPublishOwn) {
    throw new ApiError(403, 'You are not allowed to publish this article', 'FORBIDDEN');
  }
  const translation = await one(
    'SELECT * FROM article_translations WHERE article_id = $1 AND language = $2',
    [req.params.id, lang]
  );
  if (!translation) throw new ApiError(404, 'Translation not found', 'NOT_FOUND');
  if (translation.status === 'published') {
    return res.json({ article: await getArticleForEditor(req.params.id) });
  }
  if (translation.status !== 'approved') {
    throw new ApiError(409, 'The language version must be approved before publishing', 'INVALID_STATE');
  }
  await tx(async (client) => {
    await client.query(
      `UPDATE article_translations SET status = 'published',
              published_at = COALESCE(published_at, NOW()), updated_at = NOW()
        WHERE id = $1`,
      [translation.id]
    );
    await client.query(
      `INSERT INTO article_reviews(article_id, translation_id, reviewer_id, decision, comments)
       VALUES ($1, $2, $3, 'published', $4)`,
      [req.params.id, translation.id, req.user.id, 'Published']
    );
    await syncArticleStatus(client, req.params.id);
    await audit(client, req.user.id, 'article.published', 'article', req.params.id, { language: lang });
  });
  res.json({ article: await getArticleForEditor(req.params.id) });
});

const addTranslation = asyncHandler(async (req, res) => {
  const data = createSchema.parse(req.body);
  const article = await one('SELECT * FROM articles WHERE id = $1', [req.params.id]);
  if (!article) throw new ApiError(404, 'Article not found', 'NOT_FOUND');
  assertOwnershipOrStaff(req.user, article);
  const existing = await one(
    'SELECT 1 FROM article_translations WHERE article_id = $1 AND language = $2',
    [req.params.id, data.language]
  );
  if (existing) {
    throw new ApiError(409, 'This language version already exists', 'TRANSLATION_EXISTS');
  }
  await tx(async (client) => {
    const slug = await resolveSlug(client, data.slug, data.headline, null);
    await client.query(
      `INSERT INTO article_translations(article_id, language, headline, summary, content, slug,
          source, caption, seo_title, seo_description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        req.params.id,
        data.language,
        cleanText(data.headline, 300),
        cleanText(data.summary, 2000),
        cleanArticleHtml(data.content),
        slug,
        data.source || null,
        data.caption || null,
        data.seo_title || null,
        data.seo_description || null,
      ]
    );
    if (data.tags?.length) await replaceTags(client, req.params.id, data.tags);
    await syncArticleStatus(client, req.params.id);
    await audit(client, req.user.id, 'article.translation_added', 'article', req.params.id, {
      language: data.language,
    });
  });
  res.status(201).json({ article: await getArticleForEditor(req.params.id) });
});

const submitCorrection = asyncHandler(async (req, res) => {
  const article = await one('SELECT * FROM articles WHERE id = $1', [req.params.id]);
  if (!article) throw new ApiError(404, 'Article not found', 'NOT_FOUND');
  if (article.author_id !== req.user.id && !isStaff(req.user)) {
    throw new ApiError(403, 'Only the author can request a correction', 'FORBIDDEN');
  }
  const lang = req.body?.language;
  const translation = await one(
    'SELECT * FROM article_translations WHERE article_id = $1 AND language = $2',
    [req.params.id, lang]
  );
  if (!translation) throw new ApiError(404, 'Translation not found', 'NOT_FOUND');
  const reason = cleanText(req.body?.reason || '', 1000);
  if (!reason) throw new ApiError(422, 'Describe the correction you are requesting', 'REASON_REQUIRED');
  const snapshot = {
    headline: req.body.headline || translation.headline,
    summary: req.body.summary || translation.summary,
    content: req.body.content ? cleanArticleHtml(req.body.content) : translation.content,
    slug: translation.slug,
    status: translation.status,
    correction_reason: reason,
  };
  await tx(async (client) => {
    await client.query(
      `INSERT INTO article_revisions(article_id, translation_id, snapshot, editor_id, note)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.params.id, translation.id, snapshot, req.user.id, `Correction request: ${reason}`]
    );
    await audit(client, req.user.id, 'article.correction_requested', 'article', req.params.id, {
      language: lang,
      reason,
    });
  });
  res.status(201).json({ ok: true, message: 'Correction submitted for editorial review' });
});

const applyRevision = asyncHandler(async (req, res) => {
  const revision = await one(
    `SELECT * FROM article_revisions WHERE id = $1 AND article_id = $2`,
    [req.params.revisionId, req.params.id]
  );
  if (!revision) throw new ApiError(404, 'Revision not found', 'NOT_FOUND');
  const translation = await one('SELECT * FROM article_translations WHERE id = $1', [
    revision.translation_id,
  ]);
  if (!translation) throw new ApiError(404, 'Translation not found', 'NOT_FOUND');
  const snap = revision.snapshot;
  await tx(async (client) => {
    await client.query(
      `INSERT INTO article_revisions(article_id, translation_id, snapshot, editor_id, note)
       VALUES ($1, $2, $3, $4, 'Snapshot before applying correction')`,
      [req.params.id, translation.id, {
        headline: translation.headline,
        summary: translation.summary,
        content: translation.content,
        slug: translation.slug,
        status: translation.status,
      }, req.user.id]
    );
    await client.query(
      `UPDATE article_translations SET headline = $1, summary = $2, content = $3, updated_at = NOW()
        WHERE id = $4`,
      [snap.headline, snap.summary, snap.content, translation.id]
    );
    await client.query(
      `INSERT INTO article_reviews(article_id, translation_id, reviewer_id, decision, comments)
       VALUES ($1, $2, $3, 'correction', $4)`,
      [req.params.id, translation.id, req.user.id, revision.note || 'Correction applied']
    );
    await audit(client, req.user.id, 'article.correction_applied', 'article', req.params.id, {
      revisionId: req.params.revisionId,
    });
  });
  res.json({ article: await getArticleForEditor(req.params.id) });
});

const archiveArticle = asyncHandler(async (req, res) => {
  const article = await one('SELECT * FROM articles WHERE id = $1', [req.params.id]);
  if (!article) throw new ApiError(404, 'Article not found', 'NOT_FOUND');
  const staff = isStaff(req.user);
  if (!staff) {
    if (article.author_id !== req.user.id) {
      throw new ApiError(403, 'You can only archive your own articles', 'FORBIDDEN');
    }
    if (article.status === 'published') {
      throw new ApiError(403, 'Published articles can only be archived by an editor', 'FORBIDDEN');
    }
  }
  await tx(async (client) => {
    await client.query(
      `UPDATE articles SET status = 'archived', archived_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [req.params.id]
    );
    await audit(client, req.user.id, 'article.archived', 'article', req.params.id);
  });
  res.json({ ok: true });
});

const deleteArticle = asyncHandler(async (req, res) => {
  const article = await one('SELECT id, status FROM articles WHERE id = $1', [req.params.id]);
  if (!article) throw new ApiError(404, 'Article not found', 'NOT_FOUND');
  await tx(async (client) => {
    await client.query('DELETE FROM articles WHERE id = $1', [req.params.id]);
    await audit(client, req.user.id, 'article.deleted', 'article', req.params.id, {
      status: article.status,
    });
  });
  res.json({ ok: true, deleted: true });
});

const listMyPublicArticles = asyncHandler(async (req, res) => {
  const lang = LANGS.includes(req.query.lang) ? req.query.lang : 'en';
  const items = await listCards({ lang, limit: 12 });
  res.json({ items: items.filter((i) => i.author_name === req.user.name) });
});

module.exports = {
  createArticle,
  listArticles,
  getArticle,
  getArticleBySlug,
  updateArticle,
  submitArticle,
  approveArticle,
  rejectArticle,
  publishArticle,
  addTranslation,
  submitCorrection,
  applyRevision,
  archiveArticle,
  deleteArticle,
  listMyPublicArticles,
  countCards,
};
