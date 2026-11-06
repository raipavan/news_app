const app = require('./app');
const env = require('./config/env');
const { pool } = require('./db');

async function start() {
  try {
    await pool.query('SELECT 1');
  } catch (err) {
    console.error('[server] cannot reach PostgreSQL:', err.message);
    console.error('[server] start the database with: docker compose up -d');
    process.exit(1);
  }

  const server = app.listen(env.port, () => {
    console.log(`[server] Thaja Suddi running at http://localhost:${env.port}`);
    console.log(`[server] environment: ${env.nodeEnv}`);
  });

  const shutdown = async (signal) => {
    console.log(`[server] ${signal} received, shutting down`);
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 8000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start();
