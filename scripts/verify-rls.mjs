import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n').filter((l) => l && !l.startsWith('#')).map((l) => {
    const i = l.indexOf('=');
    return [l.slice(0, i), l.slice(i + 1)];
  })
);

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const ANON_KEY = env.VITE_SUPABASE_ANON_KEY;

async function signInAs(email, password = 'demo123') {
  const client = createClient(SUPABASE_URL, ANON_KEY, { realtime: { transport: ws } });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`);
  return client;
}

async function tryInsertOverride(client, label) {
  const { error } = await client.from('human_overrides').insert({
    recommendation_id: '00000000-0000-0000-0000-000000000000',
    override_reason: 'RLS probe — should be rejected for this role',
  });
  console.log(`${label}: ${error ? `REJECTED (${error.code} ${error.message})` : 'ALLOWED (unexpected!)'}`);
}

async function main() {
  const citizen = await signInAs('citizen1@demo.com');
  await tryInsertOverride(citizen, 'citizen -> human_overrides INSERT');

  const analyst = await signInAs('analyst1@demo.com');
  await tryInsertOverride(analyst, 'analyst -> human_overrides INSERT');

  const mpStaff = await signInAs('mpstaff1@demo.com');
  await tryInsertOverride(mpStaff, 'mp_staff -> human_overrides INSERT');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
