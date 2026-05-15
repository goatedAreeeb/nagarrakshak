-- Run once in Supabase SQL Editor if "Mark resolved" fails for supervisors
CREATE POLICY "Escalations update staff" ON escalations FOR UPDATE USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('supervisor','zonal','city'))
);
