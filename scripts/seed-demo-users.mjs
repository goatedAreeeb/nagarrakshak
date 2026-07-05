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
 * Demo constituency for geographic_units — Hyderabad Lok Sabha PC, Telangana.
 * Codes below are real and sourced, not fabricated:
 *   - lgd_code (507) = Hyderabad DISTRICT's official LGD code, from the LGD mirror CSV
 *     https://raw.githubusercontent.com/planemad/india-local-government-directory/main/administrative/2-district.csv
 *     (row: 36,TELANGANA,507,HYDERABAD,5,536 — columns: State Code, State Name,
 *     District Code, District Name, Census2001Code, Census2011Code). This is the
 *     DISTRICT's LGD code, not a distinct PC-level LGD code — the mirror's
 *     constituency/ folder only has Karnataka and Tamil Nadu files, not Telangana,
 *     so a true LGD-internal PC-specific numeric ID was not retrievable this pass.
 *   - pc_code (TS-PC-09) = Hyderabad's Parliamentary Constituency number within
 *     Telangana (ECI code S01-9), corroborated across electionpandit.com/state/
 *     telangana/pc/9/Hyderabad, en.wikipedia.org/wiki/Hyderabad_Lok_Sabha_constituency,
 *     and wikidata.org/wiki/Q3764307. This is the standard public PC number, not
 *     necessarily LGD's own internal PC record ID.
 * Still not independently verified: population figures (left null), and the exact
 * LGD-internal (not ECI) numeric PC identifier. Verify at lgdirectory.gov.in directly
 * before using in anything beyond a labeled demo.
 */
const GEOGRAPHIC_UNITS_SEED = [
  {
    name: 'Hyderabad Parliamentary Constituency (DEMO — see seed script comment for source/verification status)',
    level: 'parliamentary_constituency',
    lgd_code: '507', // Hyderabad DISTRICT's LGD code (verified) — not a distinct PC-level LGD id
    pc_code: 'TS-PC-09', // Hyderabad Lok Sabha PC number in Telangana, ECI code S01-9 (verified via secondary sources)
    pc_name: 'Hyderabad',
    district: 'Hyderabad',
    state: 'Telangana',
    // Real Census 2011 figure for Hyderabad DISTRICT (not PC-specific — no PC-level
    // population breakdown was retrievable this pass). Source: census2011.co.in/census/
    // district/122-hyderabad.html, corroborated by en.wikipedia.org/wiki/Demographics_of_Hyderabad.
    population: 3943323,
    population_census_year: 2011,
    // A real, well-known city-center point (not a fabricated boundary) — good enough for
    // resolve-geography's GPS-nearest-centroid matching in a demo; a real Lok Sabha PC
    // boundary polygon should replace this before any non-demo use.
    boundary_geojson: { type: 'Point', coordinates: [78.4867, 17.385] },
    boundary_crosswalk_note:
      'Demo seed row. lgd_code is the Hyderabad DISTRICT LGD code (real, verified), used as a stand-in since a distinct PC-level LGD id was not retrievable this pass. pc_code (TS-PC-09) reflects the real ECI PC number (S01-9), not an LGD-internal PC record id. boundary_geojson is a city-center point, not a real constituency polygon. Replace before any non-demo use.',
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
    console.log('OK geographic_units demo constituency seeded (see comment above for source/verification status per field):', unit.name);
  }
}

/**
 * Registry of connected datasets (REPORT_2 Part XI §32). LGD is a real live fetch
 * (github mirror of lgdirectory.gov.in, fetched during this development pass — see
 * BASELINE.md); UDISE+ and Census are cached single-record/single-figure extracts,
 * NOT live API integrations — bulk UDISE+ API access was never confirmed to exist
 * publicly, and Census village-level data has a real, disclosed freshness problem
 * (2011 is the latest full release). is_live reflects this honestly per dataset.
 */
const DATASET_SOURCES_SEED = [
  {
    name: 'LGD',
    source_url: 'https://raw.githubusercontent.com/planemad/india-local-government-directory/main/administrative/2-district.csv',
    license_note: 'Government open data (Ministry of Panchayati Raj / RGI) — verify redistribution terms at lgdirectory.gov.in before non-demo use.',
    update_frequency: 'Infrequent (administrative boundary changes)',
    dataset_version: 'planemad mirror, fetched 2026-07-05',
    is_live: true,
  },
  {
    name: 'UDISE+',
    source_url: 'https://udiseplus.gov.in/ (bulk API access unconfirmed; sample record via mahadevmaitri.org aggregator)',
    license_note: 'Government open data (Ministry of Education) — verify before redistribution.',
    update_frequency: 'Annual (school year)',
    dataset_version: 'Single cached sample record, fetched 2026-07-05 — NOT a live feed',
    is_live: false,
  },
  {
    name: 'Census of India',
    source_url: 'https://censusindia.gov.in/ (2011 district figures via census2011.co.in)',
    license_note: 'Government open data (Registrar General of India).',
    update_frequency: 'Decennial — 2021 Census delayed; 2011 is the latest full release as of this pass',
    dataset_version: '2011',
    is_live: false,
  },
];

async function seedDatasetSourcesAndEvidence() {
  const sourceIds = {};
  for (const source of DATASET_SOURCES_SEED) {
    const checkRes = await fetch(
      `${SUPABASE_URL}/rest/v1/dataset_sources?name=eq.${encodeURIComponent(source.name)}&select=id`,
      { headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY } }
    );
    if (!checkRes.ok) {
      console.warn('dataset_sources seed skipped (table may not exist yet):', await checkRes.text());
      return;
    }
    const existing = await checkRes.json();
    if (existing.length > 0) {
      sourceIds[source.name] = existing[0].id;
      console.log('SKIP dataset_sources (already seeded):', source.name);
      continue;
    }
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/dataset_sources`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(source),
    });
    if (!insertRes.ok) throw new Error(`dataset_sources insert failed: ${await insertRes.text()}`);
    const [inserted] = await insertRes.json();
    sourceIds[source.name] = inserted.id;
    console.log('OK dataset_sources seeded:', source.name);
  }

  const geoRes = await fetch(
    `${SUPABASE_URL}/rest/v1/geographic_units?pc_name=eq.Hyderabad&select=id`,
    { headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY } }
  );
  const [geoUnit] = await geoRes.json();
  if (!geoUnit) {
    console.warn('evidence_records seed skipped: no Hyderabad geographic_unit found');
    return;
  }

  const EVIDENCE_SEED = [
    {
      geographic_unit_id: geoUnit.id,
      dataset_source_id: sourceIds['Census of India'],
      category: 'demographics',
      metric_name: 'district_population',
      metric_value: 3943323,
      unit: 'persons',
      dataset_version: '2011',
      freshness_label: 'Census 2011 — 15 years old as of 2026, flagged stale',
      confidence: 'medium',
      raw_payload: { source: 'census2011.co.in/census/district/122-hyderabad.html', district: 'Hyderabad', literacy_rate_2011: 83.25 },
    },
    {
      geographic_unit_id: geoUnit.id,
      dataset_source_id: sourceIds['UDISE+'],
      category: 'school_infrastructure',
      metric_name: 'sample_school_enrollment',
      metric_value: 690,
      unit: 'students',
      dataset_version: 'single cached sample, 2026-07-05',
      freshness_label: 'Single-school sample, not a district aggregate — not representative on its own',
      confidence: 'low',
      raw_payload: {
        school_name: 'Shakuntala High School',
        udise_code: '36221292296',
        teachers: 45,
        pupil_teacher_ratio: Math.round((690 / 45) * 10) / 10,
        source: 'mahadevmaitri.org (third-party UDISE+ aggregator, not a direct udiseplus.gov.in API pull)',
      },
    },
  ];

  for (const ev of EVIDENCE_SEED) {
    const checkRes = await fetch(
      `${SUPABASE_URL}/rest/v1/evidence_records?geographic_unit_id=eq.${ev.geographic_unit_id}&metric_name=eq.${encodeURIComponent(ev.metric_name)}&select=id`,
      { headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY } }
    );
    const existing = await checkRes.json();
    if (existing.length > 0) {
      console.log('SKIP evidence_records (already seeded):', ev.metric_name);
      continue;
    }
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/evidence_records`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(ev),
    });
    if (!insertRes.ok) throw new Error(`evidence_records insert failed: ${await insertRes.text()}`);
    console.log('OK evidence_records seeded:', ev.metric_name);
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
  await seedDatasetSourcesAndEvidence();

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
