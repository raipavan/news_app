const path = require('path');
const fs = require('fs');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const { ZodError } = require('zod');

const env = require('./config/env');
const { ApiError } = require('./utils/errors');
const authRoutes = require('./routes/authRoutes');
const articleRoutes = require('./routes/articleRoutes');
const imageRoutes = require('./routes/imageRoutes');
const publicRoutes = require('./routes/publicRoutes');
const engagementRoutes = require('./routes/engagementRoutes');
const adminRoutes = require('./routes/adminRoutes');
const ssrController = require('./controllers/ssrController');
const cloudflareCache = require('./middleware/cdnCache');

const app = express();
app.set('trust proxy', env.trustProxy);
app.disable('x-powered-by');

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(
  cors({
    origin: env.corsOrigins,
    credentials: true,
  })
);
if (!env.isProd) app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());
app.use(cloudflareCache);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.rateLimits.api,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: (req) => req.path.startsWith('/images'),
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.rateLimits.auth,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many attempts. Please try again later.', code: 'RATE_LIMITED' },
});
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.rateLimits.write,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: (req) => req.method === 'GET',
});
const commentLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: env.rateLimits.comment,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: (req) => req.method !== 'POST',
  message: { message: 'You are commenting too quickly. Please slow down.', code: 'RATE_LIMITED' },
});

app.use('/api/v1/auth', authLimiter);
app.use('/api/v1/articles/:id/comments', commentLimiter);
app.use('/api/v1', apiLimiter, writeLimiter);

const publicDir = path.join(__dirname, '..', 'public');
const sharedDir = path.join(__dirname, '..', '..', 'shared');
const distDir = path.join(__dirname, '..', '..', 'frontend', 'dist');

app.use('/static', express.static(publicDir, { maxAge: '1h' }));
app.use('/static', express.static(sharedDir, { maxAge: '1h' }));
app.use('/assets', express.static(path.join(distDir, 'assets'), { maxAge: '365d', immutable: true }));

app.get('/health', (req, res) => res.json({ ok: true, service: 'thaja-suddi-api' }));
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1', engagementRoutes);
app.use('/api/v1/articles', articleRoutes);
app.use('/api/v1/images', imageRoutes);
app.use('/api/v1/public', publicRoutes);
app.use('/api/v1/admin', adminRoutes);

app.use('/api', (req, res, next) => next(new ApiError(404, 'API endpoint not found', 'NOT_FOUND')));

app.get('/:lang(kn|en)/news/:slug', ssrController.articlePage);
app.get('/sitemap.xml', ssrController.sitemap);
app.get('/robots.txt', ssrController.robots);

const indexFile = path.join(distDir, 'index.html');
app.use(express.static(distDir, { index: false, maxAge: '1h' }));
app.get('*', (req, res, next) => {
  if (req.method !== 'GET') return next(new ApiError(404, 'Not found', 'NOT_FOUND'));
  if (!fs.existsSync(indexFile)) {
    return res
      .status(503)
      .type('text/plain')
      .send('Frontend build not found. Run "npm run build" and restart the server.');
  }
  res.set('Cache-Control', 'no-cache');
  res.set('CDN-Cache-Control', 'no-store');
  return res.sendFile(indexFile);
});

app.use((req, res) => {
  res.status(404).json({ message: 'Not found', code: 'NOT_FOUND' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof ZodError) {
    return res.status(422).json({
      message: 'Please check the highlighted fields',
      code: 'VALIDATION',
      details: err.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    });
  }
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'Image exceeds the 8 MB limit' : err.message;
    return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 422).json({
      message,
      code: err.code,
    });
  }
  if (err instanceof ApiError) {
    return res.status(err.status).json({ message: err.message, code: err.code, details: err.details });
  }
  if (err && err.code === '22P02') {
    return res.status(400).json({ message: 'Invalid identifier', code: 'INVALID_ID' });
  }
  if (err && err.code === '23505') {
    return res.status(409).json({ message: 'This record already exists', code: 'DUPLICATE' });
  }
  if (err && err.status === 415) {
    return res.status(415).json({ message: err.message, code: 'UNSUPPORTED_MEDIA_TYPE' });
  }
  console.error('[error]', err);
  return res.status(500).json({ message: 'Something went wrong on our side', code: 'INTERNAL' });
});

module.exports = app;
