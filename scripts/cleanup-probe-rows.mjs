import { readFileSync } from 'fs';
import pg from 'pg';
const env = Object.fromEntries(readFileSync('.env','utf8').split('\n').filter(l=>l&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1)];}));
const ref = new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0];
const client = new pg.Client({connectionString:`postgresql://postgres:${encodeURIComponent(process.argv[2])}@db.${ref}.supabase.co:5432/postgres`, ssl:{rejectUnauthorized:false}});
await client.connect();
const res = await client.query("DELETE FROM citizen_submissions WHERE raw_text LIKE '%Malakpet, water leaks during rain%' RETURNING id");
console.log('Deleted probe rows:', res.rowCount);
await client.end();
