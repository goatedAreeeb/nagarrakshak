import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n').filter((l) => l && !l.startsWith('#')).map((l) => {
    const i = l.indexOf('=');
    return [l.slice(0, i), l.slice(i + 1)];
  })
);

const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { realtime: { transport: ws } });
const { error: authError } = await client.auth.signInWithPassword({ email: 'citizen1@demo.com', password: 'demo123' });
if (authError) throw authError;

console.log('Invoking ingest-submission...');
const { data, error } = await client.functions.invoke('ingest-submission', {
  body: {
    text: 'The government school roof near Charminar is leaking badly and two classrooms are unusable when it rains. Enrollment has dropped this year.',
    language: 'en',
    channel: 'app',
    lat: 17.3616,
    lng: 78.4747,
    address: 'Near Charminar, Hyderabad',
  },
});

if (error) {
  console.error('ingest-submission FAILED:', error.message, error.context ? await error.context.text?.() : '');
  process.exit(1);
}
console.log('ingest-submission OK:', data);

const submissionId = data.submission_id;
console.log('Waiting for async extract-features to complete...');

let features = null;
for (let i = 0; i < 8; i += 1) {
  await new Promise((r) => setTimeout(r, 2000));
  const { data: row, error: pollError } = await client
    .from('citizen_submissions')
    .select('category, entities, location_mentions, sentiment, confidence, status, geographic_unit_id')
    .eq('id', submissionId)
    .single();
  if (pollError) {
    console.error('poll error:', pollError.message);
    continue;
  }
  console.log(`  poll ${i + 1}: status=${row.status}`);
  if (row.status === 'processed' || row.status === 'needs_review') {
    features = row;
    break;
  }
}

console.log('Final row:', features);
