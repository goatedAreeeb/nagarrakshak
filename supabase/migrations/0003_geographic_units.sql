-- Migration 0003: geographic_units (additive)
-- LGD-coded geography carrying PC/AC identifiers, replacing the ward-only
-- model with something that can join to UDISE+/Census/LGD data.
-- Rollback: DROP TABLE IF EXISTS geographic_units;

CREATE TABLE IF NOT EXISTS geographic_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('village', 'gram_panchayat', 'ulb_ward', 'block', 'district', 'assembly_constituency', 'parliamentary_constituency')),
  lgd_code TEXT,
  pc_code TEXT,
  pc_name TEXT,
  ac_code TEXT,
  ac_name TEXT,
  district TEXT,
  state TEXT,
  parent_unit_id UUID REFERENCES geographic_units(id),
  population INT,
  population_census_year INT,
  boundary_geojson JSONB,
  boundary_crosswalk_note TEXT, -- documents known mismatch vs. UDISE educational-block boundaries (research bible Part VIII §21-22)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_geographic_units_lgd_code ON geographic_units (lgd_code);
CREATE INDEX IF NOT EXISTS idx_geographic_units_pc_code ON geographic_units (pc_code);
CREATE INDEX IF NOT EXISTS idx_geographic_units_ac_code ON geographic_units (ac_code);

-- Validation query for CP-2: table exists and is queryable.
-- SELECT count(*) FROM geographic_units;
