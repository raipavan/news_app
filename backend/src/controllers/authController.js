const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { query, one, tx } = require('../db');
const env = require('../config/env');
const { ApiError, asyncHandler } = require('../utils/errors');
const {
  signAccessToken,
  randomToken,
  hashToken,
} = require('../utils/tokens');
const { loadUser } = require('../middleware/auth');
const { audit } = require('../utils/audit');
const { cleanText } = require('../utils/sanitize');

const COOKIE_NAME = 'kv_refresh';
const COOKIE_PATH = '/api/v1/auth';

const registerSchema = z.object({
  name: z.string().trim().min(2).max(150),
  email: z.string().trim().email().max(255).optional(),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s]{8,20}$/)
    .optional(),
  password: z.string().min(8).max(128),
});

const loginSchema = z.object({
  identifier: z.string().trim().min(3).max(255),
  password: z.string().min(1).max(128),
});

function setRefreshCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.isProd,
    path: COOKIE_PATH,
    maxAge: env.refreshTtlDays * 24 * 60 * 60 * 1000,
  });
}

async function issueSession(res, userId) {
  const accessToken = signAccessToken(userId);
  const refreshToken = randomToken();
  const expiresAt = new Date(Date.now() + env.refreshTtlDays * 24 * 60 * 60 * 1000);
  await query(
    `INSERT INTO refresh_tokens(user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [userId, hashToken(refreshToken), expiresAt]
  );
  setRefreshCookie(res, refreshToken);
  return accessToken;
}

async function getUserWithRoles(userId) {
  const { rows } = await query(
    `SELECT u.id, u.name, u.email, u.phone, u.status, u.can_publish,
            COALESCE(array_agg(r.role_name) FILTER (WHERE r.role_name IS NOT NULL), '{}') AS roles
       FROM users u
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       LEFT JOIN roles r ON r.id = ur.role_id
      WHERE u.id = $1 GROUP BY u.id`,
    [userId]
  );
  return rows[0] || null;
}

const register = asyncHandler(async (req, res) => {
  const data = registerSchema.parse(req.body);
  if (!data.email && !data.phone) {
    throw new ApiError(422, 'Provide an email address or phone number', 'VALIDATION');
  }
  const name = cleanText(data.name, 150);
  const passwordHash = await bcrypt.hash(data.password, 12);

  const userId = await tx(async (client) => {
    const exists = await client.query(
      `SELECT 1 FROM users WHERE ($1::text IS NOT NULL AND email = $1)
                             OR ($2::text IS NOT NULL AND phone = $2)`,
      [data.email || null, data.phone || null]
    );
    if (exists.rowCount) {
      throw new ApiError(409, 'An account with these details already exists', 'ACCOUNT_EXISTS');
    }
    const { rows } = await client.query(
      `INSERT INTO users(name, email, phone, password_hash, status)
       VALUES ($1, $2, $3, $4, 'active') RETURNING id`,
      [name, data.email || null, data.phone || null, passwordHash]
    );
    const id = rows[0].id;
    await client.query(
      `INSERT INTO user_roles(user_id, role_id)
       SELECT $1, id FROM roles WHERE role_name = 'reader'`,
      [id]
    );
    await audit(client, id, 'auth.register', 'user', id, { email: data.email || null });
    return id;
  });

  const accessToken = await issueSession(res, userId);
  const user = await loadUser(userId);
  res.status(201).json({ accessToken, user });
});

const DEV_ACCOUNTS = [
  { role: 'super_admin', label: 'Super Admin', email: 'admin@thajasuddi.in' },
  { role: 'editor', label: 'Editor', email: 'editor@thajasuddi.in' },
  { role: 'reporter', label: 'Reporter', email: 'reporter@thajasuddi.in' },
  { role: 'contributor', label: 'Contributor', email: 'contributor@thajasuddi.in' },
  { role: 'reader', label: 'Reader', email: 'reader@thajasuddi.in' },
];

const devAccounts = asyncHandler(async (req, res) => {
  if (env.isProd) {
    res.json({ enabled: false, accounts: [] });
    return;
  }
  res.json({
    enabled: true,
    accounts: DEV_ACCOUNTS.map(({ role, label }) => ({ role, label })),
  });
});

const devLogin = asyncHandler(async (req, res) => {
  if (env.isProd) throw new ApiError(404, 'Not found', 'NOT_FOUND');
  const data = z.object({ role: z.string().trim() }).parse(req.body);
  const account = DEV_ACCOUNTS.find((candidate) => candidate.role === data.role);
  if (!account) throw new ApiError(422, 'Unknown demo role', 'VALIDATION');
  const row = await one(
    `SELECT id, status FROM users WHERE lower(email) = lower($1) LIMIT 1`,
    [account.email]
  );
  if (!row) {
    throw new ApiError(404, 'Demo account not seeded. Run npm run seed.', 'DEV_ACCOUNT_MISSING');
  }
  if (row.status !== 'active') {
    throw new ApiError(403, `Demo account is ${row.status}`, 'ACCOUNT_INACTIVE');
  }
  const accessToken = await issueSession(res, row.id);
  const user = await loadUser(row.id);
  await audit(null, row.id, 'auth.dev_login', 'user', row.id, { role: account.role });
  res.json({ accessToken, user });
});

const login = asyncHandler(async (req, res) => {
  const data = loginSchema.parse(req.body);
  const row = await one(
    `SELECT id, password_hash, status FROM users
      WHERE lower(email) = lower($1) OR phone = $1 LIMIT 1`,
    [data.identifier]
  );
  const valid = row ? await bcrypt.compare(data.password, row.password_hash) : false;
  if (!row || !valid) {
    throw new ApiError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
  }
  if (row.status === 'blocked') {
    throw new ApiError(403, 'This account has been blocked', 'ACCOUNT_BLOCKED');
  }
  if (row.status === 'pending') {
    throw new ApiError(403, 'This account is awaiting approval', 'ACCOUNT_PENDING');
  }
  const accessToken = await issueSession(res, row.id);
  const user = await loadUser(row.id);
  await audit(null, row.id, 'auth.login', 'user', row.id);
  res.json({ accessToken, user });
});

const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) throw new ApiError(401, 'No refresh session', 'UNAUTHENTICATED');
  const tokenHash = hashToken(token);
  const row = await one(
    `SELECT rt.id, rt.user_id, rt.expires_at, rt.revoked_at, u.status
       FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id
      WHERE rt.token_hash = $1`,
    [tokenHash]
  );
  if (!row || row.revoked_at || new Date(row.expires_at) < new Date()) {
    throw new ApiError(401, 'Session expired, please sign in again', 'UNAUTHENTICATED');
  }
  if (row.status !== 'active') {
    throw new ApiError(403, 'This account is not active', 'ACCOUNT_INACTIVE');
  }
  await query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1', [row.id]);
  const accessToken = await issueSession(res, row.user_id);
  const user = await loadUser(row.user_id);
  res.json({ accessToken, user });
});

const logout = asyncHandler(async (req, res) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (token) {
    await query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1', [
      hashToken(token),
    ]);
  }
  res.clearCookie(COOKIE_NAME, { path: COOKIE_PATH });
  res.json({ ok: true });
});

const me = asyncHandler(async (req, res) => {
  res.json({ user: req.user });
});

const forgotPassword = asyncHandler(async (req, res) => {
  const email = String(req.body?.email || '').trim();
  if (!email) throw new ApiError(422, 'Email is required', 'VALIDATION');
  const user = await one('SELECT id FROM users WHERE lower(email) = lower($1)', [email]);
  let devToken = null;
  if (user) {
    const token = randomToken(32);
    devToken = env.allowDevResetTokens ? token : null;
    await query(
      `INSERT INTO password_resets(user_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '30 minutes')`,
      [user.id, hashToken(token)]
    );
    await audit(null, user.id, 'auth.password_reset_requested', 'user', user.id);
  }
  res.json({
    message: 'If an account exists for that email, a reset link has been issued.',
    ...(devToken ? { devResetToken: devToken } : {}),
  });
});

const resetPassword = asyncHandler(async (req, res) => {
  const token = String(req.body?.token || '');
  const password = String(req.body?.password || '');
  if (!token || password.length < 8) {
    throw new ApiError(422, 'A valid token and an 8+ character password are required', 'VALIDATION');
  }
  const row = await one(
    `SELECT id, user_id FROM password_resets
      WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()`,
    [hashToken(token)]
  );
  if (!row) throw new ApiError(400, 'Reset token is invalid or expired', 'INVALID_RESET_TOKEN');
  const passwordHash = await bcrypt.hash(password, 12);
  await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [
    passwordHash,
    row.user_id,
  ]);
  await query('UPDATE password_resets SET used_at = NOW() WHERE id = $1', [row.id]);
  await query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL', [
    row.user_id,
  ]);
  await audit(null, row.user_id, 'auth.password_reset', 'user', row.user_id);
  res.json({ ok: true });
});

module.exports = {
  register,
  login,
  refresh,
  logout,
  me,
  forgotPassword,
  resetPassword,
  getUserWithRoles,
  devAccounts,
  devLogin,
  COOKIE_NAME,
  COOKIE_PATH,
};
