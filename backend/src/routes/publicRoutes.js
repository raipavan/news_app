const express = require('express');
const ctrl = require('../controllers/publicController');

const router = express.Router();

router.get('/home', ctrl.home);
router.get('/latest', ctrl.latest);
router.get('/trending', ctrl.trending);
router.get('/ticker', ctrl.ticker);
router.get('/search', ctrl.search);
router.get('/categories', ctrl.categories);
router.get('/districts', ctrl.districts);
router.get('/category/:slug', ctrl.category);
router.get('/district/:slug', ctrl.district);
router.get('/districts/:slug/taluks', ctrl.taluks);
router.get('/news/:slug', ctrl.newsBySlug);
router.get('/related/:id', ctrl.related);
router.get('/ads', ctrl.ads);
router.post('/ads/:id/impression', ctrl.adImpression);
router.get('/ads/:id/click', ctrl.adClick);

module.exports = router;
