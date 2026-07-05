# BASELINE — Phase 0 Freeze (pre-transformation snapshot)

**Date:** 2026-07-05
**Branch:** `transformation` (created from `main`)
**Tag:** `pre-transformation` (points at commit `0657507`)

## Build/Lint Health

- `npm run build`: **PASS** — Vite build succeeds, output in `dist/` (~2.3MB main chunk, unminified-warning only, no errors).
- `npm run lint`: **69 errors, 2 warnings** (pre-existing, not introduced by this transformation). Notable: `react-hooks/set-state-in-effect` in `NotificationContext.jsx`, `useComplaints.js`, `useUserComplaintStats.js`; unused var in `DashboardPage.jsx`; duplicate Tailwind keys (`glow-cyan`, `glow-amber`) in `tailwind.config.js`. Captured as baseline — not blocking, not being fixed in this pass unless touched incidentally.

## Database Backup

**N/A — no live Supabase project connected.** Repo ships only `.env.example` (placeholder values); no `.env` present, no deployed database to `pg_dump`. Schema exists only as SQL files in `supabase/`. Rollback path for this transformation is therefore the `pre-transformation` git tag plus the SQL migration files themselves (each additive migration is independently reversible by dropping only the new objects it created).

## Existing Route Inventory (`src/App.jsx`)

| Route | Page | Guard |
|---|---|---|
| `/` | LandingPage | none |
| `/login` | LoginPage | none |
| `/signup` | SignupPage | none |
| `/dashboard` | DashboardPage | ProtectedRoute |
| `/report` | ComplaintPage | ProtectedRoute (citizenOnly) |
| `/feed` | FeedPage | ProtectedRoute |
| `/leadership` | LeadershipPage | ProtectedRoute |
| `/map` | MapPage | ProtectedRoute |
| `/billboard` | BillboardPage | ProtectedRoute |
| `/billboard/publish` | BillboardPublishPage | ProtectedRoute + CityHeadRoute |
| `/city/analytics` | CityAnalyticsPage | ProtectedRoute + CityHeadRoute |
| `*` | NotFoundPage | none |

## Existing Database Tables (`supabase/schema.sql`)

**Enums:** `user_role`, `complaint_status`, `vote_type`, `notif_type`, `notice_type`

**Tables:** `wards`, `users`, `complaints`, `escalations`, `social_votes`, `notifications`, `messages`, `city_notices`, `dept_performance`

## Confirmed Security Findings (re-verified live, matches Report 2 Part XII)

- `src/lib/supabase.js` constructs `supabaseAdmin` client-side from `VITE_SUPABASE_SERVICE_KEY` if present — service-role key would ship in the browser bundle if ever set. **Must be removed in Phase 10.**
- Not yet re-checked this pass: RLS policy text for `complaints` SELECT/`escalations` UPDATE (deferred to Phase 10 per plan; schema.sql review happens in Phase 2).

## Phase 2 Note (Schema Evolution) — EXECUTED AGAINST LIVE PROJECT 2026-07-05

A real Supabase project (`yqarluunezgoerflgrxj`) was connected this session. `.env` is populated (gitignored, not committed) with `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GEMINI_KEY`, `VITE_MAPBOX_TOKEN`, `VITE_GOOGLE_MAPS_API_KEY`, `VITE_MAPTILER_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` (server-side only — deliberately **not** given a `VITE_` prefix, since that would recreate the S-001 client-bundle-exposure vulnerability Phase 10 exists to close).

The Supabase CLI could not `link` (needs a separate personal access token we don't have — only the DB password), so migrations were applied via a direct Postgres connection instead: `scripts/run-migrations.mjs <db-password>`, which runs `schema.sql` (the original app's base tables — also never previously executed), the FK-free `wards` seed rows, then `migrations/0001` through `0011` in order. All 25 tables now exist live (verified via `scripts/verify-schema.mjs`). `npm run seed:users` ran successfully — 18 demo accounts created with `role_v2` correctly backfilled (verified via `scripts/verify-users.mjs`), plus one demo `geographic_units` row.

**RLS policy matrix executed for real** (`scripts/verify-rls.mjs`), not just documented: `citizen` and `analyst` both correctly get `42501 row-level security policy` rejections on `human_overrides` INSERT; `mp_staff` passes RLS and only fails on a foreign-key constraint (probing against a dummy `recommendation_id`) — exactly the intended behavior from `supabase/tests/rls_policy_matrix.md`'s "most important single test." A citizen inserting their own `citizen_submissions` row (with `submitter_id` set explicitly, matching what `ingest-submission` does) succeeds; an anonymous/no-session client cannot read it back. Probe rows cleaned up after verification (`scripts/cleanup-probe-rows.mjs`).

**Still placeholder:** `geographic_units.lgd_code`/`pc_code` — a web search confirmed lgdirectory.gov.in carries real PC/AC codes, but pulling actual numeric codes needs browsing the live portal dataset directly, out of this pass's time budget. Flagged in `scripts/seed-demo-users.mjs` and here; replace before treating any dataset join as more than a demo.

**Still not deployed:** the 4 Edge Functions (`ingest-submission`, `extract-features`, `cluster-submissions`, `resolve-geography`) — deploying requires `supabase functions deploy`, which needs the Supabase CLI `link`ed with a personal access token (Settings → Access Tokens on the Supabase dashboard, or `supabase login`), which we don't have yet. Schema/RLS are now live and verified; the AI pipeline itself is still unexecuted.

## Phase 3+4 Note (Intake + Feature Extraction, merged)

Built together rather than sequentially: in this codebase the "Review" step of the
submission wizard *is* the AI-classification UI, so wiring intake without also
replacing what that step displays would leave it showing stale Gemini
dept/severity output against a schema that no longer stores it. Delivered:

- `supabase/functions/ingest-submission/` — validates caller JWT, rate-limits
  (20/hour), writes `citizen_submissions`/`submission_media`, hands off to
  extract-features via `EdgeRuntime.waitUntil` (non-blocking).
- `supabase/functions/extract-features/` — PROMPT-001 exactly as specified
  (REPORT_2 Part VIII §23), service-role-only, rejects any smuggled
  priority/severity field (fails closed to the deterministic keyword fallback),
  writes category/entities/sentiment/confidence back onto the submission.
- `StepAIResult.jsx` rewritten: uploads media, calls `ingest-submission`, polls
  the submission row for async feature results, shows category/sentiment/
  confidence instead of dept/severity/SLA. The old "review classification before
  submitting" UX is inverted to "submit first, see structured features after" —
  a real behavior change, matching the new async pipeline.
- Added a language selector to the submission wizard (`en`/`hi`/`te`/`hi-en`)
  as an MVP language-ID input. **Not done:** actual ASR transcription (no
  provider wired — `transcribe-voice` function doesn't exist yet), translation,
  and a real i18n UI layer — voice notes still upload as raw audio with no
  transcript. This matches the plan's own "MVP: language ID + one ASR
  language, partial" scope note, with ASR itself still outstanding.

**Not run against a live database or deployed** — same caveat as Phase 2. Both
functions are written to spec and internally consistent but unverified against
a real Supabase project. Old `gemini.js`/`duplicateCheck.js`/`officerRouting.js`
and the `complaints` table are untouched — the officer/supervisor/zonal
dashboards still read from the old schema and still work as before.

## Phase 5 Note (Semantic Intelligence / Clustering)

Added `supabase/functions/cluster-submissions/` — greedy nearest-centroid clustering
using Gemini text-embedding-004, replacing the old `duplicateCheck.js` 150m-haversine
suppression with clustering that preserves every submission and tracks
`unique_reporter_count` per cluster (never deletes). Migration `0011` adds
`pgvector` support (`submission_embeddings` table, `theme_clusters.centroid_embedding`)
— numbered after 0010 deliberately, since 0010 is reserved as the plan's one
destructive migration.

Added `src/modules/clustering/ClustersReviewPage.jsx` (`/staff/clusters`, gated by a
new `StaffRoute` guard checking `role_v2`) — read-only cluster review for MP-office
staff. `cluster-submissions` is service-role-only by design (batch/scheduled per
REPORT_2 Part V §14), so the UI does not have a "run clustering" button; the
page's own header comment documents how to invoke it manually via the Supabase
CLI for demo/dev purposes. A real scheduled trigger (pg_cron or a Supabase
Scheduled Function) is explicitly deferred, post-MVP.

Simplification, stated plainly: this is a greedy single-pass clusterer (compare
against existing centroids, join-or-create), not HDBSCAN — an explicit, documented
choice matching the time-boxed plan's "can start with a simpler clustering method."
Unexecuted against a live database, same caveat as every prior phase.

## Phase 6 Note (GIS — backend only, partial)

Added `supabase/functions/resolve-geography/` (GPS-nearest-centroid, falling back to
fuzzy name match against `location_mentions`) and chained `extract-features ->
resolve-geography` via `EdgeRuntime.waitUntil`, completing the async pipeline:
ingest-submission -> extract-features -> {cluster-submissions, resolve-geography}.

**Not done in this pass:** the frontend half of Phase 6 — replacing
`wards.health_score` in the `src/components/map/civic/` subsystem (25 files) with
population-normalized hotspot density from `theme_clusters`. That subsystem is
larger and less familiar than either audit report described (confirmed by file
count during this pass), and touching it needs its own focused read-first pass
per the plan's own principle ("no blind rewrite of a file without first reading
its current content") rather than being folded into the same change as new
backend logic. `geographic_units` also has no single centroid column yet —
`resolve-geography` derives one on the fly from `boundary_geojson`, which is
adequate for the backend logic but a real seed-data gap: the one demo
`geographic_unit` seeded in Phase 2 has no `boundary_geojson`, so GPS matching
against it will not actually resolve until a real or placeholder boundary is
seeded too.

## Reference Docs

- `../PEOPLES_PRIORITIES_PROBLEM_STATEMENT_RESEARCH_BIBLE.md`
- `../REPORT_1_RELEVANCE_GAP_AND_TARGET_SOLUTION.md`
- `../REPORT_2_TECHNICAL_TRANSFORMATION_EXECUTION_BLUEPRINT.md`
