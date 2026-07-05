-- Migration 0006: dataset_sources + evidence_records (additive)
-- The core differentiator vs. the old app: every claim about a geography is
-- traceable to a named dataset with a retrieval date and freshness label,
-- never a hardcoded/synthetic number presented as live (research bible Part XX).
-- Rollback: DROP TABLE IF EXISTS evidence_records, dataset_sources;

CREATE TABLE IF NOT EXISTS dataset_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,        -- e.g. 'LGD', 'UDISE+', 'Census'
  source_url TEXT,
  license_note TEXT,
  update_frequency TEXT,
  dataset_version TEXT,
  is_live BOOLEAN NOT NULL DEFAULT FALSE,  -- FALSE = cached/manual extract, per Report 2 Part XI honesty rule
  last_ingested_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS evidence_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  geographic_unit_id UUID REFERENCES geographic_units(id),
  dataset_source_id UUID REFERENCES dataset_sources(id),
  category TEXT,                    -- e.g. 'education', 'health', 'infrastructure'
  metric_name TEXT NOT NULL,        -- e.g. 'enrollment_count', 'pupil_teacher_ratio'
  metric_value FLOAT,
  unit TEXT,
  retrieved_at TIMESTAMPTZ DEFAULT NOW(),
  dataset_version TEXT,
  freshness_label TEXT,             -- e.g. 'Census 2011 — 15 years old, flagged'
  confidence TEXT NOT NULL DEFAULT 'medium' CHECK (confidence IN ('high', 'medium', 'low')),
  raw_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evidence_records_geo ON evidence_records (geographic_unit_id);
CREATE INDEX IF NOT EXISTS idx_evidence_records_source ON evidence_records (dataset_source_id);

-- Validation query for CP-7: every evidence_records row has dataset_source_id,
-- retrieved_at, and freshness_label populated (no silent blank provenance).
