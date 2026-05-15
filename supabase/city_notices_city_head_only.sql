-- Restrict bulletin publish/update to City Head (role: city) only.
-- Run in Supabase SQL Editor if you already applied an older city_notices.sql.

DROP POLICY IF EXISTS "City notices insert staff" ON city_notices;
DROP POLICY IF EXISTS "City notices update staff" ON city_notices;
DROP POLICY IF EXISTS "City notices insert city head" ON city_notices;
DROP POLICY IF EXISTS "City notices update city head" ON city_notices;

CREATE POLICY "City notices insert city head" ON city_notices FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'city')
);

CREATE POLICY "City notices update city head" ON city_notices FOR UPDATE USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'city')
);
