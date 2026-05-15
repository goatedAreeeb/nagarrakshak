-- Run AFTER city_notices.sql (or if table exists but is empty)
-- You should see: "3 rows" when this succeeds

INSERT INTO city_notices (
  title,
  summary,
  guidance,
  notice_type,
  priority,
  is_active,
  is_pinned,
  publisher_name,
  publisher_role,
  starts_at,
  ends_at
)
VALUES
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
  );

-- Must return 3 rows — run this to confirm:
SELECT id, title, notice_type, is_active FROM city_notices ORDER BY priority, created_at DESC;
