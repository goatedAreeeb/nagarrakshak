/**
 * Data-only backup of every table migration 0010 touches, taken immediately
 * before running it. No pg_dump binary available in this environment, so this
 * is the practical equivalent: full row export via the `pg` client (already a
 * project dependency) to JSON files. Schema itself needs no backup — it's
 * fully reproducible from the versioned migration files in git; only the live
 * row data in tables being dropped/frozen is actually at risk.
 * Run: node scripts/backup-before-0010.mjs <db-password> <output-dir>
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(resolve(__dirname, '../.env'), 'utf8')
    .split('\n').filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; })
);

const dbPassword = process.argv[2];
const outDir = process.argv[3];
if (!dbPassword || !outDir) {
  console.error('Usage: node scripts/backup-before-0010.mjs <db-password> <output-dir>');
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

const projectRef = new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0];
const connectionString = `postgresql://postgres:${encodeURIComponent(dbPassword)}@db.${projectRef}.supabase.co:5432/postgres`;

const TABLES = ['social_votes', 'dept_performance', 'complaints', 'escalations', 'wards'];

async function main() {
  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  for (const table of TABLES) {
    const res = await client.query(`SELECT * FROM ${table}`);
    const outPath = join(outDir, `${table}.json`);
    writeFileSync(outPath, JSON.stringify(res.rows, null, 2));
    console.log(`Backed up ${table}: ${res.rows.length} rows -> ${outPath}`);
  }
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
