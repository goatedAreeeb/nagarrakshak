-- Migration 0008: recommendations, human_overrides, audit_events (additive)
-- Encodes the MP-recommends / District-Authority-sanctions boundary directly in
-- the schema (`routing`), and makes every human override atomic with an audit
-- row (research bible Part II §3, Part XIX §48).
-- Rollback: DROP TABLE IF EXISTS audit_events, human_overrides, recommendations;

CREATE TABLE IF NOT EXISTS recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID REFERENCES development_proposals(id) ON DELETE CASCADE,
  routing TEXT NOT NULL CHECK (routing IN ('mplads_eligible', 'refer_elsewhere', 'advocacy_only')),
  rank INT,
  rationale TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS human_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id UUID REFERENCES recommendations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  previous_rank INT,
  new_rank INT,
  override_reason TEXT NOT NULL,
  justification TEXT,   -- must reference an evidence field or state 'political/contextual judgment' (Report 2 §26) — enforced at the Edge Function layer, not the DB
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,          -- e.g. 'override', 'ranking_computed', 'recommendation_routed'
  actor_id UUID REFERENCES users(id),
  recommendation_id UUID REFERENCES recommendations(id) ON DELETE SET NULL,
  override_id UUID REFERENCES human_overrides(id) ON DELETE SET NULL,
  detail JSONB,
  model_version TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recommendations_proposal ON recommendations (proposal_id);
CREATE INDEX IF NOT EXISTS idx_human_overrides_recommendation ON human_overrides (recommendation_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_recommendation ON audit_events (recommendation_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_override ON audit_events (override_id);

-- Validation query for CP-9: every row in human_overrides has a matching
-- audit_events row with event_type = 'override' (written atomically by log-override).
