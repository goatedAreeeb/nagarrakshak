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

const { data: userData } = await client.auth.getUser();

const { data, error } = await client
  .from('citizen_submissions')
  .insert({
    submitter_id: userData.user.id,
    channel: 'app',
    raw_text: 'Broken school roof near Malakpet, water leaks during rain.',
    language: 'en',
    status: 'received',
  })
  .select('id, submitter_id, status')
  .single();

if (error) {
  console.error('INSERT FAILED:', error.message);
  process.exit(1);
}
console.log('INSERT OK:', data);

const { error: readOtherError, data: readOther } = await createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { realtime: { transport: ws } })
  .from('citizen_submissions')
  .select('id')
  .eq('id', data.id);
console.log('Anon (no session) read of the row:', readOther?.length ? 'VISIBLE (unexpected!)' : 'not visible (expected — no session)', readOtherError?.message || '');
