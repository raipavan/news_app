const express = require('express');
const multer = require('multer');
const env = require('../config/env');
const ctrl = require('../controllers/imageController');
const { authenticate, requirePermission } = require('../middleware/auth');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.uploadMaxBytes, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!/^image\//i.test(file.mimetype)) {
      const err = new Error('Only image uploads are allowed');
      err.status = 415;
      return cb(err);
    }
    return cb(null, true);
  },
});

router.post('/', authenticate, requirePermission('article.create'), upload.single('image'), ctrl.upload);
router.get('/:id', ctrl.serve);
router.delete('/:id', authenticate, ctrl.remove);

module.exports = router;
