const { query, tx } = require('../db');
const { asyncHandler, ApiError } = require('../utils/errors');
const { storeImage, resolveImage, imageUrl, deleteImage } = require('../services/imageService');
const { isStaff } = require('../utils/permissions');
const { audit } = require('../utils/audit');

const upload = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(422, 'Attach an image file', 'NO_FILE');
  const stored = await tx((client) =>
    storeImage({
      buffer: req.file.buffer,
      filename: req.file.originalname,
      uploadedBy: req.user.id,
      db: client,
    })
  );
  await audit(null, req.user.id, 'image.uploaded', 'image', stored.id, {
    filename: req.file.originalname,
    bytes: req.file.size,
  });
  res.status(201).json({ image: stored });
});

const serve = asyncHandler(async (req, res) => {
  const variant = ['original', 'optimized', 'thumb'].includes(req.query.variant)
    ? req.query.variant
    : 'original';
  const image = await resolveImage({ query }, req.params.id, variant);
  if (!image) throw new ApiError(404, 'Image not found', 'NOT_FOUND');
  const etag = `"${image.id}-${image.variant}-${image.file_size}"`;
  if (req.headers['if-none-match'] === etag) {
    return res.status(304).end();
  }
  res.set({
    'Content-Type': image.mime_type,
    'Content-Length': String(image.file_size),
    'Cache-Control': 'public, max-age=31536000, immutable',
    ETag: etag,
    'X-Content-Type-Options': 'nosniff',
    'Content-Disposition': 'inline',
  });
  return res.send(image.binary_data);
});

const remove = asyncHandler(async (req, res) => {
  const image = await query('SELECT id, parent_id, uploaded_by FROM images WHERE id = $1', [
    req.params.id,
  ]);
  if (!image.rows[0]) throw new ApiError(404, 'Image not found', 'NOT_FOUND');
  const rootId = image.rows[0].parent_id || image.rows[0].id;
  const owner = await query('SELECT uploaded_by FROM images WHERE id = $1', [rootId]);
  if (!isStaff(req.user) && owner.rows[0]?.uploaded_by !== req.user.id) {
    throw new ApiError(403, 'You can only delete images you uploaded', 'FORBIDDEN');
  }
  const used = await query(
    `SELECT 1 FROM article_images WHERE image_id = $1
     UNION ALL SELECT 1 FROM advertisements WHERE image_id = $1 LIMIT 1`,
    [rootId]
  );
  if (used.rowCount) {
    throw new ApiError(409, 'Image is in use and cannot be deleted', 'IMAGE_IN_USE');
  }
  await deleteImage({ query }, req.params.id);
  await audit(null, req.user.id, 'image.deleted', 'image', rootId);
  res.json({ ok: true });
});

const articleImages = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT i.id, i.width, i.height, i.original_filename, ai.image_type, ai.position, ai.caption
       FROM article_images ai JOIN images i ON i.id = ai.image_id
      WHERE ai.article_id = $1 ORDER BY ai.image_type DESC, ai.position`,
    [req.params.id]
  );
  res.json({
    items: rows.map((row) => ({
      ...row,
      url: imageUrl(row.id, 'original'),
      thumb: imageUrl(row.id, 'thumb'),
      optimized: imageUrl(row.id, 'optimized'),
    })),
  });
});

module.exports = { upload, serve, remove, articleImages };
