// Phase 11 — Integration Testing (REPORT_2 Part XVI Phase 11 / CP-11).
//
// Full end-to-end regression before migration 0010 (the only destructive
// migration in the whole plan) is allowed to run:
//   submit -> extract features -> resolve geography -> cluster -> fuse
//   evidence -> compute priority -> generate explanation -> staff review
//   (RLS-scoped read) -> override -> audit event.
//
// NOTE on "transcribe": REPORT_2's Phase 11 task list names a transcribe step,
// but Phase 3+4 explicitly deferred ASR (documented in BASELINE.md — no
// transcribe-voice function exists; MVP scope was language-ID only). This is a
// pre-existing, already-documented gap, not a regression introduced here, so
// this script exercises the text-channel path and does not fabricate a
// transcription step that doesn't exist in the codebase.
//
// Usage: node scripts/verify-e2e-phase11.mjs <sb_secret_key>

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
  console.error('Usage: node scripts/verify-e2e-phase11.mjs <sb_secret_key>');
  process.exit(1);
}

const admin = createClient(env.VITE_SUPABASE_URL, SERVICE_KEY, { realtime: { transport: ws } });

let failures = 0;
function step(label, ok, extra = '') {
  console.log(`${ok ? '[PASS]' : '[FAIL]'} ${label}${extra ? ' — ' + extra : ''}`);
  if (!ok) failures++;
  return ok;
}

async function callFn(name, body, authHeader) {
  const res = await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
}

async function main() {
  const citizen = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { realtime: { transport: ws } });
  const { error: citizenAuthErr } = await citizen.auth.signInWithPassword({ email: 'citizen1@demo.com', password: 'demo123' });
  step('citizen login', !citizenAuthErr, citizenAuthErr?.message);

  const mpStaff = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { realtime: { transport: ws } });
  const { error: mpStaffAuthErr } = await mpStaff.auth.signInWithPassword({ email: 'mpstaff1@demo.com', password: 'demo123' });
  step('mp_staff login', !mpStaffAuthErr, mpStaffAuthErr?.message);
  const mpStaffSession = (await mpStaff.auth.getSession()).data.session;

  // 1. submit
  const { data: sub, error: subErr } = await citizen.functions.invoke('ingest-submission', {
    body: {
      text: 'The government school roof near Charminar is leaking badly and two classrooms are unusable when it rains. Enrollment has dropped this year and parents worry about the monsoon.',
      language: 'en',
      channel: 'app',
      lat: 17.3616,
      lng: 78.4747,
      address: 'Near Charminar, Hyderabad',
    },
  });
  if (!step('submit (ingest-submission)', !subErr && !!sub?.submission_id, subErr?.message)) throw new Error('abort');
  const submissionId = sub.submission_id;

  // 2. extract features (async — poll). Keep polling past the status flip until
  // geographic_unit_id lands too — extract-features flips status to
  // processed/needs_review BEFORE firing its own async (waitUntil) hand-off to
  // resolve-geography, so stopping at the status flip races that hand-off
  // (this exact bug was already documented once in BASELINE.md).
  let row = null;
  let featuresRow = null;
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const { data } = await admin.from('citizen_submissions').select('*').eq('id', submissionId).single();
    if (data && (data.status === 'processed' || data.status === 'needs_review')) {
      featuresRow = data;
      if (data.geographic_unit_id) { row = data; break; }
    }
  }
  row = row ?? featuresRow;
  step('extract features', !!featuresRow, featuresRow ? `category=${featuresRow.category} status=${featuresRow.status}` : 'timed out waiting for extract-features');

  // 3. resolve geography (chained from extract-features)
  step('resolve geography', !!row?.geographic_unit_id, row ? `geographic_unit_id=${row.geographic_unit_id}` : '');
  if (!row?.geographic_unit_id) throw new Error('abort — no geography, cannot cluster');
  const geoId = row.geographic_unit_id;

  // 4. cluster
  const clusterResult = await callFn('cluster-submissions', { geographic_unit_id: geoId }, `Bearer ${SERVICE_KEY}`);
  const clusterId = clusterResult.data?.clusters?.[0]?.cluster_id;
  if (!step('cluster submissions', clusterResult.status === 200 && !!clusterId, JSON.stringify(clusterResult.data).slice(0, 200))) throw new Error('abort');

  // 5. fuse evidence (pre-proposal lookup, regression check that this still works post-Phase-10 changes)
  const fuseResult = await callFn('fuse-evidence', { geographic_unit_id: geoId, category: row.category ?? undefined }, `Bearer ${SERVICE_KEY}`);
  step('fuse evidence (lookup)', fuseResult.status === 200, `evidence_records=${fuseResult.data?.evidence_records?.length ?? 'n/a'}`);

  // 6. compute priority (creates development_proposal + priority_score + recommendation)
  const scoreResult = await callFn('compute-priority', {
    cluster_id: clusterId,
    title: 'Repair leaking roof — Government school near Charminar',
    category: row.category ?? 'school_infrastructure',
  }, `Bearer ${SERVICE_KEY}`);
  const proposalId = scoreResult.data?.proposal_id;
  if (!step('compute priority', scoreResult.status === 200 && !!proposalId && typeof scoreResult.data.total_score === 'number',
    JSON.stringify(scoreResult.data).slice(0, 200))) throw new Error('abort');

  // determinism check — re-running on the same proposal must return the same score
  const scoreResult2 = await callFn('compute-priority', { proposal_id: proposalId }, `Bearer ${SERVICE_KEY}`);
  step('compute priority is deterministic', scoreResult.data.total_score === scoreResult2.data.total_score,
    `run1=${scoreResult.data.total_score} run2=${scoreResult2.data.total_score}`);

  // 7. fuse evidence again, now linking to the real proposal
  const fuseLinkResult = await callFn('fuse-evidence', { geographic_unit_id: geoId, category: row.category ?? undefined, proposal_id: proposalId }, `Bearer ${SERVICE_KEY}`);
  step('fuse evidence (link to proposal)', fuseLinkResult.status === 200);

  // 8. generate explanation
  const explanationResult = await callFn('generate-explanation', { proposal_id: proposalId }, `Bearer ${SERVICE_KEY}`);
  step('generate explanation', explanationResult.status === 200 && !!explanationResult.data?.explanation_text,
    `validated=${explanationResult.data?.validated}`);

  // 9. staff review — mp_staff reads the recommendation under their own RLS session (not service-role)
  const { data: recRow, error: recReadErr } = await mpStaff
    .from('recommendations')
    .select('id, proposal_id, rank')
    .eq('proposal_id', proposalId)
    .single();
  if (!step('staff review (RLS-scoped read)', !recReadErr && !!recRow, recReadErr?.message)) throw new Error('abort');

  // 10. override
  const overrideResult = await callFn('log-override', {
    recommendation_id: recRow.id,
    new_rank: (recRow.rank ?? 1) + 1,
    override_reason: 'Phase 11 E2E regression probe — verifying override + audit chain post Phase 10 hardening',
  }, `Bearer ${mpStaffSession.access_token}`);
  if (!step('override (log-override)', overrideResult.status === 200 && !!overrideResult.data?.override_id,
    JSON.stringify(overrideResult.data))) throw new Error('abort');

  // 11. audit event
  const { data: auditRow, error: auditReadErr } = await admin
    .from('audit_events')
    .select('id, event_type, actor_id, recommendation_id, override_id')
    .eq('override_id', overrideResult.data.override_id)
    .single();
  step('audit event recorded', !auditReadErr && auditRow?.event_type === 'override', auditReadErr?.message);

  console.log(`\n${failures === 0 ? 'CP-11 E2E FLOW GREEN' : `${failures} FAILURE(S) — CP-11 NOT PASSED`}`);
  console.log(`Probe submission: ${submissionId}, proposal: ${proposalId} (left in place — real data, not deleted, per project convention of not deleting demo pipeline artifacts).`);
  if (failures > 0) process.exit(1);
}

main().catch((e) => {
  console.error('E2E flow aborted:', e.message);
  process.exit(1);
});
