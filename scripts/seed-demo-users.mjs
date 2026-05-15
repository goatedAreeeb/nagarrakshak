/**
 * Creates demo auth users + public.users profiles via Supabase Admin API.
 * Run: node scripts/seed-demo-users.mjs
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

const DEMO_USERS = [
  { email: 'citizen1@demo.com', password: 'Demo@1234', name: 'Rajesh Kumar', role: 'citizen', ward_id: 1 },
  { email: 'citizen2@demo.com', password: 'Demo@1234', name: 'Priya Sharma', role: 'citizen', ward_id: 3 },
  { email: 'worker1@demo.com', password: 'Demo@1234', name: 'Suresh Reddy', role: 'worker', dept: 'Roads' },
  { email: 'worker2@demo.com', password: 'Demo@1234', name: 'Lakshmi Devi', role: 'worker', dept: 'Sanitation' },
  { email: 'officer1@demo.com', password: 'Demo@1234', name: 'Venkat Rao', role: 'officer', dept: 'Roads' },
  { email: 'officer2@demo.com', password: 'Demo@1234', name: 'Anitha Prasad', role: 'officer', dept: 'HMWSSB' },
  { email: 'supervisor1@demo.com', password: 'Demo@1234', name: 'Ramesh Iyer', role: 'supervisor', zone: 'South' },
  { email: 'zonal1@demo.com', password: 'Demo@1234', name: 'Kavitha Naidu', role: 'zonal', zone: 'South' },
  { email: 'city1@demo.com', password: 'Demo@1234', name: 'GHMC Admin', role: 'city' },
  { email: 'admin@nagarsevak.in', password: 'Admin@1234', name: 'System Admin', role: 'city' },
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
  const body = {
    id: user.id,
    email: user.email,
    name: meta.name,
    role: meta.role,
    ward_id: meta.ward_id ?? null,
    dept: meta.dept ?? null,
    zone: meta.zone ?? null,
    credits: meta.role === 'citizen' ? (meta.email === 'citizen1@demo.com' ? 120 : 80) : 0,
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

async function main() {
  const { data: list } = await adminFetch('/users?page=1&per_page=100');
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
          user_metadata: { name: demo.name, role: demo.role, ward_id: demo.ward_id },
        }),
      });
      if (created.status === 422) {
        const { data: retry } = await adminFetch(`/users?email=${encodeURIComponent(demo.email)}`);
        authUser = retry?.users?.[0];
      } else {
        authUser = created.data;
      }
    }
    if (authUser?.id) {
      await upsertProfile(authUser, demo);
      console.log('OK', demo.email, demo.role);
    } else {
      console.warn('SKIP', demo.email);
    }
  }
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
