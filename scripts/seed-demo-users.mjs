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
// Server-side only, never VITE_-prefixed — a VITE_ prefix would make Vite bundle this
// into the client (the exact S-001 vulnerability BASELINE.md flags for Phase 10).
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

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

/**
 * role_v2 backfill mirrors migration 0002_new_role_enum.sql's CASE mapping —
 * kept in sync manually since this script runs against Supabase's REST API,
 * not psql. citizen->citizen, worker/officer->mp_staff, supervisor/zonal->analyst,
 * city->mp. New role_v2-only demo accounts below have no old-role equivalent.
 */
const DEMO_USERS = [
  { email: 'citizen1@demo.com', password: DEMO_PASSWORD, name: 'Harshit Divekar', role: 'citizen', role_v2: 'citizen', ward_id: 1 },
  { email: 'citizen2@demo.com', password: DEMO_PASSWORD, name: 'Priya Sharma', role: 'citizen', role_v2: 'citizen', ward_id: 3 },
  { email: 'citizen3@demo.com', password: DEMO_PASSWORD, name: 'Anirudh Pratap Singh', role: 'citizen', role_v2: 'citizen', ward_id: 2 },
  { email: 'citizen4@demo.com', password: DEMO_PASSWORD, name: 'Parth Yadav', role: 'citizen', role_v2: 'citizen', ward_id: 4 },
  { email: 'citizen5@demo.com', password: DEMO_PASSWORD, name: 'Kavya Reddy', role: 'citizen', role_v2: 'citizen', ward_id: 5 },
  { email: 'citizen6@demo.com', password: DEMO_PASSWORD, name: 'Rohan Verma', role: 'citizen', role_v2: 'citizen', ward_id: 6 },
  { email: 'worker1@demo.com', password: DEMO_PASSWORD, name: 'Suresh Reddy', role: 'worker', role_v2: 'mp_staff', dept: 'Roads' },
  { email: 'worker2@demo.com', password: DEMO_PASSWORD, name: 'Lakshmi Devi', role: 'worker', role_v2: 'mp_staff', dept: 'Sanitation' },
  { email: 'officer1@demo.com', password: DEMO_PASSWORD, name: 'Venkat Rao', role: 'officer', role_v2: 'mp_staff', dept: 'Roads' },
  { email: 'officer2@demo.com', password: DEMO_PASSWORD, name: 'Anitha Prasad', role: 'officer', role_v2: 'mp_staff', dept: 'HMWSSB' },
  { email: 'supervisor1@demo.com', password: DEMO_PASSWORD, name: 'Ramesh Iyer', role: 'supervisor', role_v2: 'analyst', zone: 'South' },
  { email: 'zonal1@demo.com', password: DEMO_PASSWORD, name: 'Kavitha Naidu', role: 'zonal', role_v2: 'analyst', zone: 'South' },
  { email: 'city1@demo.com', password: DEMO_PASSWORD, name: 'GHMC Admin', role: 'city', role_v2: 'mp' },
  { email: 'admin@nagarsevak.in', password: DEMO_PASSWORD, name: 'System Admin', role: 'city', role_v2: 'administrator' },
  // People's Priorities MP-office personas (no old-role equivalent):
  { email: 'mpstaff1@demo.com', password: DEMO_PASSWORD, name: 'Divya Krishnan', role: 'citizen', role_v2: 'mp_staff' },
  { email: 'mp1@demo.com', password: DEMO_PASSWORD, name: 'MP Office (Demo)', role: 'city', role_v2: 'mp' },
  { email: 'districtauth1@demo.com', password: DEMO_PASSWORD, name: 'District Authority Liaison', role: 'citizen', role_v2: 'district_authority_liaison' },
  { email: 'analyst1@demo.com', password: DEMO_PASSWORD, name: 'GIS/Data Analyst', role: 'citizen', role_v2: 'analyst' },
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
    role_v2: meta.role_v2 ?? null,
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

/**
 * Demo constituency for geographic_units. Constituency name, district, and
 * state are real and verifiable (Hyderabad Lok Sabha PC, Telangana — see
 * https://hyderabad.telangana.gov.in/constituencies/ and
 * https://www.wikidata.org/wiki/Q3764307). The lgd_code/pc_code/ac_code values
 * are PLACEHOLDERS: this pass could not browse the live lgdirectory.gov.in
 * dataset to pull the actual numeric codes (see BASELINE.md / Phase 2 notes).
 * Do not present these codes as real in a demo — verify at lgdirectory.gov.in
 * before using them in anything beyond a labeled placeholder.
 */
const GEOGRAPHIC_UNITS_SEED = [
  {
    name: 'Hyderabad Parliamentary Constituency (DEMO — LGD code unverified)',
    level: 'parliamentary_constituency',
    lgd_code: 'PLACEHOLDER-VERIFY-AT-LGDIRECTORY',
    pc_code: 'PLACEHOLDER-VERIFY-AT-LGDIRECTORY',
    pc_name: 'Hyderabad',
    district: 'Hyderabad',
    state: 'Telangana',
    population: null,
    population_census_year: null,
    // A real, well-known city-center point (not a fabricated boundary) — good enough for
    // resolve-geography's GPS-nearest-centroid matching in a demo; a real Lok Sabha PC
    // boundary polygon should replace this before any non-demo use.
    boundary_geojson: { type: 'Point', coordinates: [78.4867, 17.385] },
    boundary_crosswalk_note:
      'Demo seed row only — real LGD/PC codes not verified in this pass; boundary_geojson is a city-center point, not a real constituency polygon. Replace before any non-demo use.',
  },
];

async function seedGeographicUnits() {
  for (const unit of GEOGRAPHIC_UNITS_SEED) {
    const checkRes = await fetch(
      `${SUPABASE_URL}/rest/v1/geographic_units?name=eq.${encodeURIComponent(unit.name)}&select=id`,
      { headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY } }
    );
    if (!checkRes.ok) {
      const err = await checkRes.text();
      console.warn('geographic_units seed skipped (table may not exist yet — run migrations first):', err);
      return;
    }
    const existingRows = await checkRes.json();
    if (existingRows.length > 0) {
      console.log('SKIP geographic_units (already seeded):', unit.name);
      continue;
    }
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/geographic_units`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(unit),
    });
    if (!insertRes.ok) {
      const err = await insertRes.text();
      throw new Error(`geographic_units insert failed: ${err}`);
    }
    console.log('OK geographic_units demo constituency seeded (LGD codes are placeholders — see comment above):', unit.name);
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
  await seedGeographicUnits();

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
