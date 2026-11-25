const express = require('express');
const ctrl = require('../controllers/internalController');

const router = express.Router();

router.use(ctrl.requireInternalSecret);
router.post('/analytics/flush', ctrl.flushAnalytics);

module.exports = router;
