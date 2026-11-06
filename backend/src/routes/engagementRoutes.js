const express = require('express');
const ctrl = require('../controllers/engagementController');
const { authenticate, optionalAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/articles/:id/engagement', optionalAuth, ctrl.engagement);
router.post('/articles/:id/view', ctrl.trackView);
router.post('/articles/:id/like', optionalAuth, ctrl.toggleLike);
router.post('/articles/:id/bookmark', authenticate, ctrl.toggleBookmark);
router.get('/articles/:id/comments', ctrl.listComments);
router.post('/articles/:id/comments', optionalAuth, ctrl.addComment);
router.post('/articles/:id/share', ctrl.share);
router.post('/articles/:id/report', optionalAuth, ctrl.report);
router.get('/me/bookmarks', authenticate, ctrl.listBookmarks);

module.exports = router;
