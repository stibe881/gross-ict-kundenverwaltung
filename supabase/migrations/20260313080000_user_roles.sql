-- Rollen-System: Mehrere Rollen pro Benutzer
-- Rollen: admin, administration, akquise, finanzen, technik, projekte

-- Alte CHECK-Constraint auf role entfernen (blockiert neue Rollen-Werte)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- Spalte roles als text-Array in der users-Tabelle
ALTER TABLE users ADD COLUMN IF NOT EXISTS roles TEXT[] DEFAULT '{}';

-- Provider-Spalte für SSO/Lokal-Erkennung
ALTER TABLE users ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'local';

-- Bestehende role-Einträge migrieren (falls vorhanden)
UPDATE users SET roles = ARRAY[role] WHERE role IS NOT NULL AND (roles IS NULL OR roles = '{}');

-- RLS deaktivieren für users-Tabelle (konsistent mit customers, tickets, etc.)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
