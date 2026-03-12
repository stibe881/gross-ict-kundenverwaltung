-- Test-Benutzer für Gross ICT Kundenverwaltung

-- 1. Admin-Benutzer
INSERT INTO users (id, name, email, role, is_active, created_at)
VALUES (
  'admin-test-001',
  'Admin Testuser',
  'admin@gross-ict.ch',
  'admin',
  true,
  NOW()
);

-- 2. Test-Firma (Kunde)
INSERT INTO customers (id, company, first_name, last_name, email, phone, address, city, postal_code, country, notes, created_at)
VALUES (
  'customer-test-001',
  'Muster AG',
  'Hans',
  'Muster',
  'hans.muster@muster-ag.ch',
  '+41 44 123 45 67',
  'Musterstrasse 123',
  'Zürich',
  '8000',
  'Schweiz',
  'Test-Firma für Portal-Zugang',
  NOW()
);

-- 3. Kunden-Portal-Benutzer für Muster AG (Administrator-Rolle)
INSERT INTO customer_portal_users (id, customer_id, email, password_hash, first_name, last_name, role, is_active, created_at)
VALUES (
  'portal-user-001',
  'customer-test-001',
  'portal@muster-ag.ch',
  '$2a$10$YourHashedPasswordHere', -- Passwort: portal123
  'Portal',
  'Administrator',
  'admin',
  true,
  NOW()
);

-- 4. Test-Ticket für Muster AG
INSERT INTO tickets (id, customer_id, title, description, status, priority, assigned_to, created_at)
VALUES (
  'ticket-test-001',
  'customer-test-001',
  'Test-Ticket: Frage zur Rechnung',
  'Dies ist ein Test-Ticket für das Kunden-Portal',
  'open',
  'medium',
  'admin-test-001',
  NOW()
);

-- 5. Externe Kommentare für Test-Ticket (für Kunden sichtbar)
INSERT INTO ticket_comments (id, ticket_id, user_id, comment, is_internal, created_at)
VALUES 
(
  'comment-001',
  'ticket-test-001',
  'admin-test-001',
  'Vielen Dank für Ihre Anfrage. Wir prüfen das und melden uns in Kürze.',
  false, -- Extern = für Kunden sichtbar
  NOW()
),
(
  'comment-002',
  'ticket-test-001',
  'admin-test-001',
  'Interne Notiz: Rechnung wurde bereits korrigiert und neu versendet.',
  true, -- Intern = nur für Mitarbeiter sichtbar
  NOW() + INTERVAL '1 hour'
);

-- Hinweis: Das Passwort für den Portal-Benutzer muss noch gehasht werden.
-- Verwenden Sie bcrypt mit dem Passwort "portal123" und ersetzen Sie den Hash oben.
