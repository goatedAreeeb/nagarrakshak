// Post-migration-0010 security re-check (Phase 11 "re-run Phase 10's security
// test suite once more after any schema change"). complaints/escalations/wards
// should now be fully read-only for every role — no INSERT/UPDATE/DELETE
// policy should let anyone through, not just the previously-scoped ones.
//
// Usage: node scripts/verify-frozen-tables.mjs <sb_secret_key>

import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n').filter((l) => l && !l.startsWith('#')).map((l) => {
    const i = l.indexOf('=');
    return [l.slice(0, i), l.slice(i + 1)];
  })
);

const SERVICE_KEY = process.argv[2];
const admin = createClient(env.VITE_SUPABASE_URL, SERVICE_KEY, { realtime: { transport: ws } });

async function signInAs(email) {
  const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { realtime: { transport: ws } });
  await client.auth.signInWithPassword({ email, password: 'demo123' });
  return client;
}

let failures = 0;
function expect(label, ok) {
  console.log(`${ok ? '[PASS]' : '[FAIL]'} ${label}`);
  if (!ok) failures++;
}

async function main() {
  const officer1 = await signInAs('officer1@demo.com');
  const supervisor1 = await signInAs('supervisor1@demo.com');
  const city1 = await signInAs('city1@demo.com');

  const { data: probeComplaint } = await admin.from('complaints').insert({
    citizen_id: null, lat: 17.36, lng: 78.47, dept: 'Roads', description: 'frozen-table probe',
  }).select('id').single();

  try {
    for (const [label, client] of [['officer1', officer1], ['supervisor1', supervisor1]]) {
      const { data, error } = await client.from('complaints').update({ status: 'in_progress' }).eq('id', probeComplaint.id).select();
      expect(`complaints UPDATE as ${label} -> REJECTED (frozen)`, !error && (!data || data.length === 0));
    }

    const { data: citizenClient } = { data: await signInAs('citizen1@demo.com') };
    const { error: insertErr, data: insertData } = await citizenClient.from('complaints').insert({
      citizen_id: (await citizenClient.auth.getUser()).data.user.id, lat: 17.36, lng: 78.47, dept: 'Roads', description: 'should be rejected',
    }).select();
    expect('complaints INSERT as citizen -> REJECTED (frozen)', !!insertErr || !insertData || insertData.length === 0);

    const { data: escData, error: escErr } = await officer1.from('escalations')
      .insert({ complaint_id: probeComplaint.id, from_role: 'officer', to_role: 'supervisor', reason: 'probe' }).select();
    expect('escalations INSERT as officer -> REJECTED (frozen)', !!escErr && escErr.code === '42501');

    const { data: wardData, error: wardErr } = await city1.from('wards').update({ health_score: 0 }).eq('id', 1).select();
    expect('wards UPDATE as city -> REJECTED (frozen)', !wardErr && (!wardData || wardData.length === 0));

    const { data: readCheck, error: readErr } = await officer1.from('complaints').select('id').eq('id', probeComplaint.id).single();
    expect('complaints SELECT still works (not over-frozen)', !readErr && !!readCheck);
  } finally {
    await admin.from('complaints').delete().eq('id', probeComplaint.id);
  }

  console.log(`\n${failures === 0 ? 'ALL PASSED' : `${failures} FAILURE(S)`}`);
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
