const IMMUTABLE = 'public, max-age=31536000, immutable';

function setEdgeTtl(res, value) {
  res.set('CDN-Cache-Control', value);
}

function cloudflareCache(req, res, next) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.set('Cache-Control', 'no-store');
    setEdgeTtl(res, 'no-store');
    return next();
  }

  const path = req.path;

  if (
    path.startsWith('/api/v1/internal') ||
    path.startsWith('/api/v1/auth') ||
    path.startsWith('/api/v1/admin') ||
    path.startsWith('/dashboard') ||
    path.startsWith('/login') ||
    path.startsWith('/register') ||
    path.startsWith('/forgot-password') ||
    path.startsWith('/reset-password')
  ) {
    res.set('Cache-Control', 'no-store');
    setEdgeTtl(res, 'no-store');
    return next();
  }

  if (path.startsWith('/assets/')) {
    setEdgeTtl(res, IMMUTABLE);
  } else if (path.startsWith('/static/')) {
    setEdgeTtl(res, 'public, max-age=3600');
  } else if (path.startsWith('/api/v1/images/')) {
    setEdgeTtl(res, IMMUTABLE);
  } else if (path.startsWith('/api/v1/public/ads/')) {
    // Click and impression endpoints must always bypass edge caching for attribution.
    res.set('Cache-Control', 'no-store');
    setEdgeTtl(res, 'no-store');
    return next();
  } else if (
    path === '/api/v1/public/categories' ||
    path === '/api/v1/public/districts' ||
    /^\/api\/v1\/public\/districts\/[^/]+\/taluks$/.test(path)
  ) {
    res.set('Cache-Control', 'no-cache');
    setEdgeTtl(res, 'public, max-age=3600, stale-while-revalidate=3600, stale-if-error=86400');
  } else if (path === '/api/v1/public/ticker') {
    res.set('Cache-Control', 'no-cache');
    setEdgeTtl(res, 'public, max-age=30, stale-while-revalidate=60, stale-if-error=3600');
  } else if (path.startsWith('/api/v1/public/')) {
    res.set('Cache-Control', 'no-cache');
    setEdgeTtl(res, 'public, max-age=300, stale-while-revalidate=600, stale-if-error=86400');
  } else if (/^\/api\/v1\/articles\/[^/]+\/comments$/.test(path)) {
    res.set('Cache-Control', 'no-cache');
    setEdgeTtl(res, 'public, max-age=60, stale-while-revalidate=120, stale-if-error=3600');
  } else if (/^\/(en|kn)\/news\//.test(path)) {
    setEdgeTtl(res, 'public, max-age=600, stale-while-revalidate=1800, stale-if-error=86400');
  } else if (path === '/sitemap.xml') {
    res.set('Cache-Control', 'public, max-age=300');
    setEdgeTtl(res, 'public, max-age=1800, stale-while-revalidate=1800, stale-if-error=86400');
  } else if (path === '/robots.txt') {
    res.set('Cache-Control', 'public, max-age=3600');
    setEdgeTtl(res, 'public, max-age=3600');
  } else if (path.startsWith('/api/')) {
    res.set('Cache-Control', 'no-store');
    setEdgeTtl(res, 'no-store');
    return next();
  }

  next();
}

module.exports = cloudflareCache;
