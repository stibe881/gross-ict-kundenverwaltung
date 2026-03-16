-- Migration: Support Tickets Public Submission

-- 1. Add contact info columns so public visitors can leave details
ALTER TABLE tickets 
ADD COLUMN IF NOT EXISTS contact_name TEXT,
ADD COLUMN IF NOT EXISTS contact_email TEXT,
ADD COLUMN IF NOT EXISTS contact_company TEXT,
ADD COLUMN IF NOT EXISTS contact_phone TEXT;

-- 2. Allow customer_id to be NULL (should already be allowed by default)
ALTER TABLE tickets ALTER COLUMN customer_id DROP NOT NULL;

-- 3. Allow ANON inserts for tickets (so gross-ict.ch website can insert)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'tickets' AND policyname = 'Allow public insert for tickets'
  ) THEN
    CREATE POLICY "Allow public insert for tickets" ON tickets FOR INSERT TO anon WITH CHECK (true);
  END IF;
END
$$;

-- 4. Allow ANON inserts for leads (to ensure stability if service key was not used)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'leads' AND policyname = 'Allow public insert for leads'
  ) THEN
    CREATE POLICY "Allow public insert for leads" ON leads FOR INSERT TO anon WITH CHECK (true);
  END IF;
END
$$;
