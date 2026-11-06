const express = require('express');
const ctrl = require('../controllers/adminController');
const {
  authenticate,
  requirePermission,
  requireStaff,
} = require('../middleware/auth');
const { ApiError } = require('../utils/errors');

const router = express.Router();

router.use(authenticate);

function superAdminOnly(req, res, next) {
  if (req.user.roles.includes('super_admin')) return next();
  return next(new ApiError(403, 'Super admin access required', 'FORBIDDEN'));
}

router.get('/dashboard', requireStaff, ctrl.dashboard);
router.get('/pending-articles', requireStaff, ctrl.pendingArticles);
router.get('/analytics', requireStaff, ctrl.analytics);

router.get('/users', superAdminOnly, ctrl.listUsers);
router.post('/users', superAdminOnly, ctrl.createUser);
router.put('/users/:id/status', superAdminOnly, ctrl.updateUserStatus);
router.put('/users/:id/roles', superAdminOnly, ctrl.updateUserRoles);
router.put('/users/:id/name', superAdminOnly, ctrl.updateUserName);
router.put('/users/:id/publisher', superAdminOnly, ctrl.updatePublisher);

router.get('/categories', superAdminOnly, ctrl.listCategories);
router.post('/categories', superAdminOnly, ctrl.createCategory);
router.put('/categories/:id', superAdminOnly, ctrl.updateCategory);

router.get('/districts', superAdminOnly, ctrl.listDistricts);
router.post('/districts', superAdminOnly, ctrl.createDistrict);
router.put('/districts/:id', superAdminOnly, ctrl.updateDistrict);

router.get('/comments', requirePermission('comment.moderate'), ctrl.listComments);
router.put('/comments/:id', requirePermission('comment.moderate'), ctrl.moderateComment);

router.get('/reports', requirePermission('report.manage'), ctrl.listReports);
router.put('/reports/:id', requirePermission('report.manage'), ctrl.resolveReport);

router.get('/advertisements', superAdminOnly, ctrl.listAds);
router.post('/advertisements', superAdminOnly, ctrl.createAd);
router.put('/advertisements/:id', superAdminOnly, ctrl.updateAd);
router.delete('/advertisements/:id', superAdminOnly, ctrl.deleteAd);

router.get('/audit-logs', superAdminOnly, ctrl.auditLogs);

module.exports = router;
