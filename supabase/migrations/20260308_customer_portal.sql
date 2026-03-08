-- Migration: Kundenportal User
-- Dieses Script manuell im Supabase SQL Editor ausführen

-- 1. Spalte `has_portal` zur Tabelle `customers` hinzufügen
ALTER TABLE customers ADD COLUMN IF NOT EXISTS has_portal BOOLEAN DEFAULT FALSE;

-- 2. Tabelle für Portal-Benutzer erstellen
CREATE TABLE IF NOT EXISTS customer_portal_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  password_hash TEXT, -- Nur falls lokale PW Speicherung gewünscht ist (Besser: Supabase Auth User ID verlinken falls möglich)
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(customer_id, email)
);

CREATE INDEX IF NOT EXISTS idx_customer_portal_users_customer ON customer_portal_users(customer_id);

-- 3. RLS Policies
ALTER TABLE customer_portal_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" ON customer_portal_users
  FOR ALL USING (auth.role() = 'authenticated');
