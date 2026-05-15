-- Add flag for citizen "safety-sensitive" reports (harassment, unsafe public space, etc.)
-- Run once on existing projects: psql or Supabase SQL editor

ALTER TABLE complaints
  ADD COLUMN IF NOT EXISTS safety_sensitive BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN complaints.safety_sensitive IS
  'Citizen chose safety-sensitive flow; staff should prioritise review. Not a substitute for 112/100.';
