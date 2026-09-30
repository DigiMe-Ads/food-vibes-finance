-- User management without the manage-user Edge Function.
-- Runs entirely in SQL (SECURITY DEFINER), so a self-hosted/personal project needs
-- no service-role key or function deployment. pgcrypto lives in the "extensions"
-- schema on Supabase, hence the fully-qualified extensions.crypt / gen_salt calls
-- (the unqualified calls are what broke the original admin_create_user).
--
-- raw_user_meta_data.must_change_password = true makes the app force the user to
-- pick a new password on their next login.

CREATE OR REPLACE FUNCTION public.admin_create_user(
  p_email    text,
  p_password text,
  p_username text DEFAULT NULL,
  p_role     text DEFAULT 'viewer'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id  uuid := gen_random_uuid();
  v_email    text := lower(trim(p_email));
  v_username text := COALESCE(NULLIF(trim(p_username), ''), split_part(lower(trim(p_email)), '@', 1));
BEGIN
  IF public.get_user_role(auth.uid()) IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Permission denied: admin role required';
  END IF;
  IF v_email IS NULL OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Please enter a valid email address.';
  END IF;
  IF length(COALESCE(p_password, '')) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters.';
  END IF;
  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = v_email) THEN
    RAISE EXCEPTION 'A user with this email already exists.';
  END IF;

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated', v_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('username', v_username, 'must_change_password', true),
    now(), now(), '', '', '', '', '', '', '', ''
  );

  INSERT INTO auth.identities (user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (
    v_user_id, v_user_id::text,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
    'email', now(), now(), now()
  );

  -- on_auth_user_created already inserted a default profile; apply the real values
  INSERT INTO public.profiles (id, email, username, role, created_at, updated_at)
  VALUES (v_user_id, v_email, v_username, p_role::public.user_role, now(), now())
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email, username = EXCLUDED.username, role = EXCLUDED.role, updated_at = now();

  RETURN json_build_object('id', v_user_id, 'email', v_email, 'role', p_role);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_user_password(p_user_id uuid, p_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF public.get_user_role(auth.uid()) IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Permission denied: admin role required';
  END IF;
  IF length(COALESCE(p_password, '')) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters.';
  END IF;

  UPDATE auth.users
  SET encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
      -- Resetting someone else's password: they must choose their own next login
      raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
                           || jsonb_build_object('must_change_password', p_user_id <> auth.uid()),
      updated_at = now()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_refs integer;
BEGIN
  IF public.get_user_role(auth.uid()) IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Permission denied: admin role required';
  END IF;
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot delete your own account.';
  END IF;

  -- Expenses, investments and logs reference the profile; never delete financial
  -- history along with a user.
  SELECT (SELECT count(*) FROM public.expenses WHERE created_by = p_user_id)
       + (SELECT count(*) FROM public.investments WHERE created_by = p_user_id)
       + (SELECT count(*) FROM public.activity_logs WHERE user_id = p_user_id)
  INTO v_refs;
  IF v_refs > 0 THEN
    RAISE EXCEPTION 'This user has % linked record(s) and cannot be deleted. Change their role to Viewer instead.', v_refs;
  END IF;

  DELETE FROM auth.users WHERE id = p_user_id;  -- cascades to profiles + identities
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_user(text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_user_password(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_delete_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_user(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_password(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;
