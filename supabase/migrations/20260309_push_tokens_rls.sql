-- Migration: Füge RLS Policies für push_token Updates hinzu

-- 1. Users Tabelle: Jeder Benutzer kann sein eigenes Profil (inkl. push_token) updaten
DO $$
BEGIN
  IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Users can update their own profile'
  ) THEN
      CREATE POLICY "Users can update their own profile" ON users
        FOR UPDATE USING (auth.uid() = id);
  END IF;
  
  IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Allow select for authenticated users'
  ) THEN
      CREATE POLICY "Allow select for authenticated users" ON users
        FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- 2. Customer Portal Users Tabelle: Jeder Portal-Benutzer kann sein eigenes Profil updaten
DO $$
BEGIN
  IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'customer_portal_users' AND policyname = 'Customers can update their own profile'
  ) THEN
      CREATE POLICY "Customers can update their own profile" ON customer_portal_users
        FOR UPDATE USING (auth.uid() = id);
  END IF;
END $$;
