-- Pre-registration table for SolTower launch
-- Stores wallets that pre-registered for rewards

CREATE TABLE IF NOT EXISTS public.pre_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Allow public insert for pre-registration flow (anon key)
GRANT SELECT, INSERT ON public.pre_registrations TO anon, authenticated;

-- Enable RLS (optional, can be relaxed for pre-reg)
ALTER TABLE public.pre_registrations ENABLE ROW LEVEL SECURITY;

-- Public can insert their own wallet
CREATE POLICY "pre_registrations_insert" ON public.pre_registrations
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Public can read their own or all (for admin later)
CREATE POLICY "pre_registrations_select" ON public.pre_registrations
  FOR SELECT TO anon, authenticated
  USING (true);

COMMENT ON TABLE public.pre_registrations IS 'Pre-registration wallets for SolTower launch rewards (rare weapons, armors, costumes, 100 gold)';