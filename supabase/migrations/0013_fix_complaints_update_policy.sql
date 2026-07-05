-- Phase 10 security hardening: close the verified RLS bypass on `complaints`.
--
-- "Workers update assigned" previously allowed any authenticated user to update
-- any complaint (USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid())),
-- i.e. "user exists" with no role or assignment filter). "Citizens update own"
-- had a parallel bypass: any worker/officer/supervisor/zonal/city role could
-- update any complaint, not just their own/assigned one. Since Postgres RLS
-- OR's multiple permissive policies for the same command, either bypass alone
-- made the whole UPDATE effectively unrestricted.
--
-- Replacement: citizens can only update their own complaint; workers/officers
-- only a complaint currently assigned to them; officers additionally retain
-- dept-scoped access (needed to assign a worker to a brand-new complaint,
-- where assigned_to is still null — see OfficerComplaintDetail.jsx); supervisor/
-- zonal/city keep broad oversight access, consistent with their access on
-- wards/escalations elsewhere in this schema.

DROP POLICY IF EXISTS "Citizens update own" ON complaints;
CREATE POLICY "Citizens update own" ON complaints FOR UPDATE
  USING (auth.uid() = citizen_id);

DROP POLICY IF EXISTS "Workers update assigned" ON complaints;
CREATE POLICY "Workers update assigned" ON complaints FOR UPDATE
  USING (
    assigned_to = auth.uid()
    OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'officer' AND u.dept = complaints.dept)
    OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('supervisor','zonal','city'))
  );
