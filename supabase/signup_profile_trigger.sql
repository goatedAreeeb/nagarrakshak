-- Auto-create public.users row when someone registers (fixes RLS on client insert).
-- Run in Supabase SQL Editor after schema.sql.

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
