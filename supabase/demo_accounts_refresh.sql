-- Refresh demo display names & civic credits after changing seed users.
-- Safe to run on existing DBs. Auth passwords must be reset via scripts/seed-demo-users.mjs
-- (Admin API) — this file only updates public.users.

UPDATE public.users
SET name = 'Harshit Divekar', credits = 360
WHERE email = 'citizen1@demo.com';

UPDATE public.users SET credits = 195 WHERE email = 'citizen2@demo.com';

-- New citizens (only if rows exist — created by seed-demo-users.mjs)
UPDATE public.users SET name = 'Anirudh Pratap Singh', credits = 340, ward_id = 2, role = 'citizen'
WHERE email = 'citizen3@demo.com';

UPDATE public.users SET name = 'Parth Yadav', credits = 310, ward_id = 4, role = 'citizen'
WHERE email = 'citizen4@demo.com';

UPDATE public.users SET name = 'Kavya Reddy', credits = 275, ward_id = 5, role = 'citizen'
WHERE email = 'citizen5@demo.com';

UPDATE public.users SET name = 'Rohan Verma', credits = 250, ward_id = 6, role = 'citizen'
WHERE email = 'citizen6@demo.com';
