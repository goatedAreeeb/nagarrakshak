# RLS Policy Test Matrix — v2 tables (Migration 0009)

**Status: NOT YET EXECUTED.** No live Supabase project is connected to this repo (see `BASELINE.md`). This matrix defines the expected pass/fail per role × table × operation so that whoever provisions the first real project can run it as an acceptance check for CP-2 and CP-10, rather than trusting the policies by inspection alone.

How to run: create one test user per `role_v2` value, sign in as each via `supabase-js` with the anon key, then attempt each operation below and confirm the row matches.

| Table | Operation | citizen | mp_staff | mp | analyst | district_authority_liaison | administrator |
|---|---|---|---|---|---|---|---|
| `geographic_units` | SELECT | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `geographic_units` | INSERT | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ |
| `citizen_submissions` | SELECT own | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `citizen_submissions` | SELECT others' | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ (via own-role check; administrator not explicitly listed — **known gap, see below**) |
| `citizen_submissions` | INSERT (own `submitter_id`) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ (**known gap**) |
| `citizen_submissions` | UPDATE | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ |
| `submission_media` | SELECT own submission's media | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| `submission_media` | SELECT other citizen's media | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ |
| `voice_transcripts` | SELECT | ✅ (own) | ✅ | ✅ | ❌ | ❌ | ✅ |
| `theme_clusters` | SELECT | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ (**known gap**) |
| `evidence_records` | SELECT | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ (**known gap**) |
| `development_proposals` | SELECT | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ (**known gap**) |
| `development_proposals` | UPDATE (status) | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ |
| `priority_scores` / `score_components` | SELECT | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ (**known gap**) |
| `recommendations` | SELECT | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ (**known gap**) |
| `human_overrides` | SELECT | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ |
| `human_overrides` | **INSERT** | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ (**known gap**) |
| `audit_events` | SELECT | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ |
| `audit_events` | INSERT (any role, via anon/authenticated key) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ (no client insert policy exists at all — by design) |

## Known gaps to close before Phase 10 security gate

The staff-select policies written in `0009_rls_v2.sql` list `('mp_staff', 'mp', 'analyst', 'district_authority_liaison')` for the staff-review tables (`theme_clusters`, `evidence_records`, `development_proposals`, `priority_scores`, `score_components`, `recommendations`) and omit `administrator`, and the `human_overrides` INSERT policy intentionally omits `administrator` (an administrator manages users/roles, not rankings — see Report 2 §38 "administrator: user/role management only"). Confirm this is the desired behavior (it matches the least-privilege principle in the plan) rather than an oversight, before Phase 10 sign-off. If MP-office practice requires administrators to also read the ranking tables for support purposes, add `administrator` to the relevant SELECT policies — but do **not** add it to the `human_overrides` INSERT policy, since only `mp_staff`/`mp` should be able to override a rank.

## Most important single test

`human_overrides` INSERT as `citizen` and as `analyst` **must both fail**. This is the row-level backing for CP-9's "a citizen or analyst role cannot invoke log-override" acceptance criterion (REPORT_2 Part XVI Phase 9) and for the MP-recommends/District-Authority-sanctions separation the whole project is built to protect. The `log-override` Edge Function (Phase 9) must re-check this role server-side as well — RLS is the second line of defense, not the only one.
