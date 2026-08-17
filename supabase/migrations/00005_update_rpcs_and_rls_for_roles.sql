
-- Drop the broken admin_create_user RPC (used pgcrypto gen_salt)
DROP FUNCTION IF EXISTS public.admin_create_user(text, text, text, text);

-- Update admin_update_user_role to accept all 4 roles (enum cast handles validation)
CREATE OR REPLACE FUNCTION public.admin_update_user_role(p_user_id uuid, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role text;
BEGIN
  SELECT get_user_role(auth.uid()) INTO v_caller_role;
  IF v_caller_role <> 'admin' THEN
    RAISE EXCEPTION 'Permission denied: admin role required';
  END IF;
  UPDATE profiles
  SET role = p_role::user_role, updated_at = now()
  WHERE id = p_user_id;
END;
$$;

-- Expenses RLS: role-aware policies
DROP POLICY IF EXISTS "authenticated_select_expenses" ON expenses;
CREATE POLICY "authenticated_select_expenses" ON expenses
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_insert_expenses" ON expenses;
CREATE POLICY "authenticated_insert_expenses" ON expenses
  FOR INSERT TO authenticated
  WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'accounts'));

DROP POLICY IF EXISTS "authenticated_update_expenses" ON expenses;
CREATE POLICY "authenticated_update_expenses" ON expenses
  FOR UPDATE TO authenticated
  USING (get_user_role(auth.uid()) IN ('admin', 'accounts'))
  WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'accounts'));

DROP POLICY IF EXISTS "authenticated_delete_expenses" ON expenses;
CREATE POLICY "authenticated_delete_expenses" ON expenses
  FOR DELETE TO authenticated
  USING (get_user_role(auth.uid()) = 'admin');

-- Investments RLS: role-aware policies
DROP POLICY IF EXISTS "authenticated_select_investments" ON investments;
CREATE POLICY "authenticated_select_investments" ON investments
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_insert_investments" ON investments;
CREATE POLICY "authenticated_insert_investments" ON investments
  FOR INSERT TO authenticated
  WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'accounts'));

DROP POLICY IF EXISTS "authenticated_update_investments" ON investments;
CREATE POLICY "authenticated_update_investments" ON investments
  FOR UPDATE TO authenticated
  USING (get_user_role(auth.uid()) IN ('admin', 'accounts'))
  WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'accounts'));

DROP POLICY IF EXISTS "authenticated_delete_investments" ON investments;
CREATE POLICY "authenticated_delete_investments" ON investments
  FOR DELETE TO authenticated
  USING (get_user_role(auth.uid()) = 'admin');
