// Phase 11 regression check (REPORT_2 Part XIV §45): Realtime notification
// delivery must still work unchanged after Phase 10/11's schema/RLS edits.
// Subscribes as citizen1 the same way NotificationContext.jsx does, then
// inserts a notification row via service role and confirms the INSERT event
// is actually delivered over the channel, not just that the insert succeeded.
//
// Usage: node scripts/verify-realtime-notifications.mjs <sb_secret_key>

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
  console.error('Usage: node scripts/verify-realtime-notifications.mjs <sb_secret_key>');
  process.exit(1);
}

const citizen = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { realtime: { transport: ws } });
const { error: authErr } = await citizen.auth.signInWithPassword({ email: 'citizen1@demo.com', password: 'demo123' });
if (authErr) throw authErr;
const { data: { user } } = await citizen.auth.getUser();

const admin = createClient(env.VITE_SUPABASE_URL, SERVICE_KEY, { realtime: { transport: ws } });

let received = null;
const subscribed = new Promise((resolve) => {
  const channel = citizen
    .channel(`notifications-${user.id}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
      (payload) => { received = payload.new; })
    .subscribe((status, err) => {
      console.log('channel status:', status, err ? err.message : '');
      if (status === 'SUBSCRIBED') resolve(channel);
    });
  setTimeout(() => resolve(channel), 8000); // don't hang forever if it never subscribes
});
const channel = await subscribed;

const probeMessage = `Phase 11 realtime probe ${Date.now()}`;
const { data: inserted, error: insertErr } = await admin.from('notifications').insert({
  user_id: user.id,
  type: 'city_notice',
  title: 'Phase 11 realtime probe',
  message: probeMessage,
}).select('id').single();
if (insertErr) throw new Error(`insert failed: ${insertErr.message}`);
console.log('inserted probe row:', inserted.id);

for (let i = 0; i < 20 && !received; i++) await new Promise((r) => setTimeout(r, 500));

const ok = received && received.message === probeMessage;
console.log(ok ? `[PASS] realtime notification delivered: ${JSON.stringify(received)}` : '[FAIL] no realtime event received within 10s');

await admin.from('notifications').delete().eq('id', inserted.id);
citizen.removeChannel(channel);
process.exit(ok ? 0 : 1);
