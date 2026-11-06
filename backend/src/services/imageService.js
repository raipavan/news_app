const sharp = require('sharp');
const { query } = require('../db');
const { ApiError } = require('../utils/errors');

const SIGNATURES = [
  { mime: 'image/jpeg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/png', test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  {
    mime: 'image/webp',
    test: (b) => b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP',
  },
  { mime: 'image/gif', test: (b) => b.toString('ascii', 0, 3) === 'GIF' },
];

function detectMime(buffer) {
  const match = SIGNATURES.find((sig) => sig.test(buffer));
  return match ? match.mime : null;
}

function imageUrl(id, variant = 'optimized') {
  if (!id) return null;
  const suffix = variant && variant !== 'original' ? `?variant=${variant}` : '';
  return `/api/v1/images/${id}${suffix}`;
}

async function insertImage(db, data) {
  const { rows } = await db.query(
    `INSERT INTO images(binary_data, mime_type, original_filename, file_size, width, height, variant, parent_id, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, mime_type, original_filename, file_size, width, height, variant, parent_id`,
    [
      data.buffer,
      data.mime,
      data.filename || null,
      data.buffer.length,
      data.width || null,
      data.height || null,
      data.variant || 'original',
      data.parentId || null,
      data.uploadedBy || null,
    ]
  );
  return rows[0];
}

async function storeImage({ buffer, filename, uploadedBy, db = { query } }) {
  const mime = detectMime(buffer);
  if (!mime) throw new ApiError(415, 'File content is not a supported image', 'INVALID_IMAGE');
  if (buffer.length > 8 * 1024 * 1024) {
    throw new ApiError(413, 'Image exceeds the 8 MB limit', 'IMAGE_TOO_LARGE');
  }

  let metadata = {};
  try {
    metadata = await sharp(buffer).metadata();
  } catch {
    throw new ApiError(415, 'Image could not be decoded', 'INVALID_IMAGE');
  }
  const width = metadata.width || 0;
  const height = metadata.height || 0;
  if (width < 200 || height < 150) {
    throw new ApiError(422, 'Image must be at least 200x150 pixels', 'IMAGE_TOO_SMALL');
  }
  if (width > 10000 || height > 10000) {
    throw new ApiError(422, 'Image dimensions are too large', 'IMAGE_TOO_LARGE_DIMENSIONS');
  }

  const original = await insertImage(db, {
    buffer,
    mime,
    filename,
    width,
    height,
    variant: 'original',
    uploadedBy,
  });

  const variants = {};
  try {
    const optimized = await sharp(buffer)
      .rotate()
      .resize({ width: 1600, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    const opt = await insertImage(db, {
      buffer: optimized.data,
      mime: 'image/webp',
      filename,
      width: optimized.info.width,
      height: optimized.info.height,
      variant: 'optimized',
      parentId: original.id,
      uploadedBy,
    });
    variants.optimized = opt;

    const thumb = await sharp(buffer)
      .rotate()
      .resize({ width: 480, height: 360, fit: 'cover' })
      .webp({ quality: 76 })
      .toBuffer({ resolveWithObject: true });
    const th = await insertImage(db, {
      buffer: thumb.data,
      mime: 'image/webp',
      filename,
      width: thumb.info.width,
      height: thumb.info.height,
      variant: 'thumb',
      parentId: original.id,
      uploadedBy,
    });
    variants.thumb = th;
  } catch (err) {
    console.warn('[images] variant generation failed', err.message);
  }

  return {
    id: original.id,
    width,
    height,
    mimeType: mime,
    fileSize: buffer.length,
    url: imageUrl(original.id, 'original'),
    optimized_url: variants.optimized ? imageUrl(original.id, 'optimized') : imageUrl(original.id, 'original'),
    thumbnail_url: variants.thumb ? imageUrl(original.id, 'thumb') : imageUrl(original.id, 'original'),
  };
}

async function resolveImage(db, id, variant) {
  if (variant === 'thumb' || variant === 'optimized') {
    const child = await db.query(
      'SELECT * FROM images WHERE parent_id = $1 AND variant = $2 LIMIT 1',
      [id, variant]
    );
    if (child.rows[0]) return child.rows[0];
  }
  const original = await db.query('SELECT * FROM images WHERE id = $1', [id]);
  return original.rows[0] || null;
}

async function deleteImage(db, id) {
  const rows = await db.query('SELECT parent_id FROM images WHERE id = $1', [id]);
  if (!rows.rows[0]) return false;
  const rootId = rows.rows[0].parent_id && rows.rows[0].parent_id !== id ? rows.rows[0].parent_id : id;
  await db.query('DELETE FROM images WHERE parent_id = $1 OR id = $1', [rootId]);
  return true;
}

module.exports = { storeImage, imageUrl, resolveImage, deleteImage, detectMime };
