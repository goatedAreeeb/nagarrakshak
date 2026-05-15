-- City bulletin / outbreak notices — run in Supabase SQL Editor
-- NOTE: "Success. No rows returned" is NORMAL for CREATE TABLE / policies.
-- The INSERT below should say "3 rows". If not, run city_notices_seed.sql next.

DO $$ BEGIN
  CREATE TYPE notice_type AS ENUM (
    'outbreak', 'emergency', 'health_campaign', 'event', 'advisory'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS city_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  guidance TEXT,
  notice_type notice_type NOT NULL DEFAULT 'advisory',
  priority INT NOT NULL DEFAULT 2 CHECK (priority BETWEEN 1 AND 3),
  is_active BOOLEAN DEFAULT true,
  is_pinned BOOLEAN DEFAULT false,
  zone TEXT,
  published_by UUID REFERENCES users(id) ON DELETE SET NULL,
  publisher_name TEXT,
  publisher_role TEXT,
  starts_at TIMESTAMPTZ DEFAULT NOW(),
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE city_notices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "City notices readable" ON city_notices;
CREATE POLICY "City notices readable" ON city_notices FOR SELECT USING (true);

DROP POLICY IF EXISTS "City notices insert staff" ON city_notices;
DROP POLICY IF EXISTS "City notices insert city head" ON city_notices;
CREATE POLICY "City notices insert city head" ON city_notices FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'city')
);

DROP POLICY IF EXISTS "City notices update staff" ON city_notices;
DROP POLICY IF EXISTS "City notices update city head" ON city_notices;
CREATE POLICY "City notices update city head" ON city_notices FOR UPDATE USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'city')
);

DROP POLICY IF EXISTS "City notices delete city" ON city_notices;
CREATE POLICY "City notices delete city" ON city_notices FOR DELETE USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'city')
);

-- Demo bulletins
INSERT INTO city_notices (
  title, summary, guidance, notice_type, priority, is_active, is_pinned,
  publisher_name, publisher_role, starts_at, ends_at
) VALUES
(
  'Dengue prevention alert — Hyderabad',
  'Increased dengue cases reported in several zones. GHMC urges citizens to remove stagnant water and use repellents.',
  E'Remove standing water from coolers, pots, and tyres at home.\nUse mosquito repellent during dawn and dusk.\nReport breeding sites via NagarRakshak under Public Health.\nSeek medical care if you have high fever with body pain.',
  'outbreak',
  1,
  true,
  true,
  'Municipal Commissioner',
  'city',
  NOW() - INTERVAL '2 days',
  NOW() + INTERVAL '30 days'
),
(
  'LPT immunization drive — free shots this week',
  'Greater Hyderabad Municipal Corporation is running a free Leptospirosis (LPT) vaccination camp at ward health centres.',
  E'Carry Aadhaar and previous vaccination card if available.\nCamp timings: 9 AM – 4 PM at nearest UPHC.\nWear a mask; maintain queue distance.\nEligible: high-risk groups and livestock handlers.',
  'health_campaign',
  2,
  true,
  true,
  'Municipal Commissioner',
  'city',
  NOW() - INTERVAL '1 day',
  NOW() + INTERVAL '14 days'
),
(
  'Heat wave safety advisory',
  'IMD has issued a heat wave warning for Hyderabad. Avoid outdoor work between 11 AM and 4 PM.',
  E'Stay hydrated; carry water when travelling.\nDo not leave children or pets in parked vehicles.\nCheck on elderly neighbours.\nUse NagarRakshak to report water supply issues under HMWSSB.',
  'advisory',
  3,
  true,
  false,
  'GHMC Disaster Cell',
  'city',
  NOW(),
  NOW() + INTERVAL '7 days'
)
;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE city_notices;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Verify (should show 3 rows):
SELECT id, title, notice_type, is_pinned FROM city_notices ORDER BY priority;
