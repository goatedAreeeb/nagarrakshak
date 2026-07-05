/**
 * Applies exactly one already-written migration file against the live DB via a
 * direct Postgres connection. Unlike run-migrations.mjs (which replays
 * schema.sql + every migration in order — only safe on a fresh project), this
 * is for applying one new incremental migration to a database that's already
 * live, without re-running non-idempotent CREATE POLICY/CREATE TABLE statements
 * that already succeeded.
 * Run: node scripts/apply-single-migration.mjs <migration-filename> <db-password>
 */
import { readFileSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../.env');
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i), l.slice(i + 1)];
    })
);

const projectRef = new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0];
const filename = process.argv[2];
const dbPassword = process.argv[3];
if (!filename || !dbPassword) {
  console.error('Usage: node scripts/apply-single-migration.mjs <migration-filename> <db-password>');
  process.exit(1);
}

const migrationPath = resolve(__dirname, '../supabase/migrations', filename);
const sql = readFileSync(migrationPath, 'utf8');

const connectionString = `postgresql://postgres:${encodeURIComponent(dbPassword)}@db.${projectRef}.supabase.co:5432/postgres`;

async function main() {
  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log(`Connected. Applying ${filename}...`);
  try {
    await client.query(sql);
    console.log('  OK');
  } catch (err) {
    console.error(`  FAILED: ${err.message}`);
    await client.end();
    process.exit(1);
  }
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
