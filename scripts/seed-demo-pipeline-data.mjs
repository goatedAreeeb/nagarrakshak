// Phase 12 demo prep (Report 2 Appendix C: "a set of synthetic-but-plausible
// citizen submissions across languages and channels for demo purposes").
//
// Step 1: clean up test/adversarial debris left in the live project from
// Phase 10/11 verification scripts (null-category submissions from
// prompt-injection/vague-input tests, and duplicate development_proposals
// from repeated E2E runs of the same probe text) — none of that is
// presentable demo content.
//
// Step 2: seed a realistic, multi-language, multi-category batch of citizen
// submissions for the single seeded demo constituency, run them through the
// live pipeline, and compute priority for each resulting cluster — producing
// an actual ranked shortlist with genuine variety, not three copies of the
// same school-roof complaint.
//
// This is synthetic demo data, not real citizen submissions — same honesty
// requirement as the rest of the project (the geographic_unit's own name
// already self-labels as "(DEMO — ...)").
//
// Usage: node scripts/seed-demo-pipeline-data.mjs <sb_secret_key>

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
  console.error('Usage: node scripts/seed-demo-pipeline-data.mjs <sb_secret_key>');
  process.exit(1);
}

const admin = createClient(env.VITE_SUPABASE_URL, SERVICE_KEY, { realtime: { transport: ws } });

async function callFn(name, body) {
  const res = await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
}

// --- Step 1: cleanup ---
async function cleanup() {
  console.log('--- Cleanup: removing test/adversarial debris ---');

  // Duplicate school-roof proposals from repeated E2E runs. Keep 4fc70080 — it
  // has a real human_overrides row from Phase 9 testing (migration 0014
  // already protected it once during dedupe; don't undo that here).
  const DUPLICATE_PROPOSAL_IDS = ['6af7d461-83fb-45b2-abb7-48ebe4d00dba', 'dfea47c5-ad19-44e4-9959-a7f39dff75f4'];
  const { error: propDelErr, count } = await admin.from('development_proposals').delete({ count: 'exact' }).in('id', DUPLICATE_PROPOSAL_IDS);
  console.log(propDelErr ? `  proposal cleanup failed: ${propDelErr.message}` : `  deleted ${count ?? 0} duplicate proposal(s)`);

  // Null-category submissions are adversarial/vague-input test probes (see
  // verify-prompt-injection.mjs) — not real signal, not presentable.
  const { data: junkRows } = await admin.from('citizen_submissions').select('id').is('category', null);
  if (junkRows?.length) {
    const { error: subDelErr } = await admin.from('citizen_submissions').delete().in('id', junkRows.map((r) => r.id));
    console.log(subDelErr ? `  submission cleanup failed: ${subDelErr.message}` : `  deleted ${junkRows.length} debris submission(s)`);
  }

  // Orphaned clusters left with zero members after the above.
  const { data: clusters } = await admin.from('theme_clusters').select('id, submission_cluster_membership(submission_id)');
  const orphanIds = (clusters ?? []).filter((c) => !c.submission_cluster_membership?.length).map((c) => c.id);
  if (orphanIds.length) {
    const { error: clusterDelErr } = await admin.from('theme_clusters').delete().in('id', orphanIds);
    console.log(clusterDelErr ? `  cluster cleanup failed: ${clusterDelErr.message}` : `  deleted ${orphanIds.length} orphaned cluster(s)`);
  }
}

// --- Step 2: seed realistic multilingual/multichannel submissions ---
const SUBMISSIONS = [
  {
    text: 'हमारे मोहल्ले में पीने के पानी की पाइपलाइन दो हफ्तों से खराब है। महिलाओं को दूर से पानी लाना पड़ रहा है।',
    language: 'hi', channel: 'app', address: 'Miyapur, Hyderabad', lat: 17.4969, lng: 78.3540,
  },
  {
    text: 'Yahan road bahut kharab hai, gaadiyan roz phasti hain aur do accident ho chuke hain is mahine. Please jaldi repair karwa dijiye.',
    language: 'hi-en', channel: 'app', address: 'Kukatpally, Hyderabad', lat: 17.4849, lng: 78.3995,
  },
  {
    text: 'మా ప్రాంతంలో ఆరోగ్య కేంద్రం లేదు, చిన్న చికిత్స కోసం కూడా చాలా దూరం వెళ్ళాలి. వృద్ధులకు చాలా ఇబ్బందిగా ఉంది.',
    language: 'te', channel: 'app', address: 'Uppal, Hyderabad', lat: 17.4010, lng: 78.5597,
  },
  {
    text: 'The storm drain near the main market has been blocked for a month. Every heavy rain floods three shops and the lane becomes impassable.',
    language: 'en', channel: 'app', address: 'Malakpet, Hyderabad', lat: 17.3770, lng: 78.5003,
  },
  {
    text: 'Frequent power cuts every evening for the past three weeks, sometimes 4-5 hours. The transformer near the community hall seems to be the issue.',
    language: 'en', channel: 'assisted', address: 'Ameerpet, Hyderabad', lat: 17.4374, lng: 78.4487,
  },
  {
    text: 'We need a vocational training centre for young people here — the nearest ITI is over an hour away and many drop out of the enrollment process because of the distance.',
    language: 'en', channel: 'app', address: 'Serilingampally, Hyderabad', lat: 17.4889, lng: 78.3277,
  },
  {
    text: 'Second request: the government primary school building has a cracked wall in the eastern block. It was flagged last year too. Enrollment keeps falling because parents are worried about safety.',
    language: 'en', channel: 'app', address: 'LB Nagar, Hyderabad', lat: 17.3469, lng: 78.5538,
  },
];

async function seedSubmissions() {
  console.log('\n--- Seeding realistic demo submissions ---');
  const citizens = ['citizen1@demo.com', 'citizen2@demo.com', 'citizen3@demo.com', 'citizen4@demo.com', 'citizen5@demo.com', 'citizen6@demo.com'];
  const submittedIds = [];

  for (let i = 0; i < SUBMISSIONS.length; i++) {
    const sub = SUBMISSIONS[i];
    const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { realtime: { transport: ws } });
    await client.auth.signInWithPassword({ email: citizens[i % citizens.length], password: 'demo123' });

    const { data, error } = await client.functions.invoke('ingest-submission', {
      body: { text: sub.text, language: sub.language, channel: sub.channel, lat: sub.lat, lng: sub.lng, address: sub.address },
    });
    if (error) {
      console.error(`  [FAIL] submission ${i + 1} (${sub.address}): ${error.message}`);
      continue;
    }
    console.log(`  [OK] submission ${i + 1} (${sub.address}, ${sub.language}, ${sub.channel}): ${data.submission_id}`);
    submittedIds.push(data.submission_id);
  }

  console.log('\nWaiting for async extract-features + resolve-geography...');
  const results = [];
  for (const id of submittedIds) {
    let row = null;
    for (let i = 0; i < 15; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const { data } = await admin.from('citizen_submissions').select('*').eq('id', id).single();
      if (data && (data.status === 'processed' || data.status === 'needs_review') && (data.geographic_unit_id || i > 8)) {
        row = data;
        break;
      }
    }
    console.log(`  ${id}: category=${row?.category} geo=${!!row?.geographic_unit_id} status=${row?.status}`);
    results.push(row);
  }
  return results.filter(Boolean);
}

async function buildProposals(processedSubmissions) {
  console.log('\n--- Clustering and computing priority per category ---');
  const geoId = processedSubmissions.find((r) => r.geographic_unit_id)?.geographic_unit_id;
  if (!geoId) {
    console.warn('No geo-resolved submissions — skipping cluster/priority step.');
    return;
  }

  const clusterResult = await callFn('cluster-submissions', { geographic_unit_id: geoId });
  console.log(`cluster-submissions: ${clusterResult.data?.clusters?.length ?? 0} cluster(s)`);

  const TITLES = {
    water_supply: 'Restore drinking water supply — Miyapur',
    road_repair: 'Repair accident-prone road — Kukatpally',
    health_facility: 'New primary health facility — Uppal',
    drainage: 'Clear blocked storm drain — Malakpet market',
    electricity: 'Fix recurring power outages — Ameerpet transformer',
    vocational_training: 'Vocational training centre — Serilingampally',
    school_infrastructure: 'Repair school wall — LB Nagar primary school',
  };

  for (const cluster of clusterResult.data?.clusters ?? []) {
    const memberCategory = processedSubmissions.find((s) => cluster.member_ids?.includes(s.id))?.category;
    const title = TITLES[memberCategory] ?? `Development proposal (${memberCategory ?? 'uncategorized'})`;
    const scoreResult = await callFn('compute-priority', { cluster_id: cluster.cluster_id, title, category: memberCategory });
    console.log(`  ${title}: proposal=${scoreResult.data?.proposal_id} score=${scoreResult.data?.total_score} rank=${scoreResult.data?.rank ?? 'n/a'}`);
  }
}

async function main() {
  await cleanup();
  const processed = await seedSubmissions();
  await buildProposals(processed);

  console.log('\n--- Final proposal shortlist ---');
  const { data: finalProposals } = await admin.from('development_proposals').select('id, title, category, priority_scores(total_score), recommendations(rank, routing)').order('id');
  for (const p of finalProposals ?? []) {
    console.log(`  ${p.title} [${p.category}] score=${p.priority_scores?.[0]?.total_score} rank=${p.recommendations?.[0]?.rank} routing=${p.recommendations?.[0]?.routing}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
