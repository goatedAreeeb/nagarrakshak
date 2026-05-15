/**
 * Creates demo auth users + public.users profiles via Supabase Admin API.
 * Run: node scripts/seed-demo-users.mjs
 *
 * Requires VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_KEY in .env
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../.env');
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i), l.slice(i + 1)];
    })
);

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SERVICE_KEY = env.VITE_SUPABASE_SERVICE_KEY;

/** All demo civic accounts use this password (citizen → city head). */
const DEMO_PASSWORD = 'demo123';

/** Citizens only — higher credits = city leaderboard rank. Top 3: Harshit, Anirudh, Parth */
const CITIZEN_CREDITS = {
  'citizen1@demo.com': 360,
  'citizen2@demo.com': 195,
  'citizen3@demo.com': 340,
  'citizen4@demo.com': 310,
  'citizen5@demo.com': 275,
  'citizen6@demo.com': 250,
};

const DEMO_USERS = [
  { email: 'citizen1@demo.com', password: DEMO_PASSWORD, name: 'Harshit Divekar', role: 'citizen', ward_id: 1 },
  { email: 'citizen2@demo.com', password: DEMO_PASSWORD, name: 'Priya Sharma', role: 'citizen', ward_id: 3 },
  { email: 'citizen3@demo.com', password: DEMO_PASSWORD, name: 'Anirudh Pratap Singh', role: 'citizen', ward_id: 2 },
  { email: 'citizen4@demo.com', password: DEMO_PASSWORD, name: 'Parth Yadav', role: 'citizen', ward_id: 4 },
  { email: 'citizen5@demo.com', password: DEMO_PASSWORD, name: 'Kavya Reddy', role: 'citizen', ward_id: 5 },
  { email: 'citizen6@demo.com', password: DEMO_PASSWORD, name: 'Rohan Verma', role: 'citizen', ward_id: 6 },
  { email: 'worker1@demo.com', password: DEMO_PASSWORD, name: 'Suresh Reddy', role: 'worker', dept: 'Roads' },
  { email: 'worker2@demo.com', password: DEMO_PASSWORD, name: 'Lakshmi Devi', role: 'worker', dept: 'Sanitation' },
  { email: 'officer1@demo.com', password: DEMO_PASSWORD, name: 'Venkat Rao', role: 'officer', dept: 'Roads' },
  { email: 'officer2@demo.com', password: DEMO_PASSWORD, name: 'Anitha Prasad', role: 'officer', dept: 'HMWSSB' },
  { email: 'supervisor1@demo.com', password: DEMO_PASSWORD, name: 'Ramesh Iyer', role: 'supervisor', zone: 'South' },
  { email: 'zonal1@demo.com', password: DEMO_PASSWORD, name: 'Kavitha Naidu', role: 'zonal', zone: 'South' },
  { email: 'city1@demo.com', password: DEMO_PASSWORD, name: 'GHMC Admin', role: 'city' },
  { email: 'admin@nagarsevak.in', password: DEMO_PASSWORD, name: 'System Admin', role: 'city' },
];

async function adminFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SERVICE_KEY,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  if (!res.ok && res.status !== 422) {
    throw new Error(`${path} ${res.status}: ${JSON.stringify(data)}`);
  }
  return { ok: res.ok, status: res.status, data };
}

async function upsertProfile(user, meta) {
  const credits =
    meta.role === 'citizen' ? (CITIZEN_CREDITS[meta.email] ?? 50) : 0;
  const body = {
    id: user.id,
    email: user.email,
    name: meta.name,
    role: meta.role,
    ward_id: meta.ward_id ?? null,
    dept: meta.dept ?? null,
    zone: meta.zone ?? null,
    credits,
  };
  const res = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SERVICE_KEY,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`users upsert ${user.email}: ${err}`);
  }
}

async function ensurePassword(userId, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SERVICE_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ password, email_confirm: true }),
  });
  if (!res.ok) {
    const t = await res.text();
    console.warn('Password sync:', userId, res.status, t);
  }
}

async function main() {
  const { data: list } = await adminFetch('/users?page=1&per_page=200');
  const existing = new Map((list?.users || []).map((u) => [u.email, u]));

  for (const demo of DEMO_USERS) {
    let authUser = existing.get(demo.email);
    if (!authUser) {
      const created = await adminFetch('/users', {
        method: 'POST',
        body: JSON.stringify({
          email: demo.email,
          password: demo.password,
          email_confirm: true,
          user_metadata: {
            name: demo.name,
            role: demo.role,
            ward_id: demo.ward_id,
          },
        }),
      });
      if (created.status === 422) {
        const { data: retry } = await adminFetch(`/users?email=${encodeURIComponent(demo.email)}`);
        authUser = retry?.users?.[0];
      } else {
        authUser = created.data;
      }
    } else {
      await ensurePassword(authUser.id, demo.password);
    }
    if (authUser?.id) {
      await upsertProfile(authUser, demo);
      console.log('OK', demo.email, demo.role);
    } else {
      console.warn('SKIP', demo.email);
    }
  }
  console.log('Done. Demo password for all seeded accounts:', DEMO_PASSWORD);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
