const { S3Client, PutObjectCommand, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
const env = require('../config/env');

const MIME_EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

let cachedClient = null;

function getR2Client() {
  if (!cachedClient) {
    if (!env.r2.accountId || !env.r2.accessKeyId || !env.r2.secretAccessKey || !env.r2.bucketName) {
      throw new Error('Cloudflare R2 credentials are not configured');
    }
    cachedClient = new S3Client({
      region: 'auto',
      endpoint: `https://${env.r2.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.r2.accessKeyId,
        secretAccessKey: env.r2.secretAccessKey,
      },
    });
  }
  return cachedClient;
}

/** Map validated image MIME type to its canonical file extension. */
function extFromMime(mime) {
  return MIME_EXT[mime] || 'bin';
}

/** Build deterministic R2 object key for an image root ID and variant. */
function buildObjectKey(rootId, variant, mime) {
  if (variant === 'optimized') return `images/${rootId}/optimized.webp`;
  if (variant === 'thumb') return `images/${rootId}/thumb.webp`;
  return `images/${rootId}/original.${extFromMime(mime)}`;
}

/** Build the public HTTPS URL for a stored R2 object key. */
function publicUrlForKey(key, baseUrl = env.r2.publicBaseUrl) {
  const base = String(baseUrl || '').replace(/\/$/, '');
  const cleanKey = String(key || '').replace(/^\/+/, '');
  if (!base || !cleanKey) return null;
  return `${base}/${cleanKey}`;
}

/** Upload an image buffer to Cloudflare R2 with immutable 1-year cache headers. */
async function putObject({ key, buffer, contentType }, clientOverride, bucketOverride = env.r2.bucketName) {
  const client = clientOverride || getR2Client();
  await client.send(
    new PutObjectCommand({
      Bucket: bucketOverride,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    })
  );
  return key;
}

/** Batch-delete up to 1,000 object keys per request from Cloudflare R2. */
async function deleteObjects(keys, clientOverride, bucketOverride = env.r2.bucketName) {
  const unique = [...new Set((keys || []).filter(Boolean))];
  if (!unique.length) return 0;
  const client = clientOverride || getR2Client();
  for (let i = 0; i < unique.length; i += 1000) {
    const batch = unique.slice(i, i + 1000);
    await client.send(
      new DeleteObjectsCommand({
        Bucket: bucketOverride,
        Delete: {
          Objects: batch.map((Key) => ({ Key })),
          Quiet: true,
        },
      })
    );
  }
  return unique.length;
}

module.exports = {
  extFromMime,
  buildObjectKey,
  publicUrlForKey,
  putObject,
  deleteObjects,
};
