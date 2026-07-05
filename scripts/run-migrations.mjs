/**
 * One-off migration runner — applies supabase/migrations/*.sql in filename order
 * via a direct Postgres connection. Used because linking the Supabase CLI needs
 * a separate personal access token we don't have; this only needs the DB password.
 * Run: node scripts/run-migrations.mjs
 */
import { readFileSync, readdirSync } from 'fs';
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
const dbPassword = process.argv[2];
if (!dbPassword) {
  console.error('Usage: node scripts/run-migrations.mjs <db-password>');
  process.exit(1);
}

const connectionString = `postgresql://postgres:${encodeURIComponent(dbPassword)}@db.${projectRef}.supabase.co:5432/postgres`;

const migrationsDir = resolve(__dirname, '../supabase/migrations');
const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

// seed.sql hardcodes user/complaint rows against fake UUIDs that only work if matching
// auth.users rows already exist with those exact ids (they won't, via real signup) — so
// we run the base schema, then only the FK-free wards data, then the new migrations.
// Real users are created afterward by scripts/seed-demo-users.mjs against real auth ids.
const WARDS_SEED = `
INSERT INTO wards (id, name, lat, lng, population, zone, open_issues, resolved_issues, health_score, dominant_category) VALUES
(1, 'Charminar', 17.3616, 78.4747, 310000, 'South', 42, 128, 32.0, 'Roads'),
(2, 'Secunderabad', 17.4399, 78.4983, 420000, 'North', 28, 156, 58.0, 'Sanitation'),
(3, 'Kukatpally', 17.4849, 78.3995, 580000, 'West', 18, 210, 74.0, 'Drainage'),
(4, 'LB Nagar', 17.3469, 78.5538, 390000, 'East', 12, 198, 82.0, 'Parks'),
(5, 'Uppal', 17.4010, 78.5597, 410000, 'East', 35, 142, 51.0, 'Traffic'),
(6, 'Serilingampally', 17.4889, 78.3277, 620000, 'West', 8, 245, 88.0, 'Street Lighting'),
(7, 'Malakpet', 17.3770, 78.5003, 280000, 'South', 48, 95, 38.0, 'Public Health'),
(8, 'Ameerpet', 17.4374, 78.4487, 350000, 'Central', 22, 167, 65.0, 'HMWSSB')
ON CONFLICT (id) DO NOTHING;
`;

async function applySql(client, label, sql) {
  console.log(`Applying ${label}...`);
  try {
    await client.query(sql);
    console.log(`  OK ${label}`);
  } catch (err) {
    console.error(`  FAILED ${label}: ${err.message}`);
    await client.end();
    process.exit(1);
  }
}

async function main() {
  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Connected.');

  const schemaPath = resolve(__dirname, '../supabase/schema.sql');
  await applySql(client, 'schema.sql (base app schema)', readFileSync(schemaPath, 'utf8'));
  await applySql(client, 'wards seed data', WARDS_SEED);

  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    await applySql(client, file, sql);
  }

  await client.end();
  console.log('All migrations applied.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
