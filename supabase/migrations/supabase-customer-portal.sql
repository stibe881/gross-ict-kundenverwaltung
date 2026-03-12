-- Kunden-Portal Erweiterungen für Gross ICT Kundenverwaltung

-- Kunden-Tabelle erweitern mit Portal-Zugriff
ALTER TABLE customers ADD COLUMN IF NOT EXISTS portal_enabled BOOLEAN DEFAULT false;

-- Kunden-Benutzer-Tabelle (für Portal-Zugriff)
CREATE TABLE IF NOT EXISTS customer_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'admin')),
  -- 'user' = sieht nur eigene Tickets
  -- 'admin' = sieht alle Tickets der Firma
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ticket-Kommentare erweitern mit intern/extern
ALTER TABLE ticket_comments ADD COLUMN IF NOT EXISTS is_internal BOOLEAN DEFAULT true;

-- Ticket-Ersteller-Referenz (welcher Kunden-Benutzer hat das Ticket erstellt)
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS created_by_customer_user_id UUID REFERENCES customer_users(id);

-- Indizes für Performance
CREATE INDEX IF NOT EXISTS idx_customer_users_customer ON customer_users(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_users_email ON customer_users(email);
CREATE INDEX IF NOT EXISTS idx_tickets_created_by_customer ON tickets(created_by_customer_user_id);

-- Row Level Security für customer_users
ALTER TABLE customer_users ENABLE ROW LEVEL SECURITY;

-- Policy: Mitarbeitende sehen alle Kunden-Benutzer
CREATE POLICY "Allow all for authenticated users" ON customer_users
  FOR ALL USING (auth.role() = 'authenticated');

-- Policy: Kunden-Benutzer sehen nur sich selbst und andere Benutzer ihrer Firma
CREATE POLICY "Customer users see own company" ON customer_users
  FOR SELECT USING (
    customer_id IN (
      SELECT customer_id FROM customer_users WHERE id = auth.uid()
    )
  );

-- Funktion zum Hashen von Passwörtern (Beispiel - in Produktion bcrypt/argon2 verwenden)
CREATE OR REPLACE FUNCTION hash_password(password TEXT)
RETURNS TEXT AS $$
BEGIN
  -- In Produktion: Verwenden Sie eine sichere Hash-Funktion wie bcrypt oder argon2
  -- Dies ist nur ein Platzhalter
  RETURN crypt(password, gen_salt('bf'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger zum automatischen Hashen von Passwörtern
CREATE OR REPLACE FUNCTION hash_customer_user_password()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.password_hash IS NOT NULL AND NEW.password_hash != OLD.password_hash THEN
    NEW.password_hash := hash_password(NEW.password_hash);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_hash_customer_user_password
  BEFORE INSERT OR UPDATE ON customer_users
  FOR EACH ROW
  EXECUTE FUNCTION hash_customer_user_password();

-- View für Ticket-Zugriff (vereinfacht Abfragen)
CREATE OR REPLACE VIEW customer_user_tickets AS
SELECT 
  t.*,
  cu.customer_id,
  cu.role as customer_user_role,
  cu.id as customer_user_id
FROM tickets t
LEFT JOIN customer_users cu ON t.created_by_customer_user_id = cu.id
WHERE 
  -- Kunden-Admin sieht alle Tickets seiner Firma
  (cu.role = 'admin' AND t.customer_id = cu.customer_id)
  OR
  -- Kunden-User sieht nur eigene Tickets
  (cu.role = 'user' AND t.created_by_customer_user_id = cu.id);

-- Kommentare: Externe Kommentare für Kunden sichtbar
CREATE OR REPLACE VIEW customer_visible_comments AS
SELECT 
  tc.*,
  t.customer_id
FROM ticket_comments tc
JOIN tickets t ON tc.ticket_id = t.id
WHERE tc.is_internal = false;
