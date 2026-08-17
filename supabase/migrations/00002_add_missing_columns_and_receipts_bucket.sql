
-- Add is_default and currency columns to projects if not present
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'LKR';

-- Set the first project as default
UPDATE projects SET is_default = true WHERE id = (SELECT id FROM projects ORDER BY created_at LIMIT 1);

-- Add attachment columns to expenses if not present
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS attachment_url text,
  ADD COLUMN IF NOT EXISTS attachment_name text;

-- Add sort_order to categories if not present
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- Add email to profiles if not present
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email text;

-- Sync emails from auth.users into profiles
UPDATE profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id;

-- Add trigger to keep profiles.email in sync
CREATE OR REPLACE FUNCTION sync_profile_email()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE profiles SET email = NEW.email WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_updated ON auth.users;
CREATE TRIGGER on_auth_user_email_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION sync_profile_email();

-- Update sort_order for existing categories
UPDATE categories SET sort_order = sub.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) AS rn FROM categories
) sub
WHERE categories.id = sub.id;

-- Storage bucket for receipts (idempotent)
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for receipts bucket
DROP POLICY IF EXISTS "Authenticated users can upload receipts" ON storage.objects;
CREATE POLICY "Authenticated users can upload receipts"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'receipts');

DROP POLICY IF EXISTS "Authenticated users can read receipts" ON storage.objects;
CREATE POLICY "Authenticated users can read receipts"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'receipts');

DROP POLICY IF EXISTS "Authenticated users can update receipts" ON storage.objects;
CREATE POLICY "Authenticated users can update receipts"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'receipts');

DROP POLICY IF EXISTS "Public can read receipts" ON storage.objects;
CREATE POLICY "Public can read receipts"
ON storage.objects FOR SELECT TO anon
USING (bucket_id = 'receipts');
