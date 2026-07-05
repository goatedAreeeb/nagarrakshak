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

## Phase 2 Note (Schema Evolution)

Migrations `0001`-`0009` written under `supabase/migrations/` per Report 2 Part IV §12 (all additive, old tables untouched). **Not yet run against a live database** — no Supabase project is connected to this repo (see above). `scripts/seed-demo-users.mjs` updated to backfill `role_v2` on all demo accounts and seed one demo `geographic_units` row, but its `lgd_code`/`pc_code` values are explicitly labeled placeholders — a web search in this pass confirmed the LGD portal (lgdirectory.gov.in) exists and does carry PC/AC codes, but the actual numeric codes for the Hyderabad Lok Sabha constituency were not retrievable without browsing the live portal dataset directly, which was out of this pass's time budget. RLS policy test matrix (`supabase/tests/rls_policy_matrix.md`) documents expected per-role pass/fail but is also unexecuted pending a live project. **Before demo:** provision a real Supabase project, run migrations 0002-0009 in order, run `npm run seed:users`, verify the policy matrix, and replace the placeholder LGD codes with values pulled from lgdirectory.gov.in.

## Reference Docs

- `../PEOPLES_PRIORITIES_PROBLEM_STATEMENT_RESEARCH_BIBLE.md`
- `../REPORT_1_RELEVANCE_GAP_AND_TARGET_SOLUTION.md`
- `../REPORT_2_TECHNICAL_TRANSFORMATION_EXECUTION_BLUEPRINT.md`
