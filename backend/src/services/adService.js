const { query } = require('../db');
const { imageUrl } = require('./imageService');

function normalizePath(value) {
  if (!value) return null;
  let next = String(value).trim();
  if (!next) return null;
  const origin = next.match(/^https?:\/\/[^/]+/i);
  if (origin) next = next.slice(origin[0].length) || '/';
  next = next.split('#')[0].split('?')[0];
  if (!next.startsWith('/')) next = `/${next}`;
  return next;
}

function patternMatches(pattern, path) {
  const target = normalizePath(pattern);
  const current = normalizePath(path);
  if (!target || !current) return false;
  if (target.includes('*')) {
    const source = target
      .split('*')
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('.*');
    return new RegExp(`^${source}$`).test(current);
  }
  if (target.endsWith('/')) {
    const base = target.slice(0, -1);
    return current === base || current.startsWith(target);
  }
  return current === target || current === `${target}/`;
}

async function activeAds(placements, options = {}) {
  const opts = typeof options === 'string' ? { placement: options } : options || {};
  const placement = opts.placement || null;
  const categorySlug = opts.categorySlug || null;
  const districtSlug = opts.districtSlug || null;
  const currentPath = normalizePath(opts.path);
  const filter = placement ? [placement] : placements;
  const { rows } = await query(
    `WITH candidates AS (
       SELECT a.id, a.title, a.advertiser_name, a.image_id, a.placement,
              a.destination_url, a.is_sponsored, a.created_at,
              a.target_category_id, a.target_district_id, a.target_path,
              a.display_width, a.max_height, a.image_fit
         FROM advertisements a
        WHERE a.status = 'active'
          AND (a.starts_at IS NULL OR a.starts_at <= NOW())
          AND (a.ends_at IS NULL OR a.ends_at >= NOW())
          AND a.placement = ANY($1::text[])
          AND (
            a.target_category_id IS NULL
            OR a.target_category_id = (SELECT id FROM categories WHERE slug = $2 AND is_active)
          )
          AND (
            a.target_district_id IS NULL
            OR a.target_district_id = (SELECT id FROM districts WHERE slug = $3)
          )
          AND NOT EXISTS (
            SELECT 1 FROM advertisement_overrides o
             WHERE o.advertisement_id = a.id
               AND o.placement = a.placement
               AND (o.starts_at IS NULL OR o.starts_at <= NOW())
               AND (o.ends_at IS NULL OR o.ends_at >= NOW())
          )
       UNION ALL
       SELECT a.id, a.title, a.advertiser_name, a.image_id, o.placement,
              COALESCE(o.destination_url, a.destination_url), a.is_sponsored, a.created_at,
              a.target_category_id, a.target_district_id, a.target_path,
              a.display_width, a.max_height, a.image_fit
         FROM advertisements a
         JOIN advertisement_overrides o ON o.advertisement_id = a.id
        WHERE a.status = 'active'
          AND (a.starts_at IS NULL OR a.starts_at <= NOW())
          AND (a.ends_at IS NULL OR a.ends_at >= NOW())
          AND o.placement = ANY($1::text[])
          AND (o.starts_at IS NULL OR o.starts_at <= NOW())
          AND (o.ends_at IS NULL OR o.ends_at >= NOW())
          AND (
            a.target_category_id IS NULL
            OR a.target_category_id = (SELECT id FROM categories WHERE slug = $2 AND is_active)
          )
          AND (
            a.target_district_id IS NULL
            OR a.target_district_id = (SELECT id FROM districts WHERE slug = $3)
          )
     )
     SELECT id, title, advertiser_name, image_id, placement, destination_url, is_sponsored,
            target_category_id, target_district_id, target_path,
            display_width, max_height, image_fit,
            (target_category_id IS NOT NULL OR target_district_id IS NOT NULL OR target_path IS NOT NULL) AS targeted
       FROM candidates
      WHERE destination_url ~* '^https?://'
      ORDER BY targeted DESC, created_at DESC`,
    [filter, categorySlug, districtSlug]
  );

  return rows
    .filter((ad) => {
      if (!ad.target_path) return true;
      return currentPath ? patternMatches(ad.target_path, currentPath) : false;
    })
    .map((ad) => ({
      id: ad.id,
      title: ad.title,
      advertiser_name: ad.advertiser_name,
      placement: ad.placement,
      is_sponsored: ad.is_sponsored,
      targeted: ad.targeted,
      target_category_id: ad.target_category_id,
      target_district_id: ad.target_district_id,
      target_path: ad.target_path,
      display_width: ad.display_width,
      max_height: ad.max_height,
      image_fit: ad.image_fit,
      image: ad.image_id
        ? { optimized: imageUrl(ad.image_id, 'optimized'), thumb: imageUrl(ad.image_id, 'thumb') }
        : null,
      destination_url: ad.destination_url,
      click_url: `/api/v1/public/ads/${ad.id}/click?placement=${encodeURIComponent(ad.placement)}`,
    }));
}

async function resolveClickDestination(adId, placement) {
  const { rows } = await query(
    `SELECT COALESCE(o.destination_url, a.destination_url) AS destination_url
       FROM advertisements a
       LEFT JOIN advertisement_overrides o
         ON o.advertisement_id = a.id
        AND o.placement = $2
        AND (o.starts_at IS NULL OR o.starts_at <= NOW())
        AND (o.ends_at IS NULL OR o.ends_at >= NOW())
      WHERE a.id = $1
        AND a.status = 'active'
        AND (a.starts_at IS NULL OR a.starts_at <= NOW())
        AND (a.ends_at IS NULL OR a.ends_at >= NOW())`,
    [adId, placement || null]
  );
  const destination = rows[0]?.destination_url || null;
  return destination && /^https?:\/\//i.test(destination) ? destination : null;
}

module.exports = { activeAds, resolveClickDestination, patternMatches };
