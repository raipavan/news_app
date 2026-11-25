const env = require('../config/env');

const MAX_URLS_PER_PURGE = 30;
const PURGE_TIMEOUT_MS = 5000;

/** Normalize and deduplicate absolute URLs or relative paths against baseUrl. */
function buildFullUrls(paths, baseUrl = env.publicBaseUrl) {
  const base = String(baseUrl || '').replace(/\/$/, '');
  const seen = new Set();
  const result = [];
  for (const raw of paths || []) {
    if (!raw) continue;
    const str = String(raw).trim();
    if (!str) continue;
    let full;
    if (/^https?:\/\//i.test(str)) {
      full = str;
    } else if (base) {
      full = `${base}${str.startsWith('/') ? str : `/${str}`}`;
    } else {
      continue;
    }
    if (!seen.has(full)) {
      seen.add(full);
      result.push(full);
    }
  }
  return result;
}

/** Split an array of URLs into batches of at most 30 (Cloudflare Free plan limit). */
function chunkUrls(urls, size = MAX_URLS_PER_PURGE) {
  const chunks = [];
  for (let i = 0; i < (urls || []).length; i += size) {
    chunks.push(urls.slice(i, i + size));
  }
  return chunks;
}

/**
 * Purge specific URLs (or whole zone when CF_CACHE_PURGE_MODE=everything) on Cloudflare.
 * Designed as non-blocking: logs failures without throwing so writes never fail.
 */
async function purgeUrls(paths, options = {}) {
  const cfConfig = options.cfConfig || env.cloudflare;
  const baseUrl = options.baseUrl !== undefined ? options.baseUrl : env.publicBaseUrl;
  const fetchImpl = options.fetchImpl || globalThis.fetch;

  if (!cfConfig?.purgeEnabled || typeof fetchImpl !== 'function') {
    return { skipped: true, purged: 0 };
  }

  const endpoint = `https://api.cloudflare.com/client/v4/zones/${cfConfig.zoneId}/purge_cache`;
  const headers = {
    Authorization: `Bearer ${cfConfig.apiToken}`,
    'Content-Type': 'application/json',
  };

  try {
    if (cfConfig.purgeMode === 'everything') {
      const res = await fetchImpl(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ purge_everything: true }),
        signal: AbortSignal.timeout(PURGE_TIMEOUT_MS),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.warn(`[cloudflare-cache] purge_everything failed (${res.status}): ${text}`);
        return { skipped: false, purged: 0, ok: false };
      }
      return { skipped: false, purged: 1, everything: true, ok: true };
    }

    const fullUrls = buildFullUrls(paths, baseUrl);
    if (!fullUrls.length) {
      return { skipped: true, purged: 0 };
    }

    const chunks = chunkUrls(fullUrls, MAX_URLS_PER_PURGE);
    let purged = 0;
    for (const files of chunks) {
      const res = await fetchImpl(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ files }),
        signal: AbortSignal.timeout(PURGE_TIMEOUT_MS),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.warn(`[cloudflare-cache] purge chunk failed (${res.status}): ${text}`);
      } else {
        purged += files.length;
      }
    }
    return { skipped: false, purged, ok: true };
  } catch (err) {
    console.warn(`[cloudflare-cache] purge failed: ${err.message}`);
    return { skipped: false, purged: 0, ok: false };
  }
}

/** Purge public feeds, SSR article URLs, category/district pages, and sitemap for an article. */
async function purgeArticle({ translations = [], categorySlug = null, districtSlug = null } = {}, options = {}) {
  const paths = [
    '/api/v1/public/home?lang=en',
    '/api/v1/public/home?lang=kn',
    '/api/v1/public/latest?lang=en',
    '/api/v1/public/latest?lang=kn',
    '/api/v1/public/ticker?lang=en',
    '/api/v1/public/ticker?lang=kn',
    '/api/v1/public/trending?lang=en',
    '/api/v1/public/trending?lang=kn',
    '/sitemap.xml',
  ];

  for (const t of translations || []) {
    if (!t?.language || !t?.slug) continue;
    const encoded = encodeURIComponent(t.slug);
    paths.push(`/${t.language}/news/${encoded}`);
    paths.push(`/api/v1/public/news/${encoded}?lang=${t.language}`);
  }

  if (categorySlug) {
    const encodedCat = encodeURIComponent(categorySlug);
    paths.push(`/api/v1/public/category/${encodedCat}?lang=en`);
    paths.push(`/api/v1/public/category/${encodedCat}?lang=kn`);
  }

  if (districtSlug) {
    const encodedDist = encodeURIComponent(districtSlug);
    paths.push(`/api/v1/public/district/${encodedDist}?lang=en`);
    paths.push(`/api/v1/public/district/${encodedDist}?lang=kn`);
  }

  return purgeUrls(paths, options);
}

/** Purge category and district listings plus home feeds and sitemap. */
async function purgeTaxonomy(options = {}) {
  return purgeUrls(
    [
      '/api/v1/public/categories?lang=en',
      '/api/v1/public/categories?lang=kn',
      '/api/v1/public/districts?lang=en',
      '/api/v1/public/districts?lang=kn',
      '/api/v1/public/home?lang=en',
      '/api/v1/public/home?lang=kn',
      '/sitemap.xml',
    ],
    options
  );
}

/** Purge public ads endpoint and homepage feeds when advertisements change. */
async function purgeAds(options = {}) {
  return purgeUrls(
    [
      '/api/v1/public/ads',
      '/api/v1/public/home?lang=en',
      '/api/v1/public/home?lang=kn',
    ],
    options
  );
}

/** Purge cached approved comments list for an article after moderation. */
async function purgeArticleComments(articleId, options = {}) {
  if (!articleId) return { skipped: true, purged: 0 };
  return purgeUrls([`/api/v1/articles/${encodeURIComponent(articleId)}/comments`], options);
}

module.exports = {
  MAX_URLS_PER_PURGE,
  buildFullUrls,
  chunkUrls,
  purgeUrls,
  purgeArticle,
  purgeTaxonomy,
  purgeAds,
  purgeArticleComments,
};
