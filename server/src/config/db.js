import pg from 'pg';
import { env } from './env.js';

const { Pool } = pg;

const connectionString =
  env.NODE_ENV === 'test' ? env.TEST_DATABASE_URL || env.DATABASE_URL : env.DATABASE_URL;

export const pool = connectionString
  ? new Pool({
      connectionString,
      max: 30,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 20000,
    })
  : null;

/**
 * Execute a parameterized SQL query safely.
 * Always use $1, $2... placeholders — never interpolate user input into SQL text.
 */
export async function query(text, params = []) {
  if (!pool) {
    throw new Error('Database pool is not configured. Check DATABASE_URL in server/.env.');
  }
  return pool.query(text, params);
}

/**
 * Run multiple SQL statements atomically inside a PostgreSQL transaction.
 */
export async function withTransaction(callback) {
  if (!pool) {
    throw new Error('Database pool is not configured. Check DATABASE_URL in server/.env.');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function checkDatabaseHealth() {
  if (!pool) {
    return { connected: false, reason: 'DATABASE_URL not configured' };
  }
  try {
    const res = await pool.query('SELECT NOW() AS server_time');
    return { connected: true, serverTime: res.rows[0].server_time };
  } catch (error) {
    return { connected: false, reason: error.code || 'CONNECTION_FAILED' };
  }
}
