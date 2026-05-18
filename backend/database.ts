import dotenv from 'dotenv';
import { Pool, PoolClient, QueryResultRow } from 'pg';

dotenv.config();

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined
});

export function generateInviteCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export async function query<T extends QueryResultRow = any>(text: string, params: any[] = []) {
  const result = await pool.query<T>(text, params);
  return result.rows;
}

export async function one<T extends QueryResultRow = any>(text: string, params: any[] = []) {
  const rows = await query<T>(text, params);
  return rows[0] || null;
}

export async function exec(text: string, params: any[] = []) {
  return pool.query(text, params);
}

export async function transaction<T>(callback: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function initDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required. Configure PostgreSQL before starting the backend.');
  }

  await exec('SELECT 1');
  console.log('PostgreSQL connection verified.');
}
