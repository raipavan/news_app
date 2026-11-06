const ROLE_PERMISSIONS = {
  super_admin: ['*'],
  editor: [
    'article.review',
    'article.publish',
    'article.view_any',
    'article.edit_any',
    'article.delete',
    'comment.moderate',
    'report.manage',
    'taxonomy.manage',
    'admin.stats',
  ],
  reporter: [
    'article.create',
    'article.edit_own',
    'article.submit',
    'article.publish_own',
    'article.view_own',
  ],
  contributor: ['article.create', 'article.edit_own', 'article.submit', 'article.view_own'],
  reader: [],
};

const ROLE_LABELS = {
  super_admin: 'Super Admin',
  editor: 'Editor',
  reporter: 'Reporter',
  contributor: 'Community Contributor',
  reader: 'Reader',
};

function permissionsForRoles(roles, canPublish = false) {
  const set = new Set();
  roles.forEach((role) => {
    (ROLE_PERMISSIONS[role] || []).forEach((perm) => {
      if (perm === 'article.publish_own' && !canPublish) return;
      set.add(perm);
    });
  });
  return [...set];
}

function hasPermission(user, permission) {
  if (!user) return false;
  if (user.permissions.includes('*')) return true;
  if (user.permissions.includes(permission)) return true;
  return false;
}

function hasRole(user, role) {
  return Boolean(user && user.roles.includes(role));
}

function isStaff(user) {
  return hasRole(user, 'super_admin') || hasRole(user, 'editor');
}

module.exports = { ROLE_PERMISSIONS, ROLE_LABELS, permissionsForRoles, hasPermission, hasRole, isStaff };
