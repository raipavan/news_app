const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const DEV_ACCESS_SECRET = 'dev-access-secret-change-me-in-production';
const DEV_REFRESH_SECRET = 'dev-refresh-secret-change-me-in-production';
const explicitNodeEnv = process.env.NODE_ENV;
const nodeEnv = explicitNodeEnv || 'development';
const isProd = nodeEnv === 'production';

if (!explicitNodeEnv) {
  console.warn('[env] NODE_ENV is not set; using development mode. Set NODE_ENV=production in production.');
}

function list(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function positiveInt(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function parseTrustProxy(value) {
  if (value === undefined || value === '') return 1;
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^\d+$/.test(value)) return Number(value);
  return value;
}

const publicBaseUrl = (process.env.PUBLIC_BASE_URL || process.env.RENDER_EXTERNAL_URL || '').replace(
  /\/$/,
  ''
);
const imageStorage = (process.env.IMAGE_STORAGE || 'pg').toLowerCase() === 'r2' ? 'r2' : 'pg';
const r2PublicBaseUrl = (process.env.R2_PUBLIC_BASE_URL || '').replace(/\/$/, '');
const cfZoneId = (process.env.CF_ZONE_ID || '').trim();
const cfApiToken = (process.env.CF_API_TOKEN || '').trim();
const defaultCorsOrigins = isProd
  ? []
  : ['http://localhost:5173', 'http://127.0.0.1:5173'];

const env = {
  nodeEnv,
  port: Number(process.env.PORT || 4000),
  databaseUrl:
    process.env.DATABASE_URL ||
    'postgres://news:news@localhost:5434/karnataka_news',
  dbPoolMax: positiveInt('DB_POOL_MAX', 12),
  accessSecret: process.env.ACCESS_TOKEN_SECRET || DEV_ACCESS_SECRET,
  refreshSecret: process.env.REFRESH_TOKEN_SECRET || DEV_REFRESH_SECRET,
  accessTtl: process.env.ACCESS_TOKEN_TTL || '30m',
  refreshTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS || 14),
  publicBaseUrl,
  uploadMaxBytes: Number(process.env.UPLOAD_MAX_BYTES || 8 * 1024 * 1024),
  isProd,
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
  corsOrigins: process.env.CORS_ORIGINS
    ? list(process.env.CORS_ORIGINS)
    : defaultCorsOrigins,
  rateLimits: {
    api: positiveInt('RATE_LIMIT_API', 1200),
    auth: positiveInt('RATE_LIMIT_AUTH', 80),
    write: positiveInt('RATE_LIMIT_WRITE', 300),
    comment: positiveInt('RATE_LIMIT_COMMENT', 8),
  },
  allowDevResetTokens:
    explicitNodeEnv === 'development' &&
    process.env.ALLOW_DEV_RESET_TOKENS !== 'false',
  r2: {
    storage: imageStorage,
    enabled: imageStorage === 'r2',
    accountId: (process.env.R2_ACCOUNT_ID || '').trim(),
    accessKeyId: (process.env.R2_ACCESS_KEY_ID || '').trim(),
    secretAccessKey: (process.env.R2_SECRET_ACCESS_KEY || '').trim(),
    bucketName: (process.env.R2_BUCKET_NAME || '').trim(),
    publicBaseUrl: r2PublicBaseUrl,
  },
  cloudflare: {
    zoneId: cfZoneId,
    apiToken: cfApiToken,
    purgeEnabled: Boolean(cfZoneId && cfApiToken && publicBaseUrl),
    purgeMode:
      (process.env.CF_CACHE_PURGE_MODE || 'urls').toLowerCase() === 'everything'
        ? 'everything'
        : 'urls',
  },
  internalFlushSecret: (process.env.INTERNAL_FLUSH_SECRET || '').trim(),
};

function assertProductionConfig() {
  if (!isProd) return;
  const problems = [];

  if (
    !process.env.ACCESS_TOKEN_SECRET ||
    env.accessSecret === DEV_ACCESS_SECRET ||
    env.accessSecret.length < 32
  ) {
    problems.push('ACCESS_TOKEN_SECRET must be a random value of at least 32 characters');
  }

  if (
    !process.env.REFRESH_TOKEN_SECRET ||
    env.refreshSecret === DEV_REFRESH_SECRET ||
    env.refreshSecret.length < 32
  ) {
    problems.push('REFRESH_TOKEN_SECRET must be a random value of at least 32 characters');
  }

  if (!publicBaseUrl) {
    problems.push('PUBLIC_BASE_URL is required');
  } else {
    try {
      const url = new URL(publicBaseUrl);
      if (url.protocol !== 'https:') {
        problems.push('PUBLIC_BASE_URL must use https');
      }
    } catch {
      problems.push('PUBLIC_BASE_URL must be a valid absolute URL');
    }
  }

  if (!process.env.DATABASE_URL || /news:news@/i.test(env.databaseUrl)) {
    problems.push('DATABASE_URL must be set to a production database connection');
  }

  if (env.r2.enabled) {
    if (!env.r2.accountId) problems.push('R2_ACCOUNT_ID is required when IMAGE_STORAGE=r2');
    if (!env.r2.accessKeyId) problems.push('R2_ACCESS_KEY_ID is required when IMAGE_STORAGE=r2');
    if (!env.r2.secretAccessKey) problems.push('R2_SECRET_ACCESS_KEY is required when IMAGE_STORAGE=r2');
    if (!env.r2.bucketName) problems.push('R2_BUCKET_NAME is required when IMAGE_STORAGE=r2');
    if (!env.r2.publicBaseUrl) {
      problems.push('R2_PUBLIC_BASE_URL is required when IMAGE_STORAGE=r2');
    } else {
      try {
        const r2Url = new URL(env.r2.publicBaseUrl);
        if (r2Url.protocol !== 'https:') {
          problems.push('R2_PUBLIC_BASE_URL must use https');
        }
      } catch {
        problems.push('R2_PUBLIC_BASE_URL must be a valid absolute URL');
      }
    }
  }

  if (problems.length) {
    console.error('[env] Invalid production configuration:');
    for (const problem of problems) {
      console.error(`[env] - ${problem}`);
    }
    process.exit(1);
  }
}

assertProductionConfig();

module.exports = env;
