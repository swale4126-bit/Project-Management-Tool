import app from './app.js';
import { env } from './config/env.js';
import { pool } from './config/db.js';

const server = app.listen(env.PORT, () => {
  console.log(`FieldLedger API running on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

async function shutdown(signal) {
  console.log(`\nReceived ${signal}. Shutting down FieldLedger API gracefully...`);
  server.close(async () => {
    if (pool) {
      await pool.end();
    }
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
