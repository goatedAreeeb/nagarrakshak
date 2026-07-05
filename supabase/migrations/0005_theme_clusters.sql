-- Migration 0005: theme_clusters + membership join table (additive)
-- Replaces duplicateCheck.js's suppress-on-match behavior with clustering that
-- preserves every submission and counts unique reporters (research bible Part XVI:
-- deleting duplicates destroys the population-impact evidence the ranking engine needs).
-- Rollback: DROP TABLE IF EXISTS submission_cluster_membership, theme_clusters;

CREATE TABLE IF NOT EXISTS theme_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  geographic_unit_id UUID REFERENCES geographic_units(id),
  label TEXT,               -- validated against a curated taxonomy (PROMPT-002), never a raw LLM invention
  taxonomy_key TEXT,
  unique_reporter_count INT NOT NULL DEFAULT 0,
  member_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS submission_cluster_membership (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id UUID REFERENCES theme_clusters(id) ON DELETE CASCADE,
  submission_id UUID REFERENCES citizen_submissions(id) ON DELETE CASCADE,
  similarity_score FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (cluster_id, submission_id)
);

CREATE INDEX IF NOT EXISTS idx_theme_clusters_geo ON theme_clusters (geographic_unit_id);
CREATE INDEX IF NOT EXISTS idx_scm_cluster ON submission_cluster_membership (cluster_id);
CREATE INDEX IF NOT EXISTS idx_scm_submission ON submission_cluster_membership (submission_id);

CREATE TRIGGER theme_clusters_updated_at
  BEFORE UPDATE ON theme_clusters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Validation query for CP-5: a near-duplicate test set clusters into one row
-- with member_count/unique_reporter_count matching the number of distinct submitters, not 1.
