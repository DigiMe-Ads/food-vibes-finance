
-- Allow admins to list all profiles (guard against duplicate)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'admin_select_all_profiles'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "admin_select_all_profiles"
        ON profiles FOR SELECT
        TO authenticated
        USING (get_user_role(auth.uid()) = 'admin')
    $policy$;
  END IF;
END $$;

-- RPC: admin creates a new user
CREATE OR REPLACE FUNCTION admin_create_user(
  p_email    text,
  p_password text,
  p_username text DEFAULT NULL,
  p_role     text DEFAULT 'user'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role text;
  v_user_id     uuid;
BEGIN
  SELECT get_user_role(auth.uid()) INTO v_caller_role;
  IF v_caller_role <> 'admin' THEN
    RAISE EXCEPTION 'Permission denied: admin role required';
  END IF;

  INSERT INTO auth.users (
    id, email, encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    created_at, updated_at,
    aud, role
  )
  VALUES (
    gen_random_uuid(),
    p_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    jsonb_build_object('username', COALESCE(p_username, split_part(p_email,'@',1))),
    now(), now(),
    'authenticated', 'authenticated'
  )
  RETURNING id INTO v_user_id;

  INSERT INTO profiles (id, email, username, role, created_at, updated_at)
  VALUES (
    v_user_id,
    p_email,
    COALESCE(p_username, split_part(p_email,'@',1)),
    p_role::user_role,
    now(), now()
  )
  ON CONFLICT (id) DO UPDATE
    SET role = p_role::user_role,
        username = COALESCE(p_username, split_part(p_email,'@',1)),
        updated_at = now();

  RETURN json_build_object('id', v_user_id, 'email', p_email, 'role', p_role);
END;
$$;

-- RPC: admin updates a user's role
CREATE OR REPLACE FUNCTION admin_update_user_role(p_user_id uuid, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF get_user_role(auth.uid()) <> 'admin' THEN
    RAISE EXCEPTION 'Permission denied: admin role required';
  END IF;
  UPDATE profiles SET role = p_role::user_role, updated_at = now() WHERE id = p_user_id;
END;
$$;

-- RPC: activity count for a user
CREATE OR REPLACE FUNCTION get_user_activity_count(p_user_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer FROM activity_logs WHERE user_id = p_user_id;
$$;
