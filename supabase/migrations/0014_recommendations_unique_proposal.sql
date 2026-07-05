-- Phase 11 integration testing found a real bug: compute-priority INSERTed a new
-- recommendations row on every call instead of updating the existing one, so
-- re-scoring the same proposal (a normal, intended operation — see its own
-- determinism check) silently accumulated duplicate rows. Nothing enforced
-- recommendations being 1:1 with development_proposals even though the rest of
-- the system assumes it is (log-override updates the recommendation "rank" in
-- place; staff review reads it expecting a single row per proposal).
--
-- Dedupe first, then add the constraint that should have existed since
-- migration 0008, so the corresponding compute-priority code fix (insert ->
-- upsert) can rely on it. human_overrides.recommendation_id cascades on
-- delete (migration 0008), so a naive "keep newest" dedupe would silently
-- destroy a real override row if it happened to point at an older duplicate
-- (verified live: exactly one such row exists from Phase 9 testing) — the
-- row with an existing override is always kept, newest-first only as the
-- tiebreak among duplicates with no override.

WITH ranked AS (
  SELECT r.id,
         ROW_NUMBER() OVER (
           PARTITION BY r.proposal_id
           ORDER BY
             (EXISTS (SELECT 1 FROM human_overrides ho WHERE ho.recommendation_id = r.id)) DESC,
             r.created_at DESC,
             r.id DESC
         ) AS rn
  FROM recommendations r
)
DELETE FROM recommendations
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

ALTER TABLE recommendations ADD CONSTRAINT recommendations_proposal_id_key UNIQUE (proposal_id);
