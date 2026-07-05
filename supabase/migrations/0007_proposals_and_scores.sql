-- Migration 0007: development_proposals, proposal_evidence, priority_scores, score_components (additive)
-- The candidate-project/portfolio object with no analog in the old complaints-only
-- schema, plus the transparent scoring tables. No column here is ever written by
-- an LLM call directly — compute-priority (Edge Function) is deterministic (research bible Part XVII).
-- Rollback: DROP TABLE IF EXISTS score_components, priority_scores, proposal_evidence, development_proposals;

CREATE TABLE IF NOT EXISTS development_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  geographic_unit_id UUID REFERENCES geographic_units(id),
  source_cluster_id UUID REFERENCES theme_clusters(id),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  estimated_cost_band TEXT,          -- e.g. 'under_10L', '10L_50L', '50L_1Cr', 'over_1Cr' — always a band, never presented as an exact figure
  status TEXT NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate', 'recommended', 'referred', 'advocacy_only', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS proposal_evidence (
  proposal_id UUID REFERENCES development_proposals(id) ON DELETE CASCADE,
  evidence_id UUID REFERENCES evidence_records(id) ON DELETE CASCADE,
  PRIMARY KEY (proposal_id, evidence_id)
);

CREATE TABLE IF NOT EXISTS priority_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID UNIQUE REFERENCES development_proposals(id) ON DELETE CASCADE,
  total_score FLOAT NOT NULL,
  confidence TEXT NOT NULL DEFAULT 'medium' CHECK (confidence IN ('high', 'medium', 'low')),
  model_version TEXT NOT NULL,       -- pinned so historical rankings stay explainable after a formula/weight change
  computed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS score_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  priority_score_id UUID REFERENCES priority_scores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                -- e.g. 'population_impact', 'severity_need', 'equity_correction', 'feasibility', 'cost', 'urgency'
  value FLOAT,
  weight FLOAT NOT NULL,
  source TEXT,
  confidence TEXT NOT NULL DEFAULT 'medium' CHECK (confidence IN ('high', 'medium', 'low')),
  missing_data BOOLEAN NOT NULL DEFAULT FALSE  -- flagged for human verification, never silently defaulted to 0 (research bible §12-13)
);

CREATE INDEX IF NOT EXISTS idx_development_proposals_geo ON development_proposals (geographic_unit_id);
CREATE INDEX IF NOT EXISTS idx_score_components_score ON score_components (priority_score_id);

CREATE TRIGGER development_proposals_updated_at
  BEFORE UPDATE ON development_proposals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Validation query for CP-8: re-running compute-priority on the same proposal_id
-- produces the same total_score (determinism check) and score_components rows sum
-- to a value consistent with total_score under the declared weights.
