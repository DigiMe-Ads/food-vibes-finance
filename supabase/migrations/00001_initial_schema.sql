
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum types
CREATE TYPE public.user_role AS ENUM ('user', 'admin');
CREATE TYPE public.project_status AS ENUM ('Planning', 'Construction', 'Fit-Out', 'Pre-Opening', 'Completed', 'On Hold');
CREATE TYPE public.investment_type AS ENUM ('Initial Investment', 'Additional Investment', 'Owner Injection', 'Partner Investment', 'Loan / Borrowed Funds', 'Other Funding');
CREATE TYPE public.payment_method AS ENUM ('Cash', 'Bank Transfer', 'Credit Card', 'Debit Card', 'Cheque', 'Other');
CREATE TYPE public.investment_payment_method AS ENUM ('Cash', 'Bank Transfer', 'Cheque', 'Other');

-- Profiles table (synced with auth.users)
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  phone text,
  username text,
  role public.user_role NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Projects table
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  description text,
  start_date date,
  expected_completion_date date,
  status public.project_status NOT NULL DEFAULT 'Planning',
  notes text,
  is_default boolean NOT NULL DEFAULT false,
  currency text NOT NULL DEFAULT 'LKR',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Categories table
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Investments table
CREATE TABLE public.investments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  date date NOT NULL,
  investment_type public.investment_type NOT NULL,
  source text,
  description text,
  amount numeric(15, 2) NOT NULL CHECK (amount > 0),
  payment_method public.investment_payment_method NOT NULL DEFAULT 'Cash',
  reference text,
  notes text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Expenses table
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  date date NOT NULL,
  description text NOT NULL,
  category_id uuid REFERENCES public.categories(id),
  supplier text,
  amount numeric(15, 2) NOT NULL CHECK (amount > 0),
  payment_method public.payment_method NOT NULL DEFAULT 'Cash',
  reference text,
  notes text,
  attachment_url text,
  attachment_name text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Activity logs table
CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES public.profiles(id),
  action text NOT NULL,
  record_type text NOT NULL,
  record_id uuid,
  previous_value jsonb,
  new_value jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_investments_project_id ON public.investments(project_id);
CREATE INDEX idx_investments_date ON public.investments(date DESC);
CREATE INDEX idx_investments_type ON public.investments(investment_type);
CREATE INDEX idx_expenses_project_id ON public.expenses(project_id);
CREATE INDEX idx_expenses_date ON public.expenses(date DESC);
CREATE INDEX idx_expenses_category_id ON public.expenses(category_id);
CREATE INDEX idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at DESC);

-- Trigger: sync new auth users to profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, phone, role)
  VALUES (NEW.id, NEW.email, NEW.phone, 'user'::public.user_role);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Helper: get user role (SECURITY DEFINER to prevent policy recursion)
CREATE OR REPLACE FUNCTION public.get_user_role(uid uuid)
RETURNS public.user_role
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = uid;
$$;

-- Helper: get default project id
CREATE OR REPLACE FUNCTION public.get_default_project_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.projects WHERE is_default = true LIMIT 1;
$$;

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies: profiles
CREATE POLICY "Admins have full access to profiles" ON public.profiles
  FOR ALL TO authenticated USING (public.get_user_role(auth.uid()) = 'admin'::public.user_role);

CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id)
  WITH CHECK (role IS NOT DISTINCT FROM public.get_user_role(auth.uid()));

-- RLS Policies: projects (authenticated users can read, admins can write)
CREATE POLICY "Authenticated users can view projects" ON public.projects
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert projects" ON public.projects
  FOR INSERT TO authenticated WITH CHECK (public.get_user_role(auth.uid()) = 'admin'::public.user_role);

CREATE POLICY "Admins can update projects" ON public.projects
  FOR UPDATE TO authenticated USING (public.get_user_role(auth.uid()) = 'admin'::public.user_role);

CREATE POLICY "Admins can delete projects" ON public.projects
  FOR DELETE TO authenticated USING (public.get_user_role(auth.uid()) = 'admin'::public.user_role);

-- RLS Policies: categories
CREATE POLICY "Authenticated users can view categories" ON public.categories
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert categories" ON public.categories
  FOR INSERT TO authenticated WITH CHECK (public.get_user_role(auth.uid()) = 'admin'::public.user_role);

CREATE POLICY "Admins can update categories" ON public.categories
  FOR UPDATE TO authenticated USING (public.get_user_role(auth.uid()) = 'admin'::public.user_role);

CREATE POLICY "Admins can delete categories" ON public.categories
  FOR DELETE TO authenticated USING (public.get_user_role(auth.uid()) = 'admin'::public.user_role);

-- RLS Policies: investments
CREATE POLICY "Authenticated users can view investments" ON public.investments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert investments" ON public.investments
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update investments" ON public.investments
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Admins can delete investments" ON public.investments
  FOR DELETE TO authenticated USING (public.get_user_role(auth.uid()) = 'admin'::public.user_role);

-- RLS Policies: expenses
CREATE POLICY "Authenticated users can view expenses" ON public.expenses
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert expenses" ON public.expenses
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update expenses" ON public.expenses
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Admins can delete expenses" ON public.expenses
  FOR DELETE TO authenticated USING (public.get_user_role(auth.uid()) = 'admin'::public.user_role);

-- RLS Policies: activity_logs
CREATE POLICY "Authenticated users can view logs" ON public.activity_logs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert logs" ON public.activity_logs
  FOR INSERT TO authenticated WITH CHECK (true);

-- Public view for profiles
CREATE VIEW public.public_profiles AS
  SELECT id, role, username FROM public.profiles;

-- Seed: Default project
INSERT INTO public.projects (id, name, description, start_date, expected_completion_date, status, notes, is_default)
VALUES (
  uuid_generate_v4(),
  'Restaurant Project 01',
  'New restaurant construction, setup and pre-opening project',
  '2026-08-01',
  '2026-11-30',
  'Construction',
  'Primary restaurant project tracking all construction and setup expenses.',
  true
);

-- Seed: Default categories
INSERT INTO public.categories (name, description, sort_order) VALUES
  ('Construction Materials', 'Cement, steel, bricks, sand, aggregate and other raw construction materials', 1),
  ('Labour', 'Worker wages, contractor payments and daily labour costs', 2),
  ('Electrical', 'Wiring, switchboards, lighting, power points and electrical installations', 3),
  ('Plumbing', 'Pipes, fittings, drainage, water supply and sanitary installations', 4),
  ('Carpentry', 'Woodwork, cabinetry, doors, windows and timber structures', 5),
  ('Painting', 'Interior and exterior paint, primer, brushes and painting services', 6),
  ('Flooring', 'Tiles, vinyl, wood flooring and installation', 7),
  ('Furniture', 'Tables, chairs, bar stools, booths and restaurant furniture', 8),
  ('Kitchen Equipment', 'Ovens, refrigerators, fryers, exhaust systems and commercial kitchen appliances', 9),
  ('General Equipment', 'Tools, machinery and general purpose equipment', 10),
  ('Interior / Décor', 'Wall art, decorative items, lighting fixtures and interior design elements', 11),
  ('Signage', 'Exterior signs, menu boards, wayfinding and branding displays', 12),
  ('Rent / Deposit', 'Security deposit, advance rent and lease payments', 13),
  ('Professional Fees', 'Architect, engineer, interior designer and consultant fees', 14),
  ('Permits & Licences', 'Building permits, health licences, liquor licences and municipal approvals', 15),
  ('Transport', 'Delivery charges, vehicle hire and material transportation costs', 16),
  ('Cleaning', 'Cleaning supplies, post-construction cleaning and waste disposal', 17),
  ('Marketing / Branding', 'Logo design, branding, menus, photography and pre-opening marketing', 18),
  ('Technology / POS', 'POS system, hardware, software licences and IT infrastructure', 19),
  ('Utilities', 'Electricity, water, internet connection and utility deposits', 20),
  ('Miscellaneous', 'Any other project-related expenses not covered by other categories', 21);
