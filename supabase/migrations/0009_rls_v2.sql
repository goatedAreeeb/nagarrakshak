-- Migration 0009: RLS policies for every new (v2) table, under role_v2.
-- Old-role RLS policies (Migration-era `complaints`/`escalations`/etc.) are left
-- untouched — this migration only adds policies for tables created in 0003-0008.
-- Design rules enforced here (see REPORT_2 Part XII):
--   - citizens can only see/write their own citizen_submissions
--   - raw media (submission_media, voice_transcripts) is NEVER visible to `analyst` (PII)
--   - theme_clusters/evidence/proposals/scores/recommendations are staff-only reads
--   - human_overrides can only be inserted by mp_staff/mp (never citizen/analyst/district_authority_liaison)
--   - audit_events has no client INSERT policy at all — only the service-role
--     (inside the log-override Edge Function) can write it, so every override
--     is atomic with its audit row by construction, not by client discipline.
-- Rollback: DROP POLICY <name> ON <table> for each policy below (or disable RLS on the new tables).

ALTER TABLE geographic_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE citizen_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE theme_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_cluster_membership ENABLE ROW LEVEL SECURITY;
ALTER TABLE dataset_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE development_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE priority_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE score_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE human_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

-- geographic_units: readable by any authenticated user; write restricted to staff roles.
CREATE POLICY "geo units readable" ON geographic_units FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "geo units write staff" ON geographic_units FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role_v2 IN ('mp_staff', 'mp', 'administrator'))
);
CREATE POLICY "geo units update staff" ON geographic_units FOR UPDATE USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role_v2 IN ('mp_staff', 'mp', 'administrator'))
);

-- citizen_submissions: citizens see/insert only their own; staff roles see all; analyst sees all rows
-- (no PII columns live on this table itself — raw media is separate, see below).
CREATE POLICY "submissions select own or staff" ON citizen_submissions FOR SELECT USING (
  auth.uid() = submitter_id
  OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role_v2 IN ('mp_staff', 'mp', 'analyst', 'district_authority_liaison'))
);
CREATE POLICY "submissions insert own or assisted" ON citizen_submissions FOR INSERT WITH CHECK (
  auth.uid() = submitter_id
  OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role_v2 IN ('mp_staff', 'mp'))
);
CREATE POLICY "submissions update staff only" ON citizen_submissions FOR UPDATE USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role_v2 IN ('mp_staff', 'mp', 'administrator'))
);

-- submission_media / voice_transcripts: PII-bearing. Visible to the submitter and to
-- mp_staff/mp/administrator only — explicitly NOT analyst (Report 2 Part XII §38).
CREATE POLICY "media select own or reviewer" ON submission_media FOR SELECT USING (
  EXISTS (SELECT 1 FROM citizen_submissions s WHERE s.id = submission_media.submission_id AND s.submitter_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role_v2 IN ('mp_staff', 'mp', 'administrator'))
);
CREATE POLICY "media insert own or assisted" ON submission_media FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM citizen_submissions s WHERE s.id = submission_media.submission_id AND s.submitter_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role_v2 IN ('mp_staff', 'mp'))
);

CREATE POLICY "transcripts select own or reviewer" ON voice_transcripts FOR SELECT USING (
  EXISTS (SELECT 1 FROM citizen_submissions s WHERE s.id = voice_transcripts.submission_id AND s.submitter_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role_v2 IN ('mp_staff', 'mp', 'administrator'))
);
-- No client INSERT policy on voice_transcripts: only transcribe-voice (service-role Edge Function) writes it.

-- theme_clusters / submission_cluster_membership: staff-facing review tool, not shown to citizens.
-- No client INSERT/UPDATE policy: only cluster-submissions (service-role Edge Function) writes these.
CREATE POLICY "clusters select staff" ON theme_clusters FOR SELECT USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role_v2 IN ('mp_staff', 'mp', 'analyst', 'district_authority_liaison'))
);
CREATE POLICY "cluster membership select staff" ON submission_cluster_membership FOR SELECT USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role_v2 IN ('mp_staff', 'mp', 'analyst', 'district_authority_liaison'))
);

-- dataset_sources / evidence_records: staff-facing provenance display.
-- No client write policy: only fuse-evidence (service-role Edge Function) writes these.
CREATE POLICY "dataset sources select staff" ON dataset_sources FOR SELECT USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role_v2 IN ('mp_staff', 'mp', 'analyst', 'district_authority_liaison'))
);
CREATE POLICY "evidence select staff" ON evidence_records FOR SELECT USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role_v2 IN ('mp_staff', 'mp', 'analyst', 'district_authority_liaison'))
);

-- development_proposals: staff-facing; status can be updated by staff (e.g. candidate -> recommended).
-- No client INSERT policy: proposals are generated server-side from theme_clusters.
CREATE POLICY "proposals select staff" ON development_proposals FOR SELECT USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role_v2 IN ('mp_staff', 'mp', 'analyst', 'district_authority_liaison'))
);
CREATE POLICY "proposals update staff" ON development_proposals FOR UPDATE USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role_v2 IN ('mp_staff', 'mp', 'administrator'))
);
CREATE POLICY "proposal evidence select staff" ON proposal_evidence FOR SELECT USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role_v2 IN ('mp_staff', 'mp', 'analyst', 'district_authority_liaison'))
);

-- priority_scores / score_components: staff-facing, read-only from the client.
-- No client write policy: only compute-priority (service-role Edge Function) writes these.
CREATE POLICY "priority scores select staff" ON priority_scores FOR SELECT USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role_v2 IN ('mp_staff', 'mp', 'analyst', 'district_authority_liaison'))
);
CREATE POLICY "score components select staff" ON score_components FOR SELECT USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role_v2 IN ('mp_staff', 'mp', 'analyst', 'district_authority_liaison'))
);

-- recommendations: staff-facing read-only from the client.
-- No client write policy: written by the ranking pipeline (service-role).
CREATE POLICY "recommendations select staff" ON recommendations FOR SELECT USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role_v2 IN ('mp_staff', 'mp', 'analyst', 'district_authority_liaison'))
);

-- human_overrides: the one client-writable governance table, restricted to mp_staff/mp only.
-- This is the row-level enforcement backing CP-9's "citizen or analyst cannot invoke override" check
-- (the log-override Edge Function re-checks this server-side too — belt and suspenders).
CREATE POLICY "overrides select staff" ON human_overrides FOR SELECT USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role_v2 IN ('mp_staff', 'mp', 'administrator'))
);
CREATE POLICY "overrides insert mp staff only" ON human_overrides FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role_v2 IN ('mp_staff', 'mp'))
);

-- audit_events: read-only from the client, staff/admin only. Deliberately NO insert policy —
-- every audit row must be written by the service-role inside log-override / compute-priority,
-- atomically with the action it records, so it cannot be forged or skipped from the client.
CREATE POLICY "audit events select staff" ON audit_events FOR SELECT USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role_v2 IN ('mp_staff', 'mp', 'administrator'))
);
