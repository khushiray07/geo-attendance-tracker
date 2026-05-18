import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { exec, pool } from '../database';

dotenv.config();

async function migrate() {
  const schemaPath = path.join(__dirname, '..', 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  await exec(schema);
  console.log('PostgreSQL schema migrated successfully.');
}

migrate()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
