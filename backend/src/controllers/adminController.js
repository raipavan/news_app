const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { query, one, tx } = require('../db');
const { asyncHandler, ApiError } = require('../utils/errors');
const { cleanText } = require('../utils/sanitize');
const { audit } = require('../utils/audit');
const { imageUrl } = require('../services/imageService');
const { slugify, uniqueSlug } = require('../utils/slug');

const dashboard = asyncHandler(async (req, res) => {
  const [counts, topArticles, pending, activity, revenue] = await Promise.all([
    query(`
      SELECT
        (SELECT COUNT(*)::int FROM articles WHERE status <> 'archived') AS total_articles,
        (SELECT COUNT(*)::int FROM articles WHERE status = 'published') AS published,
        (SELECT COUNT(*)::int FROM articles WHERE status = 'submitted') AS pending,
        (SELECT COUNT(*)::int FROM articles WHERE status = 'rejected') AS rejected,
        (SELECT COUNT(DISTINCT u.id)::int FROM users u
           JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id
          WHERE r.role_name = 'reporter' AND u.status = 'active') AS reporters,
        (SELECT COUNT(DISTINCT u.id)::int FROM users u
           JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id
          WHERE r.role_name = 'contributor') AS community_users,
        (SELECT COALESCE(SUM(view_count), 0)::bigint FROM articles) AS total_views,
        (SELECT COUNT(*)::int FROM advertisements WHERE is_sponsored = TRUE) AS sponsored_posts,
        (SELECT COUNT(*)::int FROM comments WHERE status = 'pending') AS pending_comments,
        (SELECT COUNT(*)::int FROM article_reports WHERE status = 'open') AS open_reports
    `),
    query(`
      SELECT a.id, a.view_count, t.headline, t.slug, t.language
        FROM articles a
        JOIN article_translations t ON t.article_id = a.id AND t.status = 'published'
       WHERE a.status = 'published'
       ORDER BY a.view_count DESC LIMIT 5
    `),
    query(`
      SELECT a.id, a.status, a.created_at, u.name AS author_name,
             t.language, t.headline, t.slug, t.status AS translation_status
        FROM articles a
        JOIN users u ON u.id = a.author_id
        JOIN article_translations t ON t.article_id = a.id
       WHERE a.status IN ('submitted', 'in_review')
       ORDER BY t.submitted_at ASC NULLS LAST, a.created_at ASC
       LIMIT 8
    `),
    query(`
      SELECT al.action, al.entity, al.entity_id, al.created_at, u.name AS user_name
        FROM audit_logs al LEFT JOIN users u ON u.id = al.user_id
       ORDER BY al.created_at DESC LIMIT 8
    `),
    query(`
      SELECT COALESCE(SUM(amount_paid), 0)::numeric(12,2) AS total_revenue,
             COALESCE(SUM(amount_paid) FILTER (WHERE is_sponsored), 0)::numeric(12,2) AS sponsored_revenue
        FROM advertisements WHERE status IN ('active', 'paused', 'expired')
    `),
  ]);

  res.json({
    metrics: {
      ...counts.rows[0],
      total_views: Number(counts.rows[0].total_views),
      total_revenue: Number(revenue.rows[0].total_revenue),
      sponsored_revenue: Number(revenue.rows[0].sponsored_revenue),
    },
    top_articles: topArticles.rows,
    pending: pending.rows,
    recent_activity: activity.rows,
  });
});

const pendingArticles = asyncHandler(async (req, res) => {
  const { rows } = await query(`
    SELECT a.id, a.status, a.created_at, a.updated_at, u.name AS author_name, u.email AS author_email,
           c.name_en AS category_name_en, c.name_kn AS category_name_kn,
           d.name_en AS district_name_en, d.name_kn AS district_name_kn,
           (SELECT ai.image_id FROM article_images ai
             WHERE ai.article_id = a.id AND ai.image_type = 'main' LIMIT 1) AS main_image_id,
           json_agg(json_build_object(
             'id', t.id, 'language', t.language, 'headline', t.headline, 'slug', t.slug,
             'status', t.status, 'summary', t.summary,
             'submitted_at', t.submitted_at, 'rejection_reason', t.rejection_reason
           ) ORDER BY t.language) AS translations
      FROM articles a
      JOIN users u ON u.id = a.author_id
      LEFT JOIN categories c ON c.id = a.category_id
      LEFT JOIN districts d ON d.id = a.district_id
      JOIN article_translations t ON t.article_id = a.id
     WHERE a.status IN ('submitted', 'in_review')
     GROUP BY a.id, u.name, u.email, c.name_en, c.name_kn, d.name_en, d.name_kn
     ORDER BY a.created_at ASC
  `);
  res.json({ items: rows });
});

const listUsers = asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim();
  const limit = Math.min(Number(req.query.limit) || 30, 100);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const params = [];
  let where = '';
  if (q) {
    params.push(`%${q}%`);
    where = `WHERE u.name ILIKE $1 OR u.email ILIKE $1 OR u.phone ILIKE $1`;
  }
  params.push(limit, (page - 1) * limit);
  const { rows } = await query(
    `SELECT u.id, u.name, u.email, u.phone, u.status, u.can_publish, u.created_at,
            COALESCE(array_agg(r.role_name) FILTER (WHERE r.role_name IS NOT NULL), '{}') AS roles,
            (SELECT COUNT(*)::int FROM articles a WHERE a.author_id = u.id AND a.status <> 'archived') AS article_count
       FROM users u
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       LEFT JOIN roles r ON r.id = ur.role_id
       ${where}
      GROUP BY u.id
      ORDER BY u.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  const total = await query(
    `SELECT COUNT(*)::int AS total FROM users u ${where}`,
    params.slice(0, params.length - 2)
  );
  res.json({ items: rows, total: total.rows[0].total, page, limit });
});

const createUser = asyncHandler(async (req, res) => {
  const schema = z.object({
    name: z.string().trim().min(2).max(150),
    email: z.string().trim().email().max(255).optional(),
    phone: z.string().trim().max(20).optional(),
    password: z.string().min(8).max(128),
    roles: z.array(z.enum(['editor', 'reporter', 'contributor', 'reader'])).min(1),
    can_publish: z.boolean().optional().default(false),
    status: z.enum(['active', 'pending']).optional().default('active'),
  });
  const data = schema.parse(req.body);
  const hash = await bcrypt.hash(data.password, 12);
  const id = await tx(async (client) => {
    const exists = await client.query(
      `SELECT 1 FROM users WHERE ($1::text IS NOT NULL AND email = $1)
                             OR ($2::text IS NOT NULL AND phone = $2)`,
      [data.email || null, data.phone || null]
    );
    if (exists.rowCount) throw new ApiError(409, 'A user with these details already exists', 'ACCOUNT_EXISTS');
    const inserted = await client.query(
      `INSERT INTO users(name, email, phone, password_hash, status, can_publish)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [cleanText(data.name, 150), data.email || null, data.phone || null, hash, data.status, data.can_publish]
    );
    const userId = inserted.rows[0].id;
    for (const role of data.roles) {
      await client.query(
        `INSERT INTO user_roles(user_id, role_id)
         SELECT $1, id FROM roles WHERE role_name = $2`,
        [userId, role]
      );
    }
    await audit(client, req.user.id, 'admin.user_created', 'user', userId, {
      roles: data.roles,
      can_publish: data.can_publish,
    });
    return userId;
  });
  res.status(201).json({ id });
});

const updateUserStatus = asyncHandler(async (req, res) => {
  const status = req.body?.status;
  if (!['pending', 'active', 'blocked'].includes(status)) {
    throw new ApiError(422, 'Invalid status', 'VALIDATION');
  }
  if (req.params.id === req.user.id && status !== 'active') {
    throw new ApiError(422, 'You cannot deactivate your own account', 'VALIDATION');
  }
  const updated = await query('UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id', [
    status,
    req.params.id,
  ]);
  if (!updated.rowCount) throw new ApiError(404, 'User not found', 'NOT_FOUND');
  if (status !== 'active') {
    await query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL', [
      req.params.id,
    ]);
  }
  await audit(null, req.user.id, 'admin.user_status_changed', 'user', req.params.id, { status });
  res.json({ ok: true });
});

const updateUserRoles = asyncHandler(async (req, res) => {
  const roles = Array.isArray(req.body?.roles) ? req.body.roles : [];
  const allowed = ['super_admin', 'editor', 'reporter', 'contributor', 'reader'];
  if (!roles.length || roles.some((r) => !allowed.includes(r))) {
    throw new ApiError(422, 'Provide at least one valid role', 'VALIDATION');
  }
  if (req.params.id === req.user.id && !roles.includes('super_admin')) {
    throw new ApiError(422, 'You cannot remove your own super admin role', 'VALIDATION');
  }
  await tx(async (client) => {
    const user = await client.query('SELECT 1 FROM users WHERE id = $1', [req.params.id]);
    if (!user.rowCount) throw new ApiError(404, 'User not found', 'NOT_FOUND');
    await client.query('DELETE FROM user_roles WHERE user_id = $1', [req.params.id]);
    for (const role of roles) {
      await client.query(
        `INSERT INTO user_roles(user_id, role_id) SELECT $1, id FROM roles WHERE role_name = $2`,
        [req.params.id, role]
      );
    }
    await audit(client, req.user.id, 'admin.user_roles_changed', 'user', req.params.id, { roles });
  });
  res.json({ ok: true });
});

const updateUserName = asyncHandler(async (req, res) => {
  const schema = z.object({ name: z.string().trim().min(2).max(150) });
  const data = schema.parse(req.body);
  const name = cleanText(data.name, 150);
  if (name.length < 2) throw new ApiError(422, 'Enter a name of at least 2 characters', 'VALIDATION');
  const updated = await query(
    'UPDATE users SET name = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name',
    [name, req.params.id]
  );
  if (!updated.rowCount) throw new ApiError(404, 'User not found', 'NOT_FOUND');
  await audit(null, req.user.id, 'admin.user_name_changed', 'user', req.params.id, { name });
  res.json({ ok: true, user: updated.rows[0] });
});

const updatePublisher = asyncHandler(async (req, res) => {
  const canPublish = Boolean(req.body?.can_publish);
  const updated = await query(
    'UPDATE users SET can_publish = $1, updated_at = NOW() WHERE id = $2 RETURNING id',
    [canPublish, req.params.id]
  );
  if (!updated.rowCount) throw new ApiError(404, 'User not found', 'NOT_FOUND');
  await audit(null, req.user.id, 'admin.publisher_permission_changed', 'user', req.params.id, {
    can_publish: canPublish,
  });
  res.json({ ok: true });
});

const listCategories = asyncHandler(async (req, res) => {
  const { rows } = await query(`
    SELECT c.*, (SELECT COUNT(*)::int FROM articles a WHERE a.category_id = c.id) AS article_count
      FROM categories c ORDER BY c.sort_order, c.name_en
  `);
  res.json({ items: rows });
});

const createCategory = asyncHandler(async (req, res) => {
  const schema = z.object({
    name_en: z.string().trim().min(2).max(100),
    name_kn: z.string().trim().min(1).max(100),
    slug: z.string().trim().max(120).optional(),
    sort_order: z.coerce.number().int().optional().default(0),
  });
  const data = schema.parse(req.body);
  const slug = await uniqueSlug({ query }, 'categories', slugify(data.slug || data.name_en, 'category'));
  const { rows } = await query(
    `INSERT INTO categories(name_en, name_kn, slug, sort_order)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [cleanText(data.name_en, 100), cleanText(data.name_kn, 100), slug, data.sort_order]
  );
  await audit(null, req.user.id, 'admin.category_created', 'category', rows[0].id);
  res.status(201).json({ category: rows[0] });
});

const updateCategory = asyncHandler(async (req, res) => {
  const existing = await one('SELECT * FROM categories WHERE id = $1', [req.params.id]);
  if (!existing) throw new ApiError(404, 'Category not found', 'NOT_FOUND');
  const b = req.body || {};
  const slug = b.slug && b.slug !== existing.slug
    ? await uniqueSlug({ query }, 'categories', slugify(b.slug, 'category'), existing.id)
    : existing.slug;
  const { rows } = await query(
    `UPDATE categories SET name_en = $1, name_kn = $2, slug = $3, is_active = $4, sort_order = $5
      WHERE id = $6 RETURNING *`,
    [
      b.name_en ? cleanText(b.name_en, 100) : existing.name_en,
      b.name_kn ? cleanText(b.name_kn, 100) : existing.name_kn,
      slug,
      b.is_active === undefined ? existing.is_active : Boolean(b.is_active),
      b.sort_order === undefined ? existing.sort_order : Number(b.sort_order),
      req.params.id,
    ]
  );
  await audit(null, req.user.id, 'admin.category_updated', 'category', req.params.id);
  res.json({ category: rows[0] });
});

const listDistricts = asyncHandler(async (req, res) => {
  const { rows } = await query(`
    SELECT d.*, (SELECT COUNT(*)::int FROM articles a WHERE a.district_id = d.id) AS article_count
      FROM districts d ORDER BY d.name_en
  `);
  res.json({ items: rows });
});

const createDistrict = asyncHandler(async (req, res) => {
  const schema = z.object({
    name_en: z.string().trim().min(2).max(100),
    name_kn: z.string().trim().min(1).max(100),
    slug: z.string().trim().max(120).optional(),
  });
  const data = schema.parse(req.body);
  const slug = await uniqueSlug({ query }, 'districts', slugify(data.slug || data.name_en, 'district'));
  const { rows } = await query(
    'INSERT INTO districts(name_en, name_kn, slug) VALUES ($1, $2, $3) RETURNING *',
    [cleanText(data.name_en, 100), cleanText(data.name_kn, 100), slug]
  );
  await audit(null, req.user.id, 'admin.district_created', 'district', rows[0].id);
  res.status(201).json({ district: rows[0] });
});

const updateDistrict = asyncHandler(async (req, res) => {
  const existing = await one('SELECT * FROM districts WHERE id = $1', [req.params.id]);
  if (!existing) throw new ApiError(404, 'District not found', 'NOT_FOUND');
  const b = req.body || {};
  const slug = b.slug && b.slug !== existing.slug
    ? await uniqueSlug({ query }, 'districts', slugify(b.slug, 'district'), existing.id)
    : existing.slug;
  const { rows } = await query(
    `UPDATE districts SET name_en = $1, name_kn = $2, slug = $3, is_active = $4
      WHERE id = $5 RETURNING *`,
    [
      b.name_en ? cleanText(b.name_en, 100) : existing.name_en,
      b.name_kn ? cleanText(b.name_kn, 100) : existing.name_kn,
      slug,
      b.is_active === undefined ? existing.is_active : Boolean(b.is_active),
      req.params.id,
    ]
  );
  await audit(null, req.user.id, 'admin.district_updated', 'district', req.params.id);
  res.json({ district: rows[0] });
});

const listComments = asyncHandler(async (req, res) => {
  const status = req.query.status ? String(req.query.status) : null;
  const params = [];
  let where = '';
  if (status) {
    params.push(status);
    where = `WHERE c.status = $1`;
  }
  params.push(Math.min(Number(req.query.limit) || 50, 100));
  const { rows } = await query(
    `SELECT c.*, COALESCE(u.name, c.guest_name, 'Reader') AS user_name, t.headline, t.slug, t.language
       FROM comments c
       LEFT JOIN users u ON u.id = c.user_id
       JOIN articles a ON a.id = c.article_id
       JOIN LATERAL (
         SELECT headline, slug, language FROM article_translations
          WHERE article_id = a.id
          ORDER BY (language = 'en') DESC, language LIMIT 1
       ) t ON TRUE
       ${where}
      ORDER BY c.created_at DESC LIMIT $${params.length}`,
    params
  );
  res.json({ items: rows });
});

const moderateComment = asyncHandler(async (req, res) => {
  const status = req.body?.status;
  if (!['approved', 'rejected', 'pending'].includes(status)) {
    throw new ApiError(422, 'Invalid moderation status', 'VALIDATION');
  }
  const updated = await query(
    'UPDATE comments SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING article_id',
    [status, req.params.id]
  );
  if (!updated.rowCount) throw new ApiError(404, 'Comment not found', 'NOT_FOUND');
  await audit(null, req.user.id, 'admin.comment_moderated', 'comment', req.params.id, { status });
  res.json({ ok: true });
});

const listReports = asyncHandler(async (req, res) => {
  const status = req.query.status ? String(req.query.status) : 'open';
  const { rows } = await query(
    `SELECT r.*, u.name AS reporter_name, t.headline, t.slug, t.language, a.id AS article_id
       FROM article_reports r
       JOIN articles a ON a.id = r.article_id
       JOIN LATERAL (
         SELECT headline, slug, language FROM article_translations
          WHERE article_id = a.id
          ORDER BY (language = 'en') DESC, language LIMIT 1
       ) t ON TRUE
       LEFT JOIN users u ON u.id = r.reporter_id
      WHERE r.status = $1
      ORDER BY r.created_at DESC LIMIT 100`,
    [status]
  );
  res.json({ items: rows });
});

const resolveReport = asyncHandler(async (req, res) => {
  const status = req.body?.status;
  if (!['open', 'resolved', 'dismissed'].includes(status)) {
    throw new ApiError(422, 'Invalid report status', 'VALIDATION');
  }
  const updated = await query(
    `UPDATE article_reports SET status = $1, notes = $2,
            resolved_at = CASE WHEN $1 = 'open' THEN NULL ELSE NOW() END
      WHERE id = $3 RETURNING id`,
    [status, cleanText(req.body?.notes || '', 2000), req.params.id]
  );
  if (!updated.rowCount) throw new ApiError(404, 'Report not found', 'NOT_FOUND');
  await audit(null, req.user.id, 'admin.report_resolved', 'report', req.params.id, { status });
  res.json({ ok: true });
});

const listAds = asyncHandler(async (req, res) => {
  const [{ rows }, overrides] = await Promise.all([
    query(`
      SELECT a.*,
             tc.name_en AS target_category_name,
             tc.name_kn AS target_category_name_kn,
             tc.slug AS target_category_slug,
             td.name_en AS target_district_name,
             td.name_kn AS target_district_name_kn,
             td.slug AS target_district_slug,
             (SELECT COUNT(*)::int FROM ad_impressions i WHERE i.advertisement_id = a.id) AS impressions,
             (SELECT COUNT(*)::int FROM ad_clicks c WHERE c.advertisement_id = a.id) AS clicks,
             (SELECT COUNT(DISTINCT c.visitor_id)::int FROM ad_clicks c
               WHERE c.advertisement_id = a.id AND c.visitor_id IS NOT NULL) AS unique_visitors
        FROM advertisements a
        LEFT JOIN categories tc ON tc.id = a.target_category_id
        LEFT JOIN districts td ON td.id = a.target_district_id
       ORDER BY a.created_at DESC
    `),
    query(`
      SELECT id, advertisement_id, placement, destination_url, starts_at, ends_at
        FROM advertisement_overrides ORDER BY placement
    `),
  ]);
  const byAd = new Map();
  for (const override of overrides.rows) {
    const list = byAd.get(override.advertisement_id) || [];
    list.push(override);
    byAd.set(override.advertisement_id, list);
  }
  res.json({
    items: rows.map((ad) => ({
      ...ad,
      amount_paid: Number(ad.amount_paid),
      image: ad.image_id ? { optimized: imageUrl(ad.image_id, 'optimized'), thumb: imageUrl(ad.image_id, 'thumb') } : null,
      overrides: byAd.get(ad.id) || [],
    })),
  });
});

const destinationUrlSchema = z
  .string()
  .url()
  .refine((value) => /^https?:\/\//i.test(value), {
    message: 'Destination URL must use http or https',
  });

const AD_PLACEMENTS = [
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

const targetPathSchema = z
  .string()
  .trim()
  .max(300)
  .optional()
  .nullable()
  .refine((value) => !value || value.startsWith('/'), {
    message: 'Page path must start with /',
  })
  .refine((value) => !value || !/[\s?#]/.test(value), {
    message: 'Use a path only — no spaces, query strings or #fragments',
  });

const adOverrideSchema = z.object({
  placement: z.enum(AD_PLACEMENTS),
  destination_url: destinationUrlSchema.optional().nullable(),
  starts_at: z.string().datetime().optional().nullable(),
  ends_at: z.string().datetime().optional().nullable(),
});

const adBaseSchema = z.object({
  title: z.string().trim().min(2).max(200),
  advertiser_name: z.string().trim().max(200).optional().nullable(),
  image_id: z.string().uuid().optional().nullable(),
  destination_url: destinationUrlSchema,
  placement: z.enum(AD_PLACEMENTS),
  status: z.enum(['draft', 'active', 'paused', 'expired']).optional().default('draft'),
  is_sponsored: z.boolean().optional().default(false),
  amount_paid: z.coerce.number().min(0).optional().default(0),
  display_width: z.coerce.number().int().min(25).max(100).optional().default(100),
  max_height: z.coerce.number().int().min(40).max(800).optional().nullable(),
  image_fit: z.enum(['cover', 'contain']).optional().default('cover'),
  starts_at: z.string().datetime().optional().nullable(),
  ends_at: z.string().datetime().optional().nullable(),
  target_category_id: z.string().uuid().optional().nullable(),
  target_district_id: z.coerce.number().int().positive().optional().nullable(),
  target_path: targetPathSchema,
  overrides: z
    .array(adOverrideSchema)
    .max(AD_PLACEMENTS.length)
    .refine((items) => new Set(items.map((item) => item.placement)).size === items.length, {
      message: 'Each placement can only have one override',
    })
    .optional(),
});

const adSchema = adBaseSchema.refine(
  (data) => !(data.target_category_id && data.target_district_id),
  { message: 'Target either a category or a district, not both' }
);

async function insertOverrides(client, advertisementId, overrides) {
  for (const override of overrides || []) {
    await client.query(
      `INSERT INTO advertisement_overrides(advertisement_id, placement, destination_url, starts_at, ends_at)
       VALUES ($1,$2,$3,$4,$5)`,
      [
        advertisementId,
        override.placement,
        override.destination_url || null,
        override.starts_at || null,
        override.ends_at || null,
      ]
    );
  }
}

const createAd = asyncHandler(async (req, res) => {
  const data = adSchema.parse(req.body);
  const advertisement = await tx(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO advertisements(title, advertiser_name, image_id, destination_url, placement,
          status, is_sponsored, amount_paid, display_width, max_height, image_fit,
          starts_at, ends_at, target_category_id, target_district_id, target_path)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
      [
        cleanText(data.title, 200),
        data.advertiser_name || null,
        data.image_id || null,
        data.destination_url,
        data.placement,
        data.status,
        data.is_sponsored,
        data.amount_paid,
        data.display_width,
        data.max_height || null,
        data.image_fit,
        data.starts_at || null,
        data.ends_at || null,
        data.target_category_id || null,
        data.target_district_id || null,
        data.target_path || null,
      ]
    );
    await insertOverrides(client, rows[0].id, data.overrides);
    return rows[0];
  });
  await audit(null, req.user.id, 'admin.ad_created', 'advertisement', advertisement.id);
  res.status(201).json({ advertisement });
});

const updateAd = asyncHandler(async (req, res) => {
  const existing = await one('SELECT * FROM advertisements WHERE id = $1', [req.params.id]);
  if (!existing) throw new ApiError(404, 'Advertisement not found', 'NOT_FOUND');
  const data = adBaseSchema.partial().parse(req.body || {});
  if (data.target_category_id && data.target_district_id) {
    throw new ApiError(422, 'Target either a category or a district, not both', 'VALIDATION');
  }
  const merged = {
    title: data.title ?? existing.title,
    advertiser_name: data.advertiser_name === undefined ? existing.advertiser_name : data.advertiser_name,
    image_id: data.image_id === undefined ? existing.image_id : data.image_id,
    destination_url: data.destination_url ?? existing.destination_url,
    placement: data.placement ?? existing.placement,
    status: data.status ?? existing.status,
    is_sponsored: data.is_sponsored === undefined ? existing.is_sponsored : data.is_sponsored,
    amount_paid: data.amount_paid === undefined ? existing.amount_paid : data.amount_paid,
    display_width: data.display_width === undefined ? existing.display_width : data.display_width,
    max_height: data.max_height === undefined ? existing.max_height : data.max_height,
    image_fit: data.image_fit === undefined ? existing.image_fit : data.image_fit,
    starts_at: data.starts_at === undefined ? existing.starts_at : data.starts_at,
    ends_at: data.ends_at === undefined ? existing.ends_at : data.ends_at,
    target_category_id:
      data.target_category_id === undefined ? existing.target_category_id : data.target_category_id,
    target_district_id:
      data.target_district_id === undefined ? existing.target_district_id : data.target_district_id,
    target_path: data.target_path === undefined ? existing.target_path : data.target_path || null,
  };
  if (data.target_category_id) merged.target_district_id = null;
  if (data.target_district_id) merged.target_category_id = null;
  const replaceOverrides = data.overrides !== undefined;
  const advertisement = await tx(async (client) => {
    const { rows } = await client.query(
      `UPDATE advertisements SET title=$1, advertiser_name=$2, image_id=$3, destination_url=$4,
              placement=$5, status=$6, is_sponsored=$7, amount_paid=$8, display_width=$9,
              max_height=$10, image_fit=$11, starts_at=$12, ends_at=$13,
              target_category_id=$14, target_district_id=$15, target_path=$16, updated_at=NOW()
        WHERE id=$17 RETURNING *`,
      [
        cleanText(merged.title, 200),
        merged.advertiser_name,
        merged.image_id,
        merged.destination_url,
        merged.placement,
        merged.status,
        merged.is_sponsored,
        merged.amount_paid,
        merged.display_width,
        merged.max_height,
        merged.image_fit,
        merged.starts_at,
        merged.ends_at,
        merged.target_category_id,
        merged.target_district_id,
        merged.target_path,
        req.params.id,
      ]
    );
    if (replaceOverrides) {
      await client.query('DELETE FROM advertisement_overrides WHERE advertisement_id = $1', [req.params.id]);
      await insertOverrides(client, req.params.id, data.overrides);
    }
    return rows[0];
  });
  await audit(null, req.user.id, 'admin.ad_updated', 'advertisement', req.params.id);
  res.json({ advertisement });
});

const deleteAd = asyncHandler(async (req, res) => {
  await query('DELETE FROM advertisements WHERE id = $1', [req.params.id]);
  await audit(null, req.user.id, 'admin.ad_deleted', 'advertisement', req.params.id);
  res.json({ ok: true });
});

const analytics = asyncHandler(async (req, res) => {
  const [viewsByDay, shares, topCategories, topArticles, engagement, revenue] = await Promise.all([
    query(`
      SELECT to_char(d.day, 'YYYY-MM-DD') AS day, COALESCE(v.views, 0)::int AS views
        FROM generate_series(CURRENT_DATE - INTERVAL '13 days', CURRENT_DATE, '1 day') d(day)
        LEFT JOIN (
          SELECT date_trunc('day', viewed_at)::date AS day, COUNT(*) AS views
            FROM article_views WHERE viewed_at > NOW() - INTERVAL '14 days'
           GROUP BY 1
        ) v ON v.day = d.day::date
       ORDER BY d.day
    `),
    query(`SELECT platform, COUNT(*)::int AS count FROM article_shares GROUP BY platform ORDER BY count DESC`),
    query(`
      SELECT c.name_en, c.name_kn, COALESCE(SUM(a.view_count), 0)::bigint AS views,
             COUNT(a.id)::int AS articles
        FROM categories c LEFT JOIN articles a ON a.category_id = c.id AND a.status = 'published'
       GROUP BY c.id ORDER BY views DESC LIMIT 6
    `),
    query(`
      SELECT a.id, a.view_count, t.headline, t.slug, t.language
        FROM articles a JOIN article_translations t ON t.article_id = a.id AND t.status = 'published'
       WHERE a.status = 'published' ORDER BY a.view_count DESC LIMIT 10
    `),
    query(`
      SELECT (SELECT COUNT(*)::int FROM article_likes) AS likes,
             (SELECT COUNT(*)::int FROM comments WHERE status = 'approved') AS comments,
             (SELECT COUNT(*)::int FROM bookmarks) AS bookmarks,
             (SELECT COUNT(*)::int FROM article_shares) AS shares,
             (SELECT COUNT(*)::int FROM article_views) AS views
    `),
    query(`
      SELECT COALESCE(SUM(amount_paid), 0)::numeric(12,2) AS revenue,
             COALESCE(SUM(amount_paid) FILTER (WHERE is_sponsored), 0)::numeric(12,2) AS sponsored
        FROM advertisements WHERE status IN ('active', 'paused', 'expired')
    `),
  ]);
  res.json({
    views_by_day: viewsByDay.rows,
    shares_by_platform: shares.rows,
    top_categories: topCategories.rows.map((c) => ({ ...c, views: Number(c.views) })),
    top_articles: topArticles.rows,
    engagement: engagement.rows[0],
    revenue: { total: Number(revenue.rows[0].revenue), sponsored: Number(revenue.rows[0].sponsored) },
  });
});

const auditLogs = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const { rows } = await query(
    `SELECT al.*, u.name AS user_name FROM audit_logs al
       LEFT JOIN users u ON u.id = al.user_id
      ORDER BY al.created_at DESC LIMIT $1`,
    [limit]
  );
  res.json({ items: rows });
});

module.exports = {
  dashboard,
  pendingArticles,
  listUsers,
  createUser,
  updateUserStatus,
  updateUserRoles,
  updateUserName,
  updatePublisher,
  listCategories,
  createCategory,
  updateCategory,
  listDistricts,
  createDistrict,
  updateDistrict,
  listComments,
  moderateComment,
  listReports,
  resolveReport,
  listAds,
  createAd,
  updateAd,
  deleteAd,
  analytics,
  auditLogs,
};
