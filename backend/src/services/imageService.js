const crypto = require('crypto');
const sharp = require('sharp');
const { query } = require('../db');
const env = require('../config/env');
const r2Storage = require('./r2Storage');
const { ApiError } = require('../utils/errors');

const UUID_IN_HTML_RE = /\/images\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

/** Resolve public image URL for PG or R2 storage mode. */
function imageUrl(id, variant = 'optimized', storageKey = null, r2Config = env.r2) {
  if (!id) return null;
  if (r2Config?.enabled && r2Config?.publicBaseUrl) {
    if (storageKey) {
      return r2Storage.publicUrlForKey(storageKey, r2Config.publicBaseUrl);
    }
    if (variant === 'optimized' || variant === 'thumb') {
      return `${r2Config.publicBaseUrl.replace(/\/$/, '')}/images/${id}/${variant}.webp`;
    }
    return `/api/v1/images/${id}`;
  }
  const suffix = variant && variant !== 'original' ? `?variant=${variant}` : '';
  return `/api/v1/images/${id}${suffix}`;
}

/** Return an absolute image URL without double-prefixing external R2 CDN URLs. */
function absoluteImageUrl(id, variant = 'optimized', base = '', storageKey = null, r2Config = env.r2) {
  const url = imageUrl(id, variant, storageKey, r2Config);
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${String(base || '').replace(/\/$/, '')}${url}`;
}

async function insertImage(db, data) {
  const id = data.id || crypto.randomUUID();
  const storageProvider = data.storageProvider || 'pg';
  const binaryData = storageProvider === 'r2' ? null : data.buffer;
  const fileSize = data.fileSize ?? (data.buffer ? data.buffer.length : 0);
  const isAdProtected = Boolean(data.isAdProtected);

  const { rows } = await db.query(
    `INSERT INTO images(id, binary_data, mime_type, original_filename, file_size, width, height, variant, parent_id, uploaded_by, storage_provider, storage_key, is_ad_protected)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING id, mime_type, original_filename, file_size, width, height, variant, parent_id, storage_provider, storage_key, is_ad_protected`,
    [
      id,
      binaryData,
      data.mime,
      data.filename || null,
      fileSize,
      data.width || null,
      data.height || null,
      data.variant || 'original',
      data.parentId || null,
      data.uploadedBy || null,
      storageProvider,
      data.storageKey || null,
      isAdProtected,
    ]
  );
  return rows[0];
}

async function buildVariants(buffer) {
  const variants = {};
  try {
    const optimized = await sharp(buffer)
      .rotate()
      .resize({ width: 1600, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    variants.optimized = {
      buffer: optimized.data,
      mime: 'image/webp',
      width: optimized.info.width,
      height: optimized.info.height,
    };

    const thumb = await sharp(buffer)
      .rotate()
      .resize({ width: 480, height: 360, fit: 'cover' })
      .webp({ quality: 76 })
      .toBuffer({ resolveWithObject: true });
    variants.thumb = {
      buffer: thumb.data,
      mime: 'image/webp',
      width: thumb.info.width,
      height: thumb.info.height,
    };
  } catch (err) {
    console.warn('[images] variant generation failed', err.message);
  }
  return variants;
}

async function storeImage({
  buffer,
  filename,
  uploadedBy,
  isAdProtected = false,
  db = { query },
  r2 = r2Storage,
  r2Config = env.r2,
}) {
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

  const generated = await buildVariants(buffer);

  let original;
  const storedVariants = {};

  if (r2Config?.enabled) {
    const rootId = crypto.randomUUID();
    const originalKey = r2.buildObjectKey(rootId, 'original', mime);
    const uploads = [{ key: originalKey, buffer, contentType: mime }];

    let optKey = null;
    if (generated.optimized) {
      optKey = r2.buildObjectKey(rootId, 'optimized', generated.optimized.mime);
      uploads.push({
        key: optKey,
        buffer: generated.optimized.buffer,
        contentType: generated.optimized.mime,
      });
    }

    let thumbKey = null;
    if (generated.thumb) {
      thumbKey = r2.buildObjectKey(rootId, 'thumb', generated.thumb.mime);
      uploads.push({
        key: thumbKey,
        buffer: generated.thumb.buffer,
        contentType: generated.thumb.mime,
      });
    }

    await Promise.all(uploads.map((item) => r2.putObject(item)));
    const uploadedKeys = uploads.map((item) => item.key);

    try {
      original = await insertImage(db, {
        id: rootId,
        fileSize: buffer.length,
        mime,
        filename,
        width,
        height,
        variant: 'original',
        uploadedBy,
        storageProvider: 'r2',
        storageKey: originalKey,
        isAdProtected,
      });

      if (generated.optimized) {
        storedVariants.optimized = await insertImage(db, {
          fileSize: generated.optimized.buffer.length,
          mime: generated.optimized.mime,
          filename,
          width: generated.optimized.width,
          height: generated.optimized.height,
          variant: 'optimized',
          parentId: original.id,
          uploadedBy,
          storageProvider: 'r2',
          storageKey: optKey,
          isAdProtected,
        });
      }

      if (generated.thumb) {
        storedVariants.thumb = await insertImage(db, {
          fileSize: generated.thumb.buffer.length,
          mime: generated.thumb.mime,
          filename,
          width: generated.thumb.width,
          height: generated.thumb.height,
          variant: 'thumb',
          parentId: original.id,
          uploadedBy,
          storageProvider: 'r2',
          storageKey: thumbKey,
          isAdProtected,
        });
      }
    } catch (err) {
      await r2.deleteObjects(uploadedKeys).catch(() => {});
      throw err;
    }
  } else {
    original = await insertImage(db, {
      buffer,
      mime,
      filename,
      width,
      height,
      variant: 'original',
      uploadedBy,
      storageProvider: 'pg',
      isAdProtected,
    });

    if (generated.optimized) {
      storedVariants.optimized = await insertImage(db, {
        buffer: generated.optimized.buffer,
        mime: generated.optimized.mime,
        filename,
        width: generated.optimized.width,
        height: generated.optimized.height,
        variant: 'optimized',
        parentId: original.id,
        uploadedBy,
        storageProvider: 'pg',
        isAdProtected,
      });
    }

    if (generated.thumb) {
      storedVariants.thumb = await insertImage(db, {
        buffer: generated.thumb.buffer,
        mime: generated.thumb.mime,
        filename,
        width: generated.thumb.width,
        height: generated.thumb.height,
        variant: 'thumb',
        parentId: original.id,
        uploadedBy,
        storageProvider: 'pg',
        isAdProtected,
      });
    }
  }

  const fallbackOriginal = imageUrl(original.id, 'original', original.storage_key, r2Config);

  return {
    id: original.id,
    width,
    height,
    mimeType: mime,
    fileSize: buffer.length,
    is_ad_protected: Boolean(isAdProtected),
    url: fallbackOriginal,
    optimized_url: storedVariants.optimized
      ? imageUrl(original.id, 'optimized', storedVariants.optimized.storage_key, r2Config)
      : fallbackOriginal,
    thumbnail_url: storedVariants.thumb
      ? imageUrl(original.id, 'thumb', storedVariants.thumb.storage_key, r2Config)
      : fallbackOriginal,
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

async function deleteImage(db, id, r2 = r2Storage) {
  const rows = await db.query('SELECT id, parent_id FROM images WHERE id = $1', [id]);
  if (!rows.rows[0]) return false;
  const rootId = rows.rows[0].parent_id && rows.rows[0].parent_id !== id ? rows.rows[0].parent_id : id;
  const targets = await db.query(
    'SELECT storage_provider, storage_key FROM images WHERE parent_id = $1 OR id = $1',
    [rootId]
  );
  await db.query('DELETE FROM images WHERE parent_id = $1 OR id = $1', [rootId]);

  const r2Keys = targets.rows
    .filter((row) => row.storage_provider === 'r2' && row.storage_key)
    .map((row) => row.storage_key);
  if (r2Keys.length) {
    try {
      await r2.deleteObjects(r2Keys);
    } catch (err) {
      console.warn('[images] R2 cleanup failed', err.message);
    }
  }
  return true;
}

/** Extract deduplicated lowercase image UUIDs embedded in article HTML. */
function extractInlineImageIds(html) {
  if (!html) return [];
  const ids = new Set();
  for (const match of String(html).matchAll(UUID_IN_HTML_RE)) {
    ids.add(match[1].toLowerCase());
  }
  return [...ids];
}

/** Flag image roots and all their variants as protected advertisement/sponsored media. */
async function markImagesAdProtected(db, imageIds, isProtected = true) {
  const validIds = [...new Set((imageIds || []).map((id) => String(id || '').trim().toLowerCase()).filter((id) => UUID_RE.test(id)))];
  if (!validIds.length) return 0;
  const res = await db.query(
    `UPDATE images
        SET is_ad_protected = $2
      WHERE id = ANY($1::uuid[]) OR parent_id = ANY($1::uuid[])`,
    [validIds, Boolean(isProtected)]
  );
  return res.rowCount || 0;
}

/** Delete an image from PostgreSQL and Cloudflare R2 if no article or ad still references it. */
async function deleteImageIfUnreferenced(db, imageId, r2 = r2Storage) {
  if (!imageId || !UUID_RE.test(String(imageId))) return false;
  const row = await db.query('SELECT id, parent_id FROM images WHERE id = $1', [imageId]);
  if (!row.rows[0]) return false;
  const rootId =
    row.rows[0].parent_id && row.rows[0].parent_id !== imageId ? row.rows[0].parent_id : imageId;

  const used = await db.query(
    `SELECT 1 FROM article_images WHERE image_id = $1
     UNION ALL
     SELECT 1 FROM advertisements WHERE image_id = $1
     LIMIT 1`,
    [rootId]
  );
  if (used.rowCount > 0) return false;

  return deleteImage(db, rootId, r2);
}

module.exports = {
  storeImage,
  imageUrl,
  absoluteImageUrl,
  resolveImage,
  deleteImage,
  deleteImageIfUnreferenced,
  extractInlineImageIds,
  markImagesAdProtected,
  detectMime,
};
