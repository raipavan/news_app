const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');

const {
  imageUrl,
  absoluteImageUrl,
  storeImage,
  deleteImage,
} = require('../src/services/imageService');
const {
  extFromMime,
  buildObjectKey,
  publicUrlForKey,
  putObject,
  deleteObjects,
} = require('../src/services/r2Storage');

describe('r2Storage helpers', () => {
  it('maps MIME types and builds deterministic object keys', () => {
    assert.equal(extFromMime('image/jpeg'), 'jpg');
    assert.equal(extFromMime('image/png'), 'png');
    assert.equal(extFromMime('image/webp'), 'webp');
    assert.equal(extFromMime('image/gif'), 'gif');
    assert.equal(extFromMime('application/octet-stream'), 'bin');

    const id = '11111111-1111-1111-1111-111111111111';
    assert.equal(buildObjectKey(id, 'optimized', 'image/png'), `images/${id}/optimized.webp`);
    assert.equal(buildObjectKey(id, 'thumb', 'image/png'), `images/${id}/thumb.webp`);
    assert.equal(buildObjectKey(id, 'original', 'image/jpeg'), `images/${id}/original.jpg`);
    assert.equal(
      publicUrlForKey(`images/${id}/optimized.webp`, 'https://media.example.com/'),
      `https://media.example.com/images/${id}/optimized.webp`
    );
  });

  it('sends PutObjectCommand with immutable cache headers and chunks DeleteObjectsCommand', async () => {
    const sent = [];
    const mockClient = {
      send: async (cmd) => {
        sent.push(cmd);
        return {};
      },
    };

    await putObject(
      { key: 'images/abc/optimized.webp', buffer: Buffer.from('webp'), contentType: 'image/webp' },
      mockClient,
      'bucket-1'
    );
    assert.equal(sent.length, 1);
    assert.equal(sent[0].input.Bucket, 'bucket-1');
    assert.equal(sent[0].input.Key, 'images/abc/optimized.webp');
    assert.equal(sent[0].input.ContentType, 'image/webp');
    assert.equal(sent[0].input.CacheControl, 'public, max-age=31536000, immutable');

    const keys = Array.from({ length: 1005 }, (_, i) => `images/${i}/thumb.webp`);
    const deleted = await deleteObjects(keys, mockClient, 'bucket-1');
    assert.equal(deleted, 1005);
    assert.equal(sent.length, 3);
    assert.equal(sent[1].input.Delete.Objects.length, 1000);
    assert.equal(sent[2].input.Delete.Objects.length, 5);
  });
});

describe('imageService URL resolution and R2 upload/delete', () => {
  const id = '22222222-2222-2222-2222-222222222222';
  const r2Config = { enabled: true, publicBaseUrl: 'https://media.thajasuddi.in' };
  const pgConfig = { enabled: false, publicBaseUrl: '' };

  it('builds PG and R2 image URLs without double-prefixing SSR OG image URLs', () => {
    assert.equal(imageUrl(null), null);
    assert.equal(imageUrl(id, 'optimized', null, pgConfig), `/api/v1/images/${id}?variant=optimized`);
    assert.equal(imageUrl(id, 'original', null, pgConfig), `/api/v1/images/${id}`);
    assert.equal(
      absoluteImageUrl(id, 'optimized', 'https://thajasuddi.in', null, pgConfig),
      `https://thajasuddi.in/api/v1/images/${id}?variant=optimized`
    );

    assert.equal(
      imageUrl(id, 'optimized', null, r2Config),
      `https://media.thajasuddi.in/images/${id}/optimized.webp`
    );
    assert.equal(
      imageUrl(id, 'thumb', null, r2Config),
      `https://media.thajasuddi.in/images/${id}/thumb.webp`
    );
    assert.equal(
      imageUrl(id, 'original', `images/${id}/original.png`, r2Config),
      `https://media.thajasuddi.in/images/${id}/original.png`
    );
    assert.equal(imageUrl(id, 'original', null, r2Config), `/api/v1/images/${id}`);
    assert.equal(
      absoluteImageUrl(id, 'optimized', 'https://thajasuddi.in', null, r2Config),
      `https://media.thajasuddi.in/images/${id}/optimized.webp`
    );
  });

  it('uploads 3 variants to R2 with NULL binary_data and cleans up on DB failure', async () => {
    const pngBuffer = await sharp({
      create: { width: 320, height: 240, channels: 3, background: { r: 10, g: 20, b: 30 } },
    })
      .png()
      .toBuffer();

    const uploaded = [];
    const deleted = [];
    const fakeR2 = {
      buildObjectKey,
      publicUrlForKey,
      putObject: async (item) => {
        uploaded.push(item);
        return item.key;
      },
      deleteObjects: async (keys) => {
        deleted.push(...keys);
        return keys.length;
      },
    };

    const inserts = [];
    const fakeDb = {
      query: async (sql, params) => {
        inserts.push(params);
        return {
          rows: [
            {
              id: params[0],
              mime_type: params[2],
              original_filename: params[3],
              file_size: params[4],
              width: params[5],
              height: params[6],
              variant: params[7],
              parent_id: params[8],
              storage_provider: params[10],
              storage_key: params[11],
            },
          ],
        };
      },
    };

    const res = await storeImage({
      buffer: pngBuffer,
      filename: 'test.png',
      uploadedBy: 'user-1',
      db: fakeDb,
      r2: fakeR2,
      r2Config,
    });

    assert.equal(uploaded.length, 3);
    assert.equal(inserts.length, 3);
    for (const params of inserts) {
      assert.equal(params[1], null); // binary_data is NULL in R2 mode
      assert.equal(params[10], 'r2');
    }
    assert.match(res.url, /^https:\/\/media\.thajasuddi\.in\/images\/.+\/original\.png$/);
    assert.match(res.optimized_url, /^https:\/\/media\.thajasuddi\.in\/images\/.+\/optimized\.webp$/);
    assert.match(res.thumbnail_url, /^https:\/\/media\.thajasuddi\.in\/images\/.+\/thumb\.webp$/);

    // Verify rollback deletes uploaded R2 objects if DB insert throws
    const failingDb = {
      query: async () => {
        throw new Error('db down');
      },
    };
    await assert.rejects(
      () =>
        storeImage({
          buffer: pngBuffer,
          filename: 'fail.png',
          uploadedBy: 'user-1',
          db: failingDb,
          r2: fakeR2,
          r2Config,
        }),
      /db down/
    );
    assert.equal(deleted.length, 3);
  });

  it('deletes R2 keys when deleting an image', async () => {
    const removedKeys = [];
    const fakeR2 = {
      deleteObjects: async (keys) => {
        removedKeys.push(...keys);
      },
    };
    const fakeDb = {
      query: async (sql) => {
        if (sql.startsWith('SELECT id, parent_id')) {
          return { rows: [{ id, parent_id: null }] };
        }
        if (sql.startsWith('SELECT storage_provider')) {
          return {
            rows: [
              { storage_provider: 'r2', storage_key: `images/${id}/original.png` },
              { storage_provider: 'r2', storage_key: `images/${id}/optimized.webp` },
              { storage_provider: 'pg', storage_key: null },
            ],
          };
        }
        return { rows: [], rowCount: 3 };
      },
    };

    const ok = await deleteImage(fakeDb, id, fakeR2);
    assert.equal(ok, true);
    assert.deepEqual(removedKeys, [
      `images/${id}/original.png`,
      `images/${id}/optimized.webp`,
    ]);
  });
});
