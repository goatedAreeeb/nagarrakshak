-- Migration 0012: persist generate-explanation's output on priority_scores (additive)
-- Without this, staff could never actually read an explanation via RLS-scoped
-- select — generate-explanation is service-role-only and staff can't call it
-- directly from the browser. Storing the result lets ProposalDetailPage read it
-- like any other column, no extra service-role hop needed from the client.
-- Rollback: ALTER TABLE priority_scores DROP COLUMN IF EXISTS explanation_text, DROP COLUMN IF EXISTS explanation_validated;

ALTER TABLE priority_scores ADD COLUMN IF NOT EXISTS explanation_text TEXT;
ALTER TABLE priority_scores ADD COLUMN IF NOT EXISTS explanation_validated BOOLEAN;

-- Validation query for CP-8/CP-9: after compute-priority -> generate-explanation
-- chain completes, priority_scores.explanation_text should be non-null for a
-- scored proposal, and explanation_validated should be true unless the LLM
-- was unavailable/failed citation validation (in which case it's the documented
-- fallback text and explanation_validated is false).
