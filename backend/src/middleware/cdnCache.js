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
    // Click and impression endpoints must always reach the origin for attribution.
    res.set('Cache-Control', 'no-store');
    setEdgeTtl(res, 'no-store');
    return next();
  } else if (path === '/api/v1/public/ticker') {
    res.set('Cache-Control', 'no-cache');
    setEdgeTtl(res, 'public, max-age=15, stale-while-revalidate=15');
  } else if (path.startsWith('/api/v1/public/')) {
    res.set('Cache-Control', 'no-cache');
    setEdgeTtl(res, 'public, max-age=60, stale-while-revalidate=30');
  } else if (/^\/(en|kn)\/news\//.test(path)) {
    setEdgeTtl(res, 'public, max-age=300, stale-while-revalidate=60');
  } else if (path === '/sitemap.xml') {
    res.set('Cache-Control', 'public, max-age=300');
    setEdgeTtl(res, 'public, max-age=600');
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
