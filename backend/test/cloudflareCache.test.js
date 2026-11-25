const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  buildFullUrls,
  chunkUrls,
  purgeUrls,
  purgeArticle,
  purgeTaxonomy,
  purgeAds,
  purgeArticleComments,
} = require('../src/services/cloudflareCache');

describe('cloudflareCache service', () => {
  it('deduplicates and normalizes URLs against baseUrl', () => {
    const urls = buildFullUrls(
      [
        '/api/v1/public/home?lang=en',
        'api/v1/public/home?lang=en',
        'https://thajasuddi.in/sitemap.xml',
        '/sitemap.xml',
        '',
        null,
      ],
      'https://thajasuddi.in/'
    );
    assert.deepEqual(urls, [
      'https://thajasuddi.in/api/v1/public/home?lang=en',
      'https://thajasuddi.in/sitemap.xml',
    ]);
  });

  it('chunks URLs to at most 30 per Cloudflare purge API call', () => {
    const input = Array.from({ length: 65 }, (_, i) => `https://example.com/${i}`);
    const chunks = chunkUrls(input);
    assert.equal(chunks.length, 3);
    assert.equal(chunks[0].length, 30);
    assert.equal(chunks[1].length, 30);
    assert.equal(chunks[2].length, 5);
  });

  it('skips cleanly when Cloudflare purge is not configured', async () => {
    let called = false;
    const res = await purgeUrls(['/sitemap.xml'], {
      cfConfig: { zoneId: '', apiToken: '', purgeEnabled: false, purgeMode: 'urls' },
      baseUrl: 'https://example.com',
      fetchImpl: async () => {
        called = true;
        return { ok: true };
      },
    });
    assert.equal(res.skipped, true);
    assert.equal(called, false);
  });

  it('posts chunked URL purge batches and swallows HTTP/network errors', async () => {
    const calls = [];
    const paths = Array.from({ length: 35 }, (_, i) => `/en/news/story-${i}`);
    const res = await purgeUrls(paths, {
      cfConfig: { zoneId: 'zone123', apiToken: 'tok456', purgeEnabled: true, purgeMode: 'urls' },
      baseUrl: 'https://example.com',
      fetchImpl: async (url, init) => {
        calls.push({ url, init, body: JSON.parse(init.body) });
        return { ok: true, status: 200 };
      },
    });

    assert.equal(res.ok, true);
    assert.equal(res.purged, 35);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].url, 'https://api.cloudflare.com/client/v4/zones/zone123/purge_cache');
    assert.equal(calls[0].init.headers.Authorization, 'Bearer tok456');
    assert.equal(calls[0].body.files.length, 30);
    assert.equal(calls[1].body.files.length, 5);

    const errRes = await purgeUrls(['/sitemap.xml'], {
      cfConfig: { zoneId: 'zone123', apiToken: 'tok456', purgeEnabled: true, purgeMode: 'urls' },
      baseUrl: 'https://example.com',
      fetchImpl: async () => {
        throw new Error('network down');
      },
    });
    assert.equal(errRes.ok, false);
  });

  it('purges expected article, taxonomy, ads, and comment URLs', async () => {
    const purgedFiles = [];
    const opts = {
      cfConfig: { zoneId: 'z1', apiToken: 't1', purgeEnabled: true, purgeMode: 'urls' },
      baseUrl: 'https://news.test',
      fetchImpl: async (_url, init) => {
        purgedFiles.push(...JSON.parse(init.body).files);
        return { ok: true };
      },
    };

    await purgeArticle(
      {
        translations: [
          { language: 'en', slug: 'hello-world' },
          { language: 'kn', slug: 'namaskara' },
        ],
        categorySlug: 'bengaluru',
        districtSlug: 'mysuru',
      },
      opts
    );

    assert.ok(purgedFiles.includes('https://news.test/en/news/hello-world'));
    assert.ok(purgedFiles.includes('https://news.test/kn/news/namaskara'));
    assert.ok(purgedFiles.includes('https://news.test/api/v1/public/home?lang=en'));
    assert.ok(purgedFiles.includes('https://news.test/api/v1/public/category/bengaluru?lang=kn'));
    assert.ok(purgedFiles.includes('https://news.test/api/v1/public/district/mysuru?lang=en'));

    purgedFiles.length = 0;
    await purgeTaxonomy(opts);
    assert.ok(purgedFiles.includes('https://news.test/api/v1/public/categories?lang=en'));
    assert.ok(purgedFiles.includes('https://news.test/api/v1/public/districts?lang=kn'));

    purgedFiles.length = 0;
    await purgeAds(opts);
    assert.ok(purgedFiles.includes('https://news.test/api/v1/public/ads'));

    purgedFiles.length = 0;
    await purgeArticleComments('art-123', opts);
    assert.deepEqual(purgedFiles, ['https://news.test/api/v1/articles/art-123/comments']);
  });
});
