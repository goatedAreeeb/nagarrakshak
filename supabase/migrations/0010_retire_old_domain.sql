-- Migration 0010: retire old domain (REPORT_2 Part IV §12 / Part XVI Phase 11).
-- The only destructive migration in the whole plan. Must not run before CP-11
-- (Phase 11 Integration Testing) passes, and only after a fresh backup.
--
-- 1. DROP social_votes and dept_performance entirely — features intentionally
--    removed (Report 1's KEEP/MODIFY/REMOVE/BUILD matrix).
-- 2. FREEZE (not drop) complaints/escalations/wards: drop every old-role-gated
--    write policy (INSERT/UPDATE/DELETE), leaving only the existing public
--    SELECT policies. citizen_submissions/development_proposals is now the
--    live pipeline; these tables are kept for historical/demo continuity but
--    no longer writable. This is a known, accepted breaking change to the
--    old officer/worker/supervisor screens (assign, mark-in-progress,
--    closure-verify, escalate) — Phase 12 removes those screens next.
--
-- Rollback: restore complaints/escalations/wards/social_votes/dept_performance
-- from the pre-migration JSON backup (scripts/backup-before-0010.mjs output),
-- then re-run schema.sql's original policy definitions for complaints/
-- escalations/wards.

-- Freeze complaints
DROP POLICY IF EXISTS "Citizens insert own" ON complaints;
DROP POLICY IF EXISTS "Citizens update own" ON complaints;
DROP POLICY IF EXISTS "Workers update assigned" ON complaints;

-- Freeze escalations
DROP POLICY IF EXISTS "Escalations insert staff" ON escalations;
DROP POLICY IF EXISTS "Escalations update staff" ON escalations;

-- Freeze wards
DROP POLICY IF EXISTS "Wards update staff" ON wards;

-- Remove intentionally-dropped features
DROP TABLE IF EXISTS social_votes CASCADE;
DROP TABLE IF EXISTS dept_performance CASCADE;
