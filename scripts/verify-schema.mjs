import { readFileSync } from 'fs';
import pg from 'pg';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n').filter((l) => l && !l.startsWith('#')).map((l) => {
    const i = l.indexOf('=');
    return [l.slice(0, i), l.slice(i + 1)];
  })
);
const ref = new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0];
const pw = process.argv[2];
const client = new pg.Client({
  connectionString: `postgresql://postgres:${encodeURIComponent(pw)}@db.${ref}.supabase.co:5432/postgres`,
  ssl: { rejectUnauthorized: false },
});
await client.connect();
const res = await client.query(
  "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name"
);
console.log(res.rows.map((r) => r.table_name).join('\n'));
await client.end();
