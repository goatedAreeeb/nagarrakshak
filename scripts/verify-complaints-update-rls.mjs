// RLS policy test matrix for the `complaints` UPDATE policies fixed in
// migration 0013 (Phase 10 / CP-10).
//
// SUPERSEDED by migration 0010 (Phase 11): complaints is now frozen entirely
// (all write policies dropped, read-only for every role), so the "ALLOWED"
// assertions below (worker-once-assigned, supervisor oversight) now correctly
// fail — that's expected, not a regression. See scripts/verify-frozen-tables.mjs
// for the current, correct expectations. Kept as a historical record of the
// Phase 10 scoped-write state.
//
// Usage: node scripts/verify-complaints-update-rls.mjs <sb_secret_key>

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
if (!SERVICE_KEY) {
  console.error('Usage: node scripts/verify-complaints-update-rls.mjs <sb_secret_key>');
  process.exit(1);
}

const admin = createClient(env.VITE_SUPABASE_URL, SERVICE_KEY, { realtime: { transport: ws } });

async function signInAs(email) {
  const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { realtime: { transport: ws } });
  const { error } = await client.auth.signInWithPassword({ email, password: 'demo123' });
  if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`);
  const { data: { user } } = await client.auth.getUser();
  return { client, id: user.id };
}

let failures = 0;
function expect(label, ok) {
  console.log(`${ok ? '[PASS]' : '[FAIL]'} ${label}`);
  if (!ok) failures++;
}

async function tryUpdate(client, complaintId, patch) {
  const { data, error } = await client.from('complaints').update(patch).eq('id', complaintId).select();
  // RLS-rejected updates return no error and no rows (not a Postgres error) — that's
  // how "USING" clauses behave for UPDATE: the row just isn't matched for this session.
  const allowed = !error && Array.isArray(data) && data.length > 0;
  return { allowed, error };
}

async function main() {
  const citizen1 = await signInAs('citizen1@demo.com');
  const citizen2 = await signInAs('citizen2@demo.com');
  const worker1 = await signInAs('worker1@demo.com'); // dept: Roads
  const officer1 = await signInAs('officer1@demo.com'); // dept: Roads
  const officer2 = await signInAs('officer2@demo.com'); // dept: HMWSSB
  const supervisor1 = await signInAs('supervisor1@demo.com');

  const { data: probe, error: insertErr } = await admin
    .from('complaints')
    .insert({
      citizen_id: citizen1.id,
      lat: 17.3616,
      lng: 78.4747,
      dept: 'Roads',
      description: 'RLS probe complaint — Phase 10 verification',
      severity: 3,
    })
    .select('id')
    .single();
  if (insertErr) throw new Error(`probe insert failed: ${insertErr.message}`);
  const complaintId = probe.id;
  console.log('Probe complaint:', complaintId);

  try {
    expect(
      'citizen2 (not owner) update -> REJECTED',
      !(await tryUpdate(citizen2.client, complaintId, { description: 'hijacked by citizen2' })).allowed
    );

    expect(
      'citizen1 (owner) update -> ALLOWED',
      (await tryUpdate(citizen1.client, complaintId, { description: 'RLS probe — updated by owner' })).allowed
    );

    expect(
      'worker1 (dept match, NOT yet assigned) update -> REJECTED',
      !(await tryUpdate(worker1.client, complaintId, { status: 'in_progress' })).allowed
    );

    expect(
      'officer2 (different dept: HMWSSB) update -> REJECTED',
      !(await tryUpdate(officer2.client, complaintId, { assigned_to: worker1.id })).allowed
    );

    expect(
      'officer1 (same dept: Roads) assigns worker1 -> ALLOWED',
      (await tryUpdate(officer1.client, complaintId, { assigned_to: worker1.id })).allowed
    );

    expect(
      'worker1 (now assigned) update -> ALLOWED',
      (await tryUpdate(worker1.client, complaintId, { status: 'in_progress' })).allowed
    );

    expect(
      'supervisor1 (oversight role) update -> ALLOWED',
      (await tryUpdate(supervisor1.client, complaintId, { status: 'resolved' })).allowed
    );
  } finally {
    const { error: delErr } = await admin.from('complaints').delete().eq('id', complaintId);
    console.log(delErr ? `Cleanup failed: ${delErr.message}` : 'Probe complaint cleaned up.');
  }

  console.log(`\n${failures === 0 ? 'ALL PASSED' : `${failures} FAILURE(S)`}`);
  if (failures > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
