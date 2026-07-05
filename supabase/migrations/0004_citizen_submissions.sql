-- Migration 0004: citizen_submissions, submission_media, voice_transcripts (additive)
-- Replaces the single `complaints` object with a submission model that can carry
-- any channel/language/modality without assuming a municipal-department taxonomy.
-- Rollback: DROP TABLE IF EXISTS voice_transcripts, submission_media, citizen_submissions;

CREATE TABLE IF NOT EXISTS citizen_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submitter_id UUID REFERENCES users(id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (channel IN ('app', 'voice', 'photo', 'letter_ocr', 'assisted', 'whatsapp_import')),
  language TEXT,
  raw_text TEXT,
  geographic_unit_id UUID REFERENCES geographic_units(id),
  lat FLOAT,
  lng FLOAT,
  address TEXT,
  category TEXT,           -- set by extract-features (Edge Function), never a priority/severity value
  entities JSONB,
  location_mentions JSONB,
  sentiment TEXT,
  confidence FLOAT,
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'processing', 'processed', 'needs_review')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS submission_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID REFERENCES citizen_submissions(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL CHECK (media_type IN ('photo', 'voice', 'ocr_scan')),
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS voice_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID REFERENCES citizen_submissions(id) ON DELETE CASCADE,
  media_id UUID REFERENCES submission_media(id) ON DELETE SET NULL,
  language TEXT,
  transcript TEXT,
  confidence FLOAT,
  provider TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_citizen_submissions_geo ON citizen_submissions (geographic_unit_id);
CREATE INDEX IF NOT EXISTS idx_citizen_submissions_submitter ON citizen_submissions (submitter_id);
CREATE INDEX IF NOT EXISTS idx_submission_media_submission ON submission_media (submission_id);
CREATE INDEX IF NOT EXISTS idx_voice_transcripts_submission ON voice_transcripts (submission_id);

CREATE TRIGGER citizen_submissions_updated_at
  BEFORE UPDATE ON citizen_submissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Validation query for CP-3: insert/select smoke test.
-- INSERT INTO citizen_submissions (submitter_id, channel, raw_text) VALUES (auth.uid(), 'app', 'test') RETURNING id;
