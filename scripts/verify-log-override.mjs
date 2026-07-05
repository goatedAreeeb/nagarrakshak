import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n').filter((l) => l && !l.startsWith('#')).map((l) => {
    const i = l.indexOf('=');
    return [l.slice(0, i), l.slice(i + 1)];
  })
);

async function tryOverride(email, label) {
  const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { realtime: { transport: ws } });
  const { error: authError } = await client.auth.signInWithPassword({ email, password: 'demo123' });
  if (authError) throw authError;

  const { data: recRows } = await client.from('recommendations').select('id').limit(1);
  const recommendationId = recRows?.[0]?.id;

  const { data, error } = await client.functions.invoke('log-override', {
    body: {
      recommendation_id: recommendationId ?? '00000000-0000-0000-0000-000000000000',
      override_reason: `RLS/role probe as ${label}`,
    },
  });
  console.log(`${label} (${email}): ${error ? `REJECTED — ${error.message}` : `ALLOWED — ${JSON.stringify(data)}`}`);
}

await tryOverride('citizen1@demo.com', 'citizen');
await tryOverride('analyst1@demo.com', 'analyst');
await tryOverride('mpstaff1@demo.com', 'mp_staff');
