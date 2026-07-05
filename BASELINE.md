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

## Phase 9 EXECUTED LIVE 2026-07-05 (MP Decision Dashboard — CP-9 confirmed)

Two more gaps filled before the dashboard could actually work: (1)
`generate-explanation`'s output was never persisted anywhere staff could read
it (it's service-role-only, staff can't call it from the browser) — added
migration 0012 (`priority_scores.explanation_text`/`explanation_validated`)
and had `compute-priority` chain into `generate-explanation` via
`EdgeRuntime.waitUntil`, same pattern as the earlier ingest→extract chain. (2)
Nothing created a `recommendations` row (the MPLADS-eligibility routing) from
a scored proposal — added a rule-based `ROUTING_BY_CATEGORY` table inside
`compute-priority`, explicitly labeled illustrative/not verified against the
actual MPLADS admissibility annexures (research bible itself flags exact
admissible categories as `[U]` unverified).

Built and deployed `log-override` — the one client-callable governance-write
function, called with the staff member's own JWT (so we know who they are)
but using a service-role client internally to write `human_overrides` +
`audit_events` atomically, since `audit_events` has zero client INSERT policy
by design. Two independent enforcement layers: the function's own role check
AND migration 0009's RLS backstop.

**Real bug caught and fixed by live testing**: rank computation used
`findIndex(...) + 1 || fallback`. When `findIndex` legitimately found the
proposal at position 0, `0 + 1 = 1`, but `1` is truthy so that's fine — the
actual bug was a floating-point round-trip mismatch between the in-memory
`totalScore` and the value just read back from Postgres, making `<=`
comparison fail, `findIndex` return `-1`, `-1 + 1 = 0`, and `0 || fallback`
incorrectly trigger the fallback (0 is falsy in JS) — observed live as
`rank: 2` for the only proposal in the geography. Fixed by counting
strictly-higher-scoring siblings (excluding self via `.neq`) instead of
trying to find the proposal's own position among values re-read from the DB.
Verified fix: rank now correctly shows 1.

**CP-9 verified live** (`scripts/verify-log-override.mjs`): citizen and
analyst both rejected by `log-override` (403, role check), `mp_staff`
allowed — writes confirmed atomic (`human_overrides` row has a matching
`audit_events` row with `event_type: 'override'`). This test override
(`override_reason: 'RLS/role probe as mp_staff'`) was **not deleted from the
audit log** — the whole point of Phase 9's audit trail is append-only
immutability, so scrubbing a real, valid action to keep the demo tidy would
undermine the exact guarantee being demonstrated.

Built `ProposalsPage.jsx` (`/staff/proposals`, ranked list with routing
badges), `ProposalDetailPage.jsx` (`/staff/proposals/:id`, full score
breakdown + evidence + explanation + override form, override UI only rendered
for `mp_staff`/`mp` roles), and `AuditLogPage.jsx` (`/staff/audit-log`,
read-only).

**Still open:** only one real proposal exists (the Phase 8 demo one) — the
ranked list and rank-among-siblings logic haven't been exercised with
multiple competing proposals yet. `severity_need`'s sentiment-proxy and
`feasibility`'s total absence of a data source remain open from Phase 8.

## Phase 8 EXECUTED LIVE 2026-07-05 (Priority Engine — core differentiator)

Built and deployed `compute-priority` (deterministic weighted-MCDA, no LLM call
at all) and `generate-explanation` (PROMPT-003, narrates an already-computed
score with post-generation citation validation). Also fills a real gap neither
report actually specified: nothing in REPORT_1/REPORT_2's API catalogue creates
a `development_proposal` from a `theme_cluster` — `compute-priority` now accepts
either `{proposal_id}` to score an existing proposal, or `{cluster_id, title,
category}` to bootstrap one first.

**Design choice honoring the plan's own critique (research bible Part IV
§12-13):** equity is applied as a *multiplier* on population_impact, not a
separate additively-weighted term — treating it as independent risks
double-counting, which is exactly what that critique warned against. Weights
are visible constants in the function source and mirrored (with a documented
sync-debt note) in `WeightSettingsPage.jsx` (`/staff/settings/weights`),
read-only for this MVP per the plan's own allowance.

**Verified live end-to-end** (`scripts/verify-priority-engine.mjs`): a real
citizen submission → clustered → proposal bootstrapped from the cluster →
scored. Real evidence flowed all the way through — `population_impact` used
the actual UDISE+ sample enrollment (690) over district population (3,943,323);
`severity_need` used the real mean sentiment from `extract-features`
('concerned' → 0.6); `cost`/`urgency` came from the internal rule tables.
`equity_correction` and `feasibility` correctly stayed `missing_data: true`
rather than being guessed. **Determinism confirmed**: re-running
`compute-priority` on the same proposal_id produced the bit-identical
`total_score` (0.3412485208988639) both times. `generate-explanation` cited
only real component numbers (`validated: true`) and correctly stated evidence
for the two missing components "is not yet available" rather than inventing a
value for them.

This demo submission/cluster/proposal was kept (not deleted like earlier probe
data) — it's clean, realistic content suitable for Phase 12's demo dataset,
not throwaway test junk.

**Still open:** `severity_need` is a sentiment-based proxy, not a validated
infrastructure-gap severity index (no such dataset connected); `feasibility`
has no data source at all yet (correctly flagged, never fabricated). Both are
real, disclosed limitations — not fabricated to look more complete.

## Phase 7 EXECUTED LIVE 2026-07-05 (Evidence Fusion)

Real, sourced data replaced the earlier LGD/PC placeholders:
- `lgd_code` = 507 (Hyderabad **district** LGD code, verified via the LGD mirror CSV
  at github.com/planemad/india-local-government-directory — the mirror's
  `constituency/` folder only has Karnataka and Tamil Nadu, not Telangana, so a
  distinct PC-level LGD id wasn't retrievable; the district code is used as a
  labeled stand-in, not presented as a PC-specific id).
- `pc_code` = TS-PC-09 (Hyderabad Lok Sabha PC number in Telangana, ECI code
  S01-9, corroborated across electionpandit.com, Wikipedia, and Wikidata).
- `population` = 3,943,323 (Census 2011, Hyderabad district — census2011.co.in,
  corroborated by Wikipedia's Demographics of Hyderabad page).

Built `fuse-evidence` Edge Function (deployed, tested live) and
`seedDatasetSourcesAndEvidence()` in the seed script, seeding `dataset_sources`
(LGD marked `is_live: true` since it was an actual live fetch this pass; UDISE+
and Census marked `is_live: false` — cached/single-sample, per the plan's own
honesty rule since bulk UDISE+ API access was never confirmed to exist
publicly) and two real `evidence_records`: the Census population figure above,
and a single real UDISE+ school sample (Shakuntala High School, UDISE code
36221292296, Hyderabad — enrollment 690, 45 teachers, pupil-teacher ratio 15.3
— sourced via a third-party UDISE+ aggregator since udiseplus.gov.in itself
returned 403 on direct fetch; **explicitly not** a district-wide aggregate,
labeled `confidence: low` and "not representative on its own").

Built `EvidencePage.jsx` (`/staff/evidence`) — read-only, shows every figure
with its dataset source, live/cached badge, retrieval date, and freshness
label. Verified `fuse-evidence` live via curl: returns both evidence records
with full provenance intact.

**Still open:** only one real UDISE+ school sample exists (not a real district
aggregate or multiple schools) — a single-school evidence record is
illustrative, not something a real ranking should treat as district-representative.
No live UDISE+ bulk connector exists; would need either confirmed API access
or a larger manually-curated extract to go beyond this one sample.

## Gemini + service-role key findings (live testing, 2026-07-05)

Two real bugs found only by testing against live infra (both fixed, see git log):
`gemini-2.0-flash` has zero quota on this account regardless of which key is used
(account-level model restriction) — switched to `gemini-2.5-flash`, which spends
part of its token budget on hidden "thinking" tokens by default and was truncating
JSON output before the closing brace; fixed with `thinkingConfig.thinkingBudget: 0`.
Embedding model `text-embedding-004` is 404 on this account; switched to
`gemini-embedding-001` with `outputDimensionality: 768` to keep the existing
`VECTOR(768)` schema. Re-verified the full pipeline end-to-end with real (not
fallback) LLM output, and separately verified clustering: a near-duplicate pair
correctly merged into one cluster while a distinct-topic submission stayed in
its own — confirmed live via `cluster-submissions`.

**Service-role key format note:** this project auto-injects the *new*
`sb_secret_...`-format key as `SUPABASE_SERVICE_ROLE_KEY` inside Edge Functions,
not the legacy JWT that's in `.env`/dashboard Settings → API (`0_g1T...`). Internal
function-to-function calls are unaffected (both sides read the same platform env
var, whatever format it is). But anyone invoking a service-role-only function
*directly* from outside (e.g. the manual CLI trigger documented in
`ClustersReviewPage.jsx`'s header comment, or `supabase functions invoke`) must
use the new-format key — get it via `supabase projects api-keys --reveal --output json`.

## Phases 3-6 EXECUTED LIVE 2026-07-05

Supabase CLI linked with a personal access token (`SUPABASE_ACCESS_TOKEN` in `.env`,
never committed). All 4 Edge Functions deployed for real:
`ingest-submission`, `extract-features`, `cluster-submissions`, `resolve-geography`.
`GEMINI_API_KEY` set as an Edge Function secret (`supabase secrets set`) — confirmed
via `supabase secrets list` that Supabase also auto-provisions `SUPABASE_URL`/
`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` to every function, no manual setup needed.

**Full pipeline verified end-to-end live** (`scripts/verify-e2e-pipeline.mjs`): a real
citizen login calls `ingest-submission` → row lands in `citizen_submissions` →
`extract-features` fires asynchronously → `resolve-geography` chains after it →
final row shows `category: 'school_infrastructure'`, `geographic_unit_id` correctly
set to the seeded Hyderabad constituency. Confirmed via direct DB query (the
verify script's own poll loop raced the async chain and exited early — a script
timing bug, not a pipeline bug).

**Real finding, not a bug:** the given `GEMINI_API_KEY` is a valid key but returns
`429 RESOURCE_EXHAUSTED` (quota limit 0 — billing not enabled on that Google Cloud
project), confirmed by hitting the Gemini REST endpoint directly. `extract-features`
correctly fell back to its deterministic keyword extractor when the LLM call failed
(confidence 0.4, matching the fallback's own value) — this is the fail-closed
guardrail working exactly as designed, not silently crashing or fabricating a
result. To see the actual LLM-based extraction (not just the fallback), enable
billing on the Gemini API key's Google Cloud project, or supply a different key
with available quota.

Closed the Phase 6 gap flagged below: `geographic_units`'s single demo row had no
`boundary_geojson`, so GPS matching had nothing to compare against. Added a real
(if approximate) Hyderabad city-center point (`{type: 'Point', coordinates:
[78.4867, 17.385]}`) — both in the live row (direct UPDATE) and in
`seed-demo-users.mjs` for future fresh projects. Clearly labeled as a city-center
point standing in for a real constituency boundary polygon, not a fabricated
precise boundary.

**Constituency decision:** kept Hyderabad rather than switching to a different
real Lok Sabha constituency, per explicit instruction to avoid risking new
errors this late — the whole pipeline is now proven against it live.

**Still open:** LGD/PC/AC numeric codes are still placeholders (need a manual
lgdirectory.gov.in lookup, not a credential issue). Frontend map data-source
swap (Phase 6, 25-file subsystem) still not started. The Gemini quota issue
above means AI extraction quality can't be evaluated yet, only the
infrastructure and fallback path.

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
