const bcrypt = require('bcryptjs');
const { pool } = require('./index');

function usage(message) {
  if (message) console.error(`[admin] ${message}`);
  console.error('[admin] usage: npm run admin:create -- <email> <password> [name]');
  process.exit(1);
}

async function main() {
  const [emailArg, password, ...nameParts] = process.argv.slice(2);
  const email = String(emailArg || '').trim().toLowerCase();
  const name = nameParts.join(' ').trim() || 'Administrator';

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) usage('a valid email address is required');
  if (!password || password.length < 12) usage('password must be at least 12 characters');

  const passwordHash = await bcrypt.hash(password, 12);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const role = await client.query('SELECT id FROM roles WHERE role_name = $1', ['super_admin']);
    if (!role.rowCount) {
      throw new Error('super_admin role is missing; run `npm run seed` first');
    }

    const existing = await client.query('SELECT id FROM users WHERE lower(email) = $1', [email]);
    let userId;
    if (existing.rowCount) {
      userId = existing.rows[0].id;
      await client.query(
        `UPDATE users
            SET name = $1, password_hash = $2, status = 'active', updated_at = NOW()
          WHERE id = $3`,
        [name, passwordHash, userId]
      );
      console.log(`[admin] updated existing account ${email}`);
    } else {
      const inserted = await client.query(
        `INSERT INTO users(name, email, password_hash, status, can_publish)
         VALUES ($1, $2, $3, 'active', true) RETURNING id`,
        [name, email, passwordHash]
      );
      userId = inserted.rows[0].id;
      console.log(`[admin] created account ${email}`);
    }

    await client.query(
      `INSERT INTO user_roles(user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [userId, role.rows[0].id]
    );
    await client.query('COMMIT');
    console.log('[admin] super_admin role assigned');
    console.log('[admin] sign in with the email and password you supplied');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  await pool.end();
}

main().catch((err) => {
  console.error('[admin] failed:', err.message);
  process.exit(1);
});
