-- NagarRakshak Hyderabad — Seed Data
-- Run schema.sql first. Create auth users via Supabase Dashboard or Auth API with emails below.
-- Password for all demo accounts: run scripts/seed-demo-users.mjs (default: demo123)

-- WARDS
INSERT INTO wards (id, name, lat, lng, population, zone, open_issues, resolved_issues, health_score, dominant_category) VALUES
(1, 'Charminar', 17.3616, 78.4747, 310000, 'South', 42, 128, 32.0, 'Roads'),
(2, 'Secunderabad', 17.4399, 78.4983, 420000, 'North', 28, 156, 58.0, 'Sanitation'),
(3, 'Kukatpally', 17.4849, 78.3995, 580000, 'West', 18, 210, 74.0, 'Drainage'),
(4, 'LB Nagar', 17.3469, 78.5538, 390000, 'East', 12, 198, 82.0, 'Parks'),
(5, 'Uppal', 17.4010, 78.5597, 410000, 'East', 35, 142, 51.0, 'Traffic'),
(6, 'Serilingampally', 17.4889, 78.3277, 620000, 'West', 8, 245, 88.0, 'Street Lighting'),
(7, 'Malakpet', 17.3770, 78.5003, 280000, 'South', 48, 95, 38.0, 'Public Health'),
(8, 'Ameerpet', 17.4374, 78.4487, 350000, 'Central', 22, 167, 65.0, 'HMWSSB');

-- Demo user UUIDs (replace with actual auth.users ids after signup, or use these when seeding via service role)
-- citizen1: a0000001-0000-4000-8000-000000000001
-- citizen2: a0000002-0000-4000-8000-000000000002
-- worker1:  a0000003-0000-4000-8000-000000000003
-- worker2:  a0000004-0000-4000-8000-000000000004
-- officer1: a0000005-0000-4000-8000-000000000005
-- officer2: a0000006-0000-4000-8000-000000000006
-- supervisor1: a0000007-0000-4000-8000-000000000007
-- zonal1:   a0000008-0000-4000-8000-000000000008
-- city1:    a0000009-0000-4000-8000-000000000009
-- admin:    a0000010-0000-4000-8000-000000000010

INSERT INTO users (id, email, name, role, ward_id, dept, zone, credits, trust_score) VALUES
('a0000001-0000-4000-8000-000000000001', 'citizen1@demo.com', 'Harshit Divekar', 'citizen', 1, NULL, NULL, 360, 1.0),
('a0000002-0000-4000-8000-000000000002', 'citizen2@demo.com', 'Priya Sharma', 'citizen', 3, NULL, NULL, 195, 1.0),
('a0000003-0000-4000-8000-000000000003', 'worker1@demo.com', 'Suresh Reddy', 'worker', NULL, 'Roads', NULL, 0, 1.0),
('a0000004-0000-4000-8000-000000000004', 'worker2@demo.com', 'Lakshmi Devi', 'worker', NULL, 'Sanitation', NULL, 0, 1.0),
('a0000005-0000-4000-8000-000000000005', 'officer1@demo.com', 'Venkat Rao', 'officer', NULL, 'Roads', NULL, 0, 1.0),
('a0000006-0000-4000-8000-000000000006', 'officer2@demo.com', 'Anitha Prasad', 'officer', NULL, 'HMWSSB', NULL, 0, 1.0),
('a0000007-0000-4000-8000-000000000007', 'supervisor1@demo.com', 'Ramesh Iyer', 'supervisor', NULL, NULL, 'South', 0, 1.0),
('a0000008-0000-4000-8000-000000000008', 'zonal1@demo.com', 'Kavitha Naidu', 'zonal', NULL, NULL, 'South', 0, 1.0),
('a0000009-0000-4000-8000-000000000009', 'city1@demo.com', 'GHMC Admin', 'city', NULL, NULL, NULL, 0, 1.0),
('a0000010-0000-4000-8000-000000000010', 'admin@nagarsevak.in', 'System Admin', 'city', NULL, NULL, NULL, 0, 1.0)
ON CONFLICT (id) DO NOTHING;

-- 60 COMPLAINTS (distributed across wards)
INSERT INTO complaints (id, citizen_id, lat, lng, address, description, dept, division, severity, status, sla_hours, sla_deadline, assigned_to, ward_id, is_duplicate, master_complaint_id, duplicate_count, is_chronic, chronic_count, upvote_count, same_issue_count, ai_reasoning, created_at) VALUES
('c0000001-0000-4000-8000-000000000001', 'a0000001-0000-4000-8000-000000000001', 17.3620, 78.4750, 'Charminar Rd', 'Large pothole near bus stop causing accidents', 'Roads', 'Road Maintenance', 4, 'open', 12, NOW() - INTERVAL '2 hours', NULL, 1, false, NULL, 3, false, 0, 12, 5, 'Critical road hazard near high footfall area', NOW() - INTERVAL '3 days'),
('c0000002-0000-4000-8000-000000000002', 'a0000001-0000-4000-8000-000000000001', 17.3618, 78.4745, 'Laad Bazaar', 'Garbage not collected for 5 days', 'Sanitation', 'Solid Waste', 3, 'assigned', 48, NOW() + INTERVAL '20 hours', 'a0000004-0000-4000-8000-000000000004', 1, false, NULL, 0, false, 0, 8, 2, 'Sanitation backlog in commercial zone', NOW() - INTERVAL '2 days'),
('c0000003-0000-4000-8000-000000000003', 'a0000002-0000-4000-8000-000000000002', 17.4855, 78.4000, 'KPHB Colony', 'Water pipeline burst flooding street', 'HMWSSB', 'Distribution', 5, 'in_progress', 2, NOW() - INTERVAL '1 hour', 'a0000003-0000-4000-8000-000000000003', 3, false, NULL, 0, true, 4, 25, 10, 'Emergency water supply failure', NOW() - INTERVAL '5 hours'),
('c0000004-0000-4000-8000-000000000004', 'a0000002-0000-4000-8000-000000000002', 17.4840, 78.3990, 'JNTU Road', 'Street light not working for 2 weeks', 'Street Lighting', 'Maintenance', 2, 'resolved', 168, NOW() + INTERVAL '100 hours', 'a0000003-0000-4000-8000-000000000003', 3, false, NULL, 0, false, 0, 3, 1, 'Minor lighting issue on arterial road', NOW() - INTERVAL '10 days'),
('c0000005-0000-4000-8000-000000000005', 'a0000001-0000-4000-8000-000000000001', 17.4405, 78.4990, 'Secunderabad Station', 'Stray dogs menacing commuters', 'Stray Animals', 'Animal Control', 4, 'open', 12, NOW() + INTERVAL '8 hours', NULL, 2, false, NULL, 0, false, 0, 15, 7, 'Public safety concern at transit hub', NOW() - INTERVAL '1 day'),
('c0000006-0000-4000-8000-000000000006', 'a0000002-0000-4000-8000-000000000002', 17.3475, 78.5545, 'LB Nagar X Roads', 'Open manhole cover missing', 'Drainage', 'Sewerage', 5, 'assigned', 2, NOW() - INTERVAL '30 minutes', 'a0000004-0000-4000-8000-000000000004', 4, false, NULL, 0, false, 0, 30, 12, 'Life-threatening open manhole', NOW() - INTERVAL '4 hours'),
('c0000007-0000-4000-8000-000000000007', 'a0000001-0000-4000-8000-000000000001', 17.4015, 78.5600, 'Uppal Ring Road', 'Illegal encroachment on footpath', 'Town Planning', 'Encroachment', 3, 'in_progress', 48, NOW() + INTERVAL '30 hours', 'a0000003-0000-4000-8000-000000000003', 5, false, NULL, 0, false, 0, 5, 3, 'Footpath blocked by vendors', NOW() - INTERVAL '6 days'),
('c0000008-0000-4000-8000-000000000008', 'a0000002-0000-4000-8000-000000000002', 17.4895, 78.3285, 'Gachibowli', 'Park maintenance neglected', 'Parks', 'Horticulture', 1, 'closed', 336, NOW() + INTERVAL '300 hours', 'a0000003-0000-4000-8000-000000000003', 6, false, NULL, 0, false, 0, 2, 0, 'Low priority park upkeep', NOW() - INTERVAL '30 days'),
('c0000009-0000-4000-8000-000000000009', 'a0000001-0000-4000-8000-000000000001', 17.3775, 78.5010, 'Malakpet Market', 'Drainage overflow during rain', 'Drainage', 'Storm Water', 4, 'open', 12, NOW() - INTERVAL '5 hours', NULL, 7, false, NULL, 2, true, 3, 18, 8, 'Recurring flooding in market area', NOW() - INTERVAL '4 days'),
('c0000010-0000-4000-8000-000000000010', 'a0000002-0000-4000-8000-000000000002', 17.4380, 78.4495, 'Ameerpet Metro', 'Power outage affecting signals', 'TSSPDCL', 'Distribution', 4, 'assigned', 12, NOW() + INTERVAL '6 hours', 'a0000003-0000-4000-8000-000000000003', 8, false, NULL, 0, false, 0, 9, 4, 'Electrical fault near metro station', NOW() - INTERVAL '8 hours');

-- Additional complaints 11-60 (abbreviated dept variety)
INSERT INTO complaints (citizen_id, lat, lng, address, description, dept, division, severity, status, sla_hours, sla_deadline, assigned_to, ward_id, is_duplicate, master_complaint_id, duplicate_count, is_chronic, upvote_count, same_issue_count, ai_reasoning, created_at)
SELECT
  CASE (n % 2) WHEN 0 THEN 'a0000001-0000-4000-8000-000000000001'::uuid ELSE 'a0000002-0000-4000-8000-000000000002'::uuid END,
  w.lat + (random() * 0.01 - 0.005),
  w.lng + (random() * 0.01 - 0.005),
  w.name || ' Area Issue #' || n,
  CASE (n % 11)
    WHEN 0 THEN 'Pothole on main road near school'
    WHEN 1 THEN 'Garbage dump not cleared'
    WHEN 2 THEN 'Water logging after rain'
    WHEN 3 THEN 'Broken street light pole'
    WHEN 4 THEN 'Stray cattle on road'
    WHEN 5 THEN 'Sewage smell from drain'
    WHEN 6 THEN 'Illegal parking blocking traffic'
    WHEN 7 THEN 'Park bench broken'
    WHEN 8 THEN 'Low water pressure in colony'
    WHEN 9 THEN 'Transformer sparking'
    ELSE 'Harassment reported near bus stop'
  END,
  (ARRAY['Roads','Sanitation','Drainage','Street Lighting','Stray Animals','Drainage','Traffic','Parks','HMWSSB','TSSPDCL','Women Safety'])[1 + (n % 11)],
  'General Wing',
  1 + (n % 5),
  (ARRAY['open','assigned','in_progress','resolved','closed','reopened']::complaint_status[])[1 + (n % 6)],
  CASE WHEN n % 5 = 4 THEN 2 WHEN n % 5 = 3 THEN 12 WHEN n % 5 = 2 THEN 48 WHEN n % 5 = 1 THEN 168 ELSE 336 END,
  CASE WHEN n % 7 = 0 THEN NOW() - INTERVAL '1 day' WHEN n % 7 = 1 THEN NOW() - INTERVAL '3 hours' ELSE NOW() + INTERVAL '24 hours' END,
  CASE WHEN n % 3 = 0 THEN 'a0000003-0000-4000-8000-000000000003'::uuid WHEN n % 3 = 1 THEN 'a0000004-0000-4000-8000-000000000004'::uuid ELSE NULL END,
  w.id,
  n % 15 = 0,
  CASE WHEN n % 15 = 0 THEN 'c0000001-0000-4000-8000-000000000001'::uuid ELSE NULL END,
  CASE WHEN n % 15 = 0 THEN 2 ELSE 0 END,
  n % 20 = 0,
  (n * 3) % 40,
  (n * 2) % 15,
  'AI classified civic issue in ' || w.name,
  NOW() - (n || ' days')::interval
FROM generate_series(11, 60) AS n
JOIN wards w ON w.id = 1 + (n % 8);

-- Dept performance sample
INSERT INTO dept_performance (dept, month, total_complaints, resolved, avg_resolution_hours, breach_count, citizen_reject_count, score)
SELECT dept, DATE_TRUNC('month', NOW())::date, 45 + (random()*20)::int, 30 + (random()*15)::int,
  24 + random()*48, (random()*5)::int, (random()*3)::int, 60 + random()*30
FROM unnest(ARRAY['Roads','Sanitation','HMWSSB','Drainage','Street Lighting']) AS dept
ON CONFLICT (dept, month) DO NOTHING;
