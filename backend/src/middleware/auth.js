const { verifyAccessToken } = require('../utils/tokens');
const { query } = require('../db');
const { permissionsForRoles } = require('../utils/permissions');
const { ApiError } = require('../utils/errors');

async function loadUser(userId) {
  const { rows } = await query(
    `SELECT u.id, u.name, u.email, u.phone, u.status, u.can_publish,
            COALESCE(array_agg(r.role_name) FILTER (WHERE r.role_name IS NOT NULL), '{}') AS roles
       FROM users u
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       LEFT JOIN roles r ON r.id = ur.role_id
      WHERE u.id = $1
      GROUP BY u.id`,
    [userId]
  );
  const row = rows[0];
  if (!row || row.status !== 'active') return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    status: row.status,
    can_publish: row.can_publish,
    roles: row.roles,
    permissions: permissionsForRoles(row.roles, row.can_publish),
  };
}

async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new ApiError(401, 'Authentication required', 'UNAUTHENTICATED');
    const payload = verifyAccessToken(token);
    const user = await loadUser(payload.sub);
    if (!user) throw new ApiError(401, 'Session is no longer valid', 'UNAUTHENTICATED');
    req.user = user;
    next();
  } catch (err) {
    if (err instanceof ApiError) return next(err);
    return next(new ApiError(401, 'Invalid or expired token', 'UNAUTHENTICATED'));
  }
}

async function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next();
  try {
    const payload = verifyAccessToken(token);
    req.user = await loadUser(payload.sub);
  } catch {
    req.user = null;
  }
  return next();
}

function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) return next(new ApiError(401, 'Authentication required', 'UNAUTHENTICATED'));
    if (req.user.permissions.includes('*') || req.user.permissions.includes(permission)) {
      return next();
    }
    return next(new ApiError(403, 'You do not have permission to perform this action', 'FORBIDDEN'));
  };
}

function requireStaff(req, res, next) {
  if (!req.user) return next(new ApiError(401, 'Authentication required', 'UNAUTHENTICATED'));
  if (req.user.roles.includes('super_admin') || req.user.roles.includes('editor')) return next();
  return next(new ApiError(403, 'Editorial access required', 'FORBIDDEN'));
}

module.exports = { authenticate, optionalAuth, requirePermission, requireStaff, loadUser };
