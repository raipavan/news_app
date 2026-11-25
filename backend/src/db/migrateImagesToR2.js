const env = require('../config/env');
const { pool, tx } = require('../db');
const { buildObjectKey, putObject } = require('../services/r2Storage');

const BATCH_SIZE = 20;

async function main() {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has('--dry-run');
  const rewriteHtml = args.has('--rewrite-html');

  if (
    !env.r2.accountId ||
    !env.r2.accessKeyId ||
    !env.r2.secretAccessKey ||
    !env.r2.bucketName ||
    !env.r2.publicBaseUrl
  ) {
    console.error(
      '[migrate-r2] R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, and R2_PUBLIC_BASE_URL must be set.'
    );
    process.exit(1);
  }

  let migrated = 0;
  let lastId = '00000000-0000-0000-0000-000000000000';

  while (true) {
    const { rows } = await pool.query(
      `SELECT id, parent_id, variant, mime_type, binary_data
         FROM images
        WHERE storage_provider = 'pg'
          AND binary_data IS NOT NULL
          AND ($1 = FALSE OR id::text > $2)
        ORDER BY id ASC
        LIMIT $3`,
      [dryRun, lastId, BATCH_SIZE]
    );

    if (!rows.length) break;

    for (const row of rows) {
      lastId = row.id;
      const rootId = row.parent_id || row.id;
      const key = buildObjectKey(rootId, row.variant, row.mime_type);

      if (dryRun) {
        console.log(`[migrate-r2] [dry-run] would upload ${row.id} (${row.variant}) -> ${key}`);
        migrated += 1;
        continue;
      }

      await putObject({
        key,
        buffer: row.binary_data,
        contentType: row.mime_type,
      });

      await tx(async (client) => {
        await client.query(
          `UPDATE images
              SET storage_provider = 'r2',
                  storage_key = $1,
                  binary_data = NULL
            WHERE id = $2`,
          [key, row.id]
        );
      });

      migrated += 1;
    }

    console.log(`[migrate-r2] processed ${migrated} image rows so far...`);
  }

  if (rewriteHtml && !dryRun) {
    const base = env.r2.publicBaseUrl.replace(/\/$/, '');
    const optimizedUpdate = await pool.query(
      `UPDATE article_translations
          SET content = regexp_replace(
            content,
            '/api/v1/images/([0-9a-fA-F-]+)\\?variant=optimized',
            $1 || '/images/\\1/optimized.webp',
            'g'
          ),
              updated_at = NOW()
        WHERE content ~ '/api/v1/images/[0-9a-fA-F-]+\\?variant=optimized'`,
      [base]
    );
    const thumbUpdate = await pool.query(
      `UPDATE article_translations
          SET content = regexp_replace(
            content,
            '/api/v1/images/([0-9a-fA-F-]+)\\?variant=thumb',
            $1 || '/images/\\1/thumb.webp',
            'g'
          ),
              updated_at = NOW()
        WHERE content ~ '/api/v1/images/[0-9a-fA-F-]+\\?variant=thumb'`,
      [base]
    );
    console.log(
      `[migrate-r2] rewrote article HTML references (optimized rows: ${optimizedUpdate.rowCount}, thumb rows: ${thumbUpdate.rowCount})`
    );
  }

  console.log(`[migrate-r2] done (${dryRun ? 'dry-run, ' : ''}${migrated} image rows).`);
  if (!dryRun && migrated > 0) {
    console.log('[migrate-r2] Run "VACUUM FULL images;" on PostgreSQL to reclaim disk space.');
  }

  await pool.end();
}

main().catch(async (err) => {
  console.error('[migrate-r2] failed', err);
  try {
    await pool.end();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
