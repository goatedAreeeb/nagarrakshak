-- NagarRakshak Hyderabad — Database Schema

-- ENUMS
CREATE TYPE user_role AS ENUM (
  'citizen', 'worker', 'officer', 'supervisor', 'zonal', 'city'
);

CREATE TYPE complaint_status AS ENUM (
  'open', 'assigned', 'in_progress', 'resolved', 'closed', 'reopened'
);

CREATE TYPE vote_type AS ENUM ('upvote', 'same_issue');

CREATE TYPE notif_type AS ENUM (
  'complaint_assigned', 'sla_warning', 'sla_breach', 'escalation',
  'complaint_resolved', 'closure_rejected', 'duplicate_merged', 'new_message',
  'city_notice'
);

CREATE TYPE notice_type AS ENUM (
  'outbreak', 'emergency', 'health_campaign', 'event', 'advisory'
);

-- WARDS
CREATE TABLE wards (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  lat FLOAT NOT NULL,
  lng FLOAT NOT NULL,
  population INT DEFAULT 0,
  zone TEXT,
  open_issues INT DEFAULT 0,
  resolved_issues INT DEFAULT 0,
  health_score FLOAT DEFAULT 75.0,
  dominant_category TEXT DEFAULT 'Roads'
);

-- USERS
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'citizen',
  ward_id INT REFERENCES wards(id),
  dept TEXT,
  zone TEXT,
  credits INT DEFAULT 0,
  trust_score FLOAT DEFAULT 1.0,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- COMPLAINTS
CREATE TABLE complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  citizen_id UUID REFERENCES users(id) ON DELETE SET NULL,
  image_url TEXT,
  lat FLOAT NOT NULL,
  lng FLOAT NOT NULL,
  address TEXT,
  description TEXT,
  voice_note_url TEXT,
  dept TEXT NOT NULL,
  division TEXT,
  severity INT CHECK (severity BETWEEN 1 AND 5) DEFAULT 3,
  status complaint_status DEFAULT 'open',
  sla_hours INT NOT NULL DEFAULT 48,
  sla_deadline TIMESTAMPTZ,
  assigned_to UUID REFERENCES users(id),
  ward_id INT REFERENCES wards(id),
  is_duplicate BOOLEAN DEFAULT FALSE,
  master_complaint_id UUID REFERENCES complaints(id),
  duplicate_count INT DEFAULT 0,
  is_chronic BOOLEAN DEFAULT FALSE,
  chronic_count INT DEFAULT 0,
  upvote_count INT DEFAULT 0,
  same_issue_count INT DEFAULT 0,
  closure_image_url TEXT,
  citizen_verified BOOLEAN,
  ai_reasoning TEXT,
  safety_sensitive BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- ESCALATIONS
CREATE TABLE escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID REFERENCES complaints(id) ON DELETE CASCADE,
  from_role user_role NOT NULL,
  to_role user_role NOT NULL,
  reason TEXT,
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  resolved BOOLEAN DEFAULT FALSE
);

-- SOCIAL VOTES
CREATE TABLE social_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID REFERENCES complaints(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  vote_type vote_type NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(complaint_id, user_id, vote_type)
);

-- IN-APP NOTIFICATIONS
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type notif_type NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  complaint_id UUID REFERENCES complaints(id) ON DELETE SET NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- MESSAGES
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID REFERENCES complaints(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CITY BULLETIN / OUTBREAK NOTICES (visible to all roles)
CREATE TABLE city_notices (
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

-- DEPT PERFORMANCE
CREATE TABLE dept_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dept TEXT NOT NULL,
  month DATE NOT NULL,
  total_complaints INT DEFAULT 0,
  resolved INT DEFAULT 0,
  avg_resolution_hours FLOAT DEFAULT 0,
  breach_count INT DEFAULT 0,
  citizen_reject_count INT DEFAULT 0,
  score FLOAT DEFAULT 0,
  UNIQUE(dept, month)
);

-- RLS
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE wards ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE city_notices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public complaints readable" ON complaints FOR SELECT USING (true);
CREATE POLICY "Citizens insert own" ON complaints FOR INSERT
  WITH CHECK (auth.uid() = citizen_id);
CREATE POLICY "Citizens update own" ON complaints FOR UPDATE
  USING (auth.uid() = citizen_id OR EXISTS (
    SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('worker','officer','supervisor','zonal','city')
  ));
CREATE POLICY "Workers update assigned" ON complaints FOR UPDATE
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid()));

CREATE POLICY "Users readable" ON users FOR SELECT USING (true);
CREATE POLICY "Users insert own" ON users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users update own" ON users FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Own notifications select" ON notifications FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Own notifications update" ON notifications FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "Notifications insert" ON notifications FOR INSERT WITH CHECK (true);

CREATE POLICY "Complaint messages readable" ON messages FOR SELECT USING (true);
CREATE POLICY "Messages insert" ON messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Wards readable" ON wards FOR SELECT USING (true);
CREATE POLICY "Wards update staff" ON wards FOR UPDATE USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('supervisor','zonal','city'))
);

CREATE POLICY "Votes readable" ON social_votes FOR SELECT USING (true);
CREATE POLICY "Votes insert own" ON social_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Votes delete own" ON social_votes FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Escalations readable" ON escalations FOR SELECT USING (true);
CREATE POLICY "Escalations insert staff" ON escalations FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('officer','supervisor','zonal','city','worker'))
);
CREATE POLICY "Escalations update staff" ON escalations FOR UPDATE USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('supervisor','zonal','city'))
);

CREATE POLICY "City notices readable" ON city_notices FOR SELECT USING (true);
CREATE POLICY "City notices insert city head" ON city_notices FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'city')
);
CREATE POLICY "City notices update city head" ON city_notices FOR UPDATE USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'city')
);
CREATE POLICY "City notices delete city" ON city_notices FOR DELETE USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'city')
);

-- Storage bucket (run in Supabase SQL editor)
INSERT INTO storage.buckets (id, name, public) VALUES ('complaint-images', 'complaint-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read complaint images" ON storage.objects FOR SELECT USING (bucket_id = 'complaint-images');
CREATE POLICY "Auth upload complaint images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'complaint-images' AND auth.role() = 'authenticated');
CREATE POLICY "Auth update complaint images" ON storage.objects FOR UPDATE USING (bucket_id = 'complaint-images' AND auth.role() = 'authenticated');

-- UPDATED_AT trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER complaints_updated_at
  BEFORE UPDATE ON complaints
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE complaints;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE city_notices;

CREATE TRIGGER city_notices_updated_at
  BEFORE UPDATE ON city_notices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create public.users on auth signup (avoids RLS errors when email confirm is on)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ward_val INT;
BEGIN
  ward_val := NULL;
  IF COALESCE(NEW.raw_user_meta_data->>'ward_id', '') ~ '^[0-9]+$' THEN
    ward_val := (NEW.raw_user_meta_data->>'ward_id')::INT;
  END IF;

  INSERT INTO public.users (id, email, name, role, ward_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'name'), ''), split_part(COALESCE(NEW.email, 'user'), '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'citizen'::user_role),
    ward_val
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(NULLIF(EXCLUDED.name, ''), users.name),
    ward_id = COALESCE(EXCLUDED.ward_id, users.ward_id);

  RETURN NEW;
EXCEPTION
  WHEN invalid_text_representation THEN
    INSERT INTO public.users (id, email, name, role, ward_id)
    VALUES (
      NEW.id,
      COALESCE(NEW.email, ''),
      COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'name'), ''), split_part(COALESCE(NEW.email, 'user'), '@', 1)),
      'citizen',
      NULL
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
