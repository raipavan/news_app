const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  makeRequireInternalSecret,
  makeFlushAnalytics,
} = require('../src/controllers/internalController');

function runMiddleware(mw, req) {
  return new Promise((resolve) => {
    mw(req, {}, (err) => resolve(err || null));
  });
}

describe('internal analytics flush endpoint', () => {
  it('enforces X-Internal-Secret safely (404 unconfigured, 401 mismatch, pass on match)', async () => {
    const disabledMw = makeRequireInternalSecret(() => '');
    const disabledErr = await runMiddleware(disabledMw, { headers: { 'x-internal-secret': 'abc' } });
    assert.equal(disabledErr.status, 404);

    const activeMw = makeRequireInternalSecret(() => 'super-secret-value');
    const missingErr = await runMiddleware(activeMw, { headers: {} });
    assert.equal(missingErr.status, 401);

    const wrongLenErr = await runMiddleware(activeMw, { headers: { 'x-internal-secret': 'short' } });
    assert.equal(wrongLenErr.status, 401);

    const wrongValErr = await runMiddleware(activeMw, {
      headers: { 'x-internal-secret': 'super-secret-valuX' },
    });
    assert.equal(wrongValErr.status, 401);

    const okErr = await runMiddleware(activeMw, {
      headers: { 'x-internal-secret': 'super-secret-value' },
    });
    assert.equal(okErr, null);
  });

  it('validates payloads and executes bulk UNNEST queries in one transaction', async () => {
    const queries = [];
    const fakeTx = async (fn) =>
      fn({
        query: async (sql, params) => {
          queries.push({ sql, params });
          return { rowCount: params[0].length };
        },
      });

    const handler = makeFlushAnalytics(fakeTx);

    const makeRes = () => {
      const out = { statusCode: 200, body: null };
      return {
        out,
        status(code) {
          out.statusCode = code;
          return this;
        },
        json(payload) {
          out.body = payload;
          return this;
        },
      };
    };

    const a1 = '11111111-1111-4111-8111-111111111111';
    const a2 = '22222222-2222-4222-8222-222222222222';
    const ad1 = '33333333-3333-4333-8333-333333333333';

    const res = makeRes();
    let nextErr = null;
    await handler(
      {
        body: {
          views: [
            { articleId: a1, visitorHash: 'v1', unique: true },
            { articleId: a1, visitorHash: 'v1', unique: false },
            { articleId: a1, visitorHash: 'v2', unique: true },
            { articleId: a2, visitorHash: 'v3', unique: true },
          ],
          impressions: [{ adId: ad1, visitorHash: 'v1' }],
        },
      },
      res,
      (err) => {
        nextErr = err;
      }
    );

    assert.equal(nextErr, null);
    assert.equal(res.out.body.ok, true);
    assert.equal(res.out.body.viewsInserted, 4);
    assert.equal(res.out.body.uniqueIncremented, 2);
    assert.equal(res.out.body.impressionsInserted, 1);
    assert.equal(queries.length, 3);
    assert.deepEqual(queries[1].params[0], [a1, a2]);
    assert.deepEqual(queries[1].params[1], [2, 1]);

    // Invalid UUID should trigger Zod validation error passed to Express error middleware
    const badRes = makeRes();
    let validationErr = null;
    await handler(
      { body: { views: [{ articleId: 'not-a-uuid', visitorHash: 'v1' }] } },
      badRes,
      (err) => {
        validationErr = err;
      }
    );
    assert.ok(validationErr);
  });
});
