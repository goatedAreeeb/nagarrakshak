-- Migration 0011: submission embeddings (additive)
-- Numbered after 0010 deliberately: 0010 is reserved as the plan's one and only
-- destructive migration (retire old domain, gated behind CP-11) — new additive
-- work for later phases continues from 0011, not by editing already-numbered files.
-- Needed by cluster-submissions (Phase 5) to compute semantic similarity between
-- submissions instead of the old 150m-haversine-plus-department-match rule.
-- Rollback: DROP TABLE IF EXISTS submission_embeddings; DROP EXTENSION IF EXISTS vector;

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS submission_embeddings (
  submission_id UUID PRIMARY KEY REFERENCES citizen_submissions(id) ON DELETE CASCADE,
  embedding VECTOR(768),   -- matches Gemini text-embedding-004 output dimensionality
  model_version TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Also store each cluster's running centroid so cluster-submissions can compare a
-- new submission against existing clusters without re-reading every member's embedding.
ALTER TABLE theme_clusters ADD COLUMN IF NOT EXISTS centroid_embedding VECTOR(768);

-- Validation query for CP-5: after clustering a batch, every citizen_submissions row
-- with status IN ('processed','needs_review') should have a matching submission_embeddings row.

ALTER TABLE submission_embeddings ENABLE ROW LEVEL SECURITY;

-- Staff-only read; no client write policy at all — only cluster-submissions
-- (service-role Edge Function) ever writes an embedding.
CREATE POLICY "embeddings select staff" ON submission_embeddings FOR SELECT USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role_v2 IN ('mp_staff', 'mp', 'analyst', 'district_authority_liaison'))
);

