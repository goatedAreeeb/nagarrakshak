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
  console.error('Usage: node scripts/verify-priority-engine.mjs <sb_secret_key>');
  process.exit(1);
}

const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { realtime: { transport: ws } });
await client.auth.signInWithPassword({ email: 'citizen1@demo.com', password: 'demo123' });

const GEO_ID = '3fecc65c-fd32-461f-832f-1494bab8b174';

console.log('Submitting a real demo submission...');
const { data: submission, error: subError } = await client.functions.invoke('ingest-submission', {
  body: {
    text: 'The government school roof near Charminar is leaking badly and two classrooms are unusable when it rains. Enrollment has dropped this year and parents are worried about the coming monsoon.',
    language: 'en',
    channel: 'app',
    lat: 17.3616,
    lng: 78.4747,
    address: 'Near Charminar, Hyderabad',
  },
});
if (subError) throw new Error(subError.message);
console.log('Submitted:', submission.submission_id);

console.log('Waiting for extract-features...');
await new Promise((r) => setTimeout(r, 4000));

async function callFn(name, body) {
  const res = await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

console.log('Invoking cluster-submissions...');
const clusterResult = await callFn('cluster-submissions', { geographic_unit_id: GEO_ID });
console.log('cluster-submissions:', JSON.stringify(clusterResult, null, 2));

const clusterId = clusterResult.clusters?.[0]?.cluster_id;
if (!clusterId) throw new Error('No cluster produced');

console.log('Invoking compute-priority (bootstrapping a proposal from the cluster)...');
const scoreResult1 = await callFn('compute-priority', {
  cluster_id: clusterId,
  title: 'Repair leaking roof — Government school near Charminar',
  category: 'school_infrastructure',
});
console.log('compute-priority (run 1):', JSON.stringify(scoreResult1, null, 2));

const proposalId = scoreResult1.proposal_id;

console.log('Re-running compute-priority on the SAME proposal (determinism check)...');
const scoreResult2 = await callFn('compute-priority', { proposal_id: proposalId });
console.log('total_score run1:', scoreResult1.total_score, 'run2:', scoreResult2.total_score,
  'DETERMINISTIC:', scoreResult1.total_score === scoreResult2.total_score);

console.log('Invoking generate-explanation...');
const explanation = await callFn('generate-explanation', { proposal_id: proposalId });
console.log('generate-explanation:', JSON.stringify(explanation, null, 2));
