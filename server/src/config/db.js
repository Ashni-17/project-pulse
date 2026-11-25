import pg from 'pg';
import { env } from './env.js';

// Return DATE columns as plain "YYYY-MM-DD" strings so due dates never shift with timezones.
pg.types.setTypeParser(1082, (value) => value);

export const pool = new pg.Pool({ connectionString: env.databaseUrl });
export const query = (text, params) => pool.query(text, params);

export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
