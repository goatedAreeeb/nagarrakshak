# People's Priorities — Setup & Handoff

Status: Phases 0–12 of `REPORT_2_TECHNICAL_TRANSFORMATION_EXECUTION_BLUEPRINT.md` are complete and verified live against a real Supabase project. This file is for whoever picks this up next — full setup from zero, what's already done, what's still missing.

Read `REPORT_1_...md` and `REPORT_2_...md` in `D:\h2s\` first for the full spec/rationale. This file is the practical "how do I actually run this" companion, not a replacement.

---

## 1. Prerequisites

- Node.js 20+ (repo pinned to this; `ws` package is a required polyfill for Supabase Realtime on Node <22 — already a dependency)
- A Supabase project (free tier is fine)
- A Google Gemini API key (**free tier is only 20 requests/day per model** — see §7, this bit the demo prep hard)
- Mapbox / Google Maps / MapTiler keys (only needed for the old map/civic subsystem, not the new pipeline — can stub with placeholders if you don't care about the Map page)
- GitHub push access to wherever you're deploying this (see §8 — the original upstream repo is NOT pushable by this project's working accounts)

## 2. Environment setup

Copy `.env.example` to `.env` and fill in:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_GEMINI_KEY=            # legacy, only read by dead code (src/lib/gemini.js) — safe to leave as placeholder
VITE_MAPBOX_TOKEN=
VITE_GOOGLE_MAPS_API_KEY=
VITE_MAPTILER_KEY=
SUPABASE_SERVICE_ROLE_KEY=  # legacy JWT format, from Supabase dashboard Settings -> API
```

Add two more lines not in `.env.example` (needed only for setup scripts, never bundled into the client):

```
SUPABASE_ACCESS_TOKEN=      # personal access token, Supabase dashboard -> Account -> Access Tokens. Needed to `supabase link` / `supabase functions deploy` / fetch the new-format service key.
database_password=          # your Supabase project's Postgres password (Settings -> Database). Needed only for scripts/run-migrations.mjs and scripts/apply-single-migration.mjs.
```

**Never commit `.env`.** It's gitignored already — check `git status` before any commit if you're ever unsure.

## 3. Database setup (fresh project)

```
npm install
node scripts/run-migrations.mjs <database_password>
npm run seed:users
```

`run-migrations.mjs` runs `supabase/schema.sql` (the original app's base schema) then every file in `supabase/migrations/` in filename order — **except this project's migration `0010` is numbered out of execution order**. It was written and applied *last*, after `0011`–`0014`, because it's the one destructive migration and was gated behind Phase 11's integration-testing checkpoint (CP-11) passing first. If you're bootstrapping fresh and want to replay history exactly as it happened, apply `0001`–`0009` and `0011`–`0014` via `run-migrations.mjs`, then run `0010` last by hand:

```
node scripts/apply-single-migration.mjs 0010_retire_old_domain.sql <database_password>
```

If you don't care about replaying history and just want the *end state*, running everything in filename order (0001→0014, including 0010 in its numeric slot) produces the same final schema — the ordering only mattered because of the destructive-migration gate during original development, not because of any actual dependency between 0010 and 0011–0014.

`scripts/apply-single-migration.mjs <file> <password>` applies exactly one migration file without replaying the whole history — use this for any new migration on an already-live database (this is how every migration from 0013 onward was actually applied).

## 4. Edge Functions

```
export SUPABASE_ACCESS_TOKEN=<your token>
npx supabase link --project-ref <your-project-ref>
npx supabase functions deploy ingest-submission
npx supabase functions deploy extract-features
npx supabase functions deploy resolve-geography
npx supabase functions deploy cluster-submissions
npx supabase functions deploy fuse-evidence
npx supabase functions deploy compute-priority
npx supabase functions deploy generate-explanation
npx supabase functions deploy log-override
```

Then set the one Edge Function secret that isn't auto-provisioned by Supabase:

```
npx supabase secrets set GEMINI_API_KEY=<your gemini key> --project-ref <your-project-ref>
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected into every Edge Function by the platform — don't set those manually. Note the service-role key Edge Functions see is the *new* `sb_secret_...` format, not the legacy JWT in your `.env` — if you ever need to call a service-role-only function directly from outside (curl, a script), fetch the new-format key with:

```
npx supabase projects api-keys --project-ref <ref> --output json --reveal
```

## 5. Seed data

```
npm run seed:users
```

Seeds 18 demo accounts (all password `demo123` — see the full list in `scripts/seed-demo-users.mjs`), the LGD-coded demo constituency (`geographic_units`), dataset source registry rows (LGD/UDISE+/Census — see honesty notes in the script, only LGD is a real live-fetched source), and 2 evidence records.

For a presentable, diverse demo shortlist (rather than empty/test-only data):

```
node scripts/seed-demo-pipeline-data.mjs <sb_secret_key>
```

This submits ~7 realistic multilingual (Hindi/Telugu/code-mixed/English) submissions across categories and channels, runs them through the live pipeline, and computes priority for each resulting cluster. Get `<sb_secret_key>` via the `projects api-keys --reveal` command above. **Mind the Gemini 20/day quota (§7) before running this** — it makes one LLM call per submission plus explanation-generation calls.

## 6. Running locally

```
npm run dev
```

Demo accounts (password `demo123` for all):
- `citizen1@demo.com` through `citizen6@demo.com` — new-domain submission flow (`/report`)
- `mpstaff1@demo.com` (role_v2 `mp_staff`), `mp1@demo.com` (role_v2 `mp`), `analyst1@demo.com` (role_v2 `analyst`), `districtauth1@demo.com` (role_v2 `district_authority_liaison`), `admin@nagarsevak.in` (role_v2 `administrator`) — land on `/staff/proposals` (Phase 12 fix — these used to fall through to the old citizen dashboard)
- `worker1@demo.com`, `officer1@demo.com`, `officer2@demo.com`, `supervisor1@demo.com`, `zonal1@demo.com`, `city1@demo.com` — **old-domain accounts, now broken**. `complaints`/`escalations`/`wards` are frozen read-only since migration 0010. Assign/escalate/mark-in-progress buttons will silently fail. Don't demo with these.

## 7. Critical operational notes

- **Gemini free tier is 20 requests/day per model.** `extract-features` and `generate-explanation` both call it. Running the verification scripts in §9 or the seed script in §5 will burn through this fast. If you're rehearsing a demo, count your calls, or upgrade to a paid tier before the actual presentation — hitting the cap mid-demo means every subsequent submission silently falls back to the deterministic keyword extractor (correct designed behavior, but a visibly worse demo).
- Migration `0010` is destructive and already run against the live project referenced in this repo's history — don't run it again on the same project (it's idempotent via `DROP TABLE IF EXISTS`/`DROP POLICY IF EXISTS`, so re-running is harmless, but there's nothing left to drop).
- `git remote -v` on this repo points to `github.com/goatedAreeeb/nagarrakshak`, not the original `AnirudhPratapSinghYadav/NagarRakshak`. Two GitHub accounts were tried against the original repo and both got HTTP 403 — no push access there. All work is on branch `h2s`.
- The original upstream repo's git history has real leaked secrets (Supabase service key, Gemini key, Google Maps key) committed in its very first commit, already public on GitHub. Not this project's keys (different Supabase project ref), not fixed here — explicitly left for the repo owner to handle. See conversation history / git log around Phase 10 if you need the exact commit hashes.

## 8. Verification scripts

All in `scripts/`, all need the sb_secret key (`npx supabase projects api-keys --reveal`, see §4) unless noted:

| Script | Checks |
|---|---|
| `verify-schema.mjs` | Tables exist as expected |
| `verify-users.mjs` | Seeded demo accounts + role_v2 backfill |
| `verify-rls.mjs` | `human_overrides` INSERT rejected for citizen/analyst, allowed for mp_staff |
| `verify-submission-insert.mjs` | Citizen can insert own `citizen_submissions`, RLS-scoped |
| `verify-e2e-pipeline.mjs` | Old, superseded by `verify-e2e-phase11.mjs` — kept for reference |
| `verify-priority-engine.mjs` | cluster → compute-priority (determinism check) → generate-explanation |
| `verify-log-override.mjs` | Role gate on `log-override` (citizen/analyst rejected, mp_staff allowed) |
| `verify-e2e-phase11.mjs` | Full pipeline: submit → extract → geo-resolve → cluster → fuse-evidence → compute-priority → explain → staff review → override → audit |
| `verify-complaints-update-rls.mjs` | **Superseded by migration 0010** — see its own header comment. Now expected to fail on the "ALLOWED" assertions since complaints is fully frozen. |
| `verify-frozen-tables.mjs` | Current, correct check that complaints/escalations/wards are read-only for every role |
| `verify-prompt-injection.mjs` | Adversarial injection attempts against `extract-features` — 5 cases |
| `verify-realtime-notifications.mjs` | Live Realtime delivery check for the `notifications` table |
| `cleanup-probe-rows.mjs`, `backup-before-0010.mjs`, `apply-single-migration.mjs` | Utilities, see inline comments |
| `seed-demo-pipeline-data.mjs` | See §5 |

Run any of them with:
```
node scripts/<name>.mjs <sb_secret_key>
```
(a few older ones instead take `<db-password>` or no argument at all — check the file's own usage line)

## 9. What's NOT done (see full discussion in project conversation history for context)

**AI pipeline**
- No ASR (voice transcription) — no `transcribe-voice` function exists. Voice notes upload as raw audio only.
- No real translation/i18n UI layer — language-ID selector only.
- `fuse-evidence` is not called automatically by `compute-priority` — evidence only attaches to a proposal if invoked manually. Real submissions through the live UI today get scored but show no evidence unless someone runs `fuse-evidence` by hand.
- Only 2 real `evidence_records` exist (population, one UDISE+ sample). 5 of the 7 demo categories have zero evidence.
- No anomaly/coordinated-submission-manipulation detection (explicitly required by the original challenge brief, marked post-MVP in the blueprint).
- Multimodal (actual photo/voice file upload + AI processing) never live-tested end-to-end — all testing used text-only submissions.

**Ranking engine**
- Weights are hardcoded and duplicated between `WeightSettingsPage.jsx` (display) and `compute-priority`'s `WEIGHTS` constant (actual scoring) — no shared config table, no editing UI.
- Equity/population-normalization multiplier is hardcoded neutral (1.0×) — never actually computes a real correction from cross-geography data.

**Old-domain leftovers**
- worker/officer/supervisor/zonal/city dashboards and routes still exist, now non-functional (frozen tables). Only hidden from nav for citizen/staff-v2 roles, not deleted.
- `officerRouting.js`/`DEMO_EMAIL` hardcoded routing logic — still present, dead code.
- `ClosureVerify.jsx`'s "+10 civic credits" messaging — still present, dead code (complaints frozen).
- The 25-file map/civic/billboard subsystem is still fully GHMC/NagarRakshak-branded internally — only unlinked from nav, never rewritten (explicitly deferred by the blueprint itself).
- `CitizenDashboard`'s Filed/Resolved/Active metric cards still read the frozen `complaints` table — permanently stale, never rewired to `citizen_submissions`.

**Testing / ops / security**
- No real automated test suite (Jest/Playwright/etc.) — every verification in this project was a one-off script in `scripts/`, not CI-integrated.
- No CI/CD pipeline.
- No observability/error-monitoring (no Sentry, no structured logging beyond `console.error`, no AI-call metrics — prompt version/latency/confidence/schema-reject-rate tracking was flagged as important but never built).
- No TypeScript.
- Two competing map-GL libraries (`mapbox-gl` and `maplibre-gl`) both installed — never deduped.
- No server-side image re-encoding to strip EXIF GPS metadata on upload — `ingest-submission` only validates metadata about already-uploaded media, doesn't touch image bytes.
- CORS/allowed-origins config on Edge Functions never audited.
- `submission_media` storage bucket RLS/policies never explicitly verified as configured.
- DPDP retention policy is analysis-only — no actual scheduled purge/retention mechanism in code.
- No feature-flag system — all the recommended flags (`multilingual_intake`, `dataset_fusion_live`, etc.) were never actually built as toggles.
- No accessibility (WCAG) pass performed on the multilingual UI.
- No performance benchmarking against the stated budget (dashboard <3s, map <4s, extraction <5s, ranking <2s).
- `public_summary_view` (billboard repurpose, gated behind legal review) — never built.
