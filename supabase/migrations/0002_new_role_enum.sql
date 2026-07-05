-- Migration 0002: new role enum (additive)
-- Adds user_role_v2 alongside the existing user_role enum/column. Old role
-- column is untouched — both are readable during the transition period.
-- Rollback: ALTER TABLE users DROP COLUMN IF EXISTS role_v2; DROP TYPE IF EXISTS user_role_v2;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role_v2') THEN
    CREATE TYPE user_role_v2 AS ENUM (
      'citizen', 'mp_staff', 'mp', 'district_authority_liaison', 'analyst', 'administrator'
    );
  END IF;
END $$;

ALTER TABLE users ADD COLUMN IF NOT EXISTS role_v2 user_role_v2;

-- Backfill from the old municipal-hierarchy role. There is no exact institutional
-- equivalent for every old role; this mapping is a reasonable default only —
-- real MP-office staff should be reassigned role_v2 explicitly, not left on the backfill guess.
UPDATE users SET role_v2 = CASE role
  WHEN 'citizen'    THEN 'citizen'::user_role_v2
  WHEN 'worker'      THEN 'mp_staff'::user_role_v2
  WHEN 'officer'     THEN 'mp_staff'::user_role_v2
  WHEN 'supervisor'  THEN 'analyst'::user_role_v2
  WHEN 'zonal'       THEN 'analyst'::user_role_v2
  WHEN 'city'        THEN 'mp'::user_role_v2
  ELSE 'citizen'::user_role_v2
END
WHERE role_v2 IS NULL;

-- Validation query for CP-2: every user must have a non-null role_v2.
-- SELECT count(*) FROM users WHERE role_v2 IS NULL; -- expect 0
