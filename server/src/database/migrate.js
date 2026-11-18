import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

/**
 * Runs all unapplied .sql files in migrations/ in lexicographical order.
 * Tracks applied filenames inside `schema_migrations` so re-running is idempotent.
 */
export async function runMigrations(targetPool = pool) {
  if (!targetPool) {
    throw new Error('DATABASE_URL is not configured. Create server/.env before running migrations.');
  }

  const client = await targetPool.connect();
  const appliedNow = [];

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const files = (await fs.readdir(MIGRATIONS_DIR))
      .filter((file) => file.endsWith('.sql'))
      .sort();

    const { rows } = await client.query('SELECT filename FROM schema_migrations');
    const alreadyApplied = new Set(rows.map((r) => r.filename));

    for (const file of files) {
      if (alreadyApplied.has(file)) {
        continue;
      }

      const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        appliedNow.push(file);
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Migration failed in ${file}: ${err.message}`, { cause: err });
      }
    }

    return { appliedNow, totalFiles: files.length };
  } finally {
    client.release();
  }
}

// Execute when run directly via `npm run db:migrate`
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  runMigrations()
    .then(({ appliedNow, totalFiles }) => {
      if (appliedNow.length === 0) {
        console.log(`Database is already up to date (${totalFiles} migrations verified).`);
      } else {
        console.log(`Applied ${appliedNow.length} migration(s):`);
        appliedNow.forEach((file) => console.log(`  - ${file}`));
      }
    })
    .catch((err) => {
      console.error('Migration error:', err.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      if (pool) await pool.end();
    });
}
