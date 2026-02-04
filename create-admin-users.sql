-- Admin-Benutzer für Gross ICT Kundenverwaltung
-- Direkt in Supabase SQL-Editor ausführen

-- Aktiviere pgcrypto Extension für Passwort-Hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Stefan Gross (Admin)
INSERT INTO users (id, name, email, role, is_active, created_at)
VALUES (
  gen_random_uuid(),
  'Stefan Gross',
  'stefan.gross@gross-ict.ch',
  'admin',
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE 
SET name = EXCLUDED.name,
    role = EXCLUDED.role,
    is_active = EXCLUDED.is_active;

-- 2. Joel Hediger (Admin)
INSERT INTO users (id, name, email, role, is_active, created_at)
VALUES (
  gen_random_uuid(),
  'Joel Hediger',
  'joel.hediger@gross-ict.ch',
  'admin',
  true,
  NOW()
)
ON CONFLICT (email) DO UPDATE 
SET name = EXCLUDED.name,
    role = EXCLUDED.role,
    is_active = EXCLUDED.is_active;

-- Hinweis: Die Passwörter werden über OAuth/SSO verwaltet
-- Falls Sie lokale Passwörter benötigen, müssen Sie eine password_hash-Spalte zur users-Tabelle hinzufügen:
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Dann können Sie Passwörter mit bcrypt hashen:
-- UPDATE users SET password_hash = crypt('!LeliBist.1561!', gen_salt('bf', 10)) WHERE email = 'stefan.gross@gross-ict.ch';
-- UPDATE users SET password_hash = crypt('Lümmel.620!', gen_salt('bf', 10)) WHERE email = 'joel.hediger@gross-ict.ch';

-- Überprüfung:
SELECT id, name, email, role, is_active, created_at 
FROM users 
WHERE email IN ('stefan.gross@gross-ict.ch', 'joel.hediger@gross-ict.ch')
ORDER BY email;
