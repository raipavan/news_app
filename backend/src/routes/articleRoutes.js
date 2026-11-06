const express = require('express');
const ctrl = require('../controllers/articleController');
const imageCtrl = require('../controllers/imageController');
const { authenticate, requirePermission, requireStaff } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.get('/', ctrl.listArticles);
router.post('/', requirePermission('article.create'), ctrl.createArticle);
router.get('/by-slug/:slug', ctrl.getArticleBySlug);

router.get('/:id/images', imageCtrl.articleImages);
router.get('/:id', ctrl.getArticle);
router.put('/:id', ctrl.updateArticle);
router.delete('/:id', ctrl.archiveArticle);
router.delete('/:id/permanent', requirePermission('article.delete'), ctrl.deleteArticle);
router.post('/:id/submit', requirePermission('article.submit'), ctrl.submitArticle);
router.post('/:id/approve', requirePermission('article.review'), ctrl.approveArticle);
router.post('/:id/reject', requirePermission('article.review'), ctrl.rejectArticle);
router.post('/:id/publish', ctrl.publishArticle);
router.post('/:id/translations', requirePermission('article.create'), ctrl.addTranslation);
router.post('/:id/corrections', ctrl.submitCorrection);
router.post('/:id/revisions/:revisionId/apply', requireStaff, ctrl.applyRevision);

module.exports = router;
