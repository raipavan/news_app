const { query } = require('../db');

async function audit(db, userId, action, entity, entityId, metadata = null) {
  const runner = db && db.query ? db : { query };
  try {
    await runner.query(
      `INSERT INTO audit_logs(user_id, action, entity, entity_id, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId || null, action, entity || null, entityId ? String(entityId) : null, metadata]
    );
  } catch (err) {
    console.error('[audit] failed to write entry', err.message);
  }
}

module.exports = { audit };
