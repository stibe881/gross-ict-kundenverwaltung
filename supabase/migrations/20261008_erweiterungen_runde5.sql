-- Runde 5: Debitoren, Mahn-Center, EUR, Anzahlung, Gutschriften, Stripe-Gebühren,
-- Angebots-Versionen, Marge, Kundenpreise, Pipeline, Ticket-Vorlagen & -Automatik,
-- Projekt-Vorlagen & Nachkalkulation, Portal-Ausbau, Präsenz, Rollen, Onboarding, KI
-- Im Supabase SQL Editor ausführen (eine Datei für alles)

-- ── Rechnungen: Währung, Gutschriften ──
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'CHF';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_credit_note BOOLEAN DEFAULT false;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS credit_note_for UUID REFERENCES invoices(id) ON DELETE SET NULL;

-- ── Produkte: Einkaufspreis für Margen-Anzeige ──
ALTER TABLE products ADD COLUMN IF NOT EXISTS purchase_price NUMERIC;

-- ── Kunden: Standardrabatt ──
ALTER TABLE customers ADD COLUMN IF NOT EXISTS discount_percent NUMERIC DEFAULT 0;

-- ── Angebote: Versionen ──
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS parent_quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL;

-- ── Tickets: Eskalations-Kennzeichen ──
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS escalated BOOLEAN DEFAULT false;

-- ── Benutzer: Präsenz + Nur-Lesen-Rolle ──
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS read_only BOOLEAN DEFAULT false;

-- ── Wissensdatenbank: Sichtbarkeit (internal | public) ──
ALTER TABLE kb_articles ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'internal';

-- ── Ticket-Vorlagen ──
CREATE TABLE IF NOT EXISTS ticket_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  title TEXT,
  description TEXT,
  priority TEXT DEFAULT 'medium',
  checklist JSONB DEFAULT '[]',  -- ["Schritt 1", "Schritt 2", ...]
  items JSONB DEFAULT '[]',      -- Standard-Aufwände [{description, quantity, unit_price}]
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Wiederkehrende Tickets (Wartungsplan) ──
CREATE TABLE IF NOT EXISTS recurring_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'medium',
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  interval TEXT NOT NULL DEFAULT 'monthly', -- monthly | quarterly | yearly
  next_date DATE NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Projekt-Vorlagen ──
CREATE TABLE IF NOT EXISTS project_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tasks JSONB DEFAULT '[]',       -- [{title}]
  milestones JSONB DEFAULT '[]',  -- [{title, percent}]
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Kunden-Onboarding-Checkliste ──
CREATE TABLE IF NOT EXISTS customer_onboarding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  step TEXT NOT NULL,
  done BOOLEAN DEFAULT false,
  sort INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customer_onboarding_customer ON customer_onboarding(customer_id);

-- ── Ticket-Anhänge: Tabelle fehlte bisher komplett! ──
CREATE TABLE IF NOT EXISTS ticket_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ticket_attachments_ticket ON ticket_attachments(ticket_id);

-- Storage-Bucket für Ticket-Anhänge
INSERT INTO storage.buckets (id, name, public)
VALUES ('ticket_attachments', 'ticket_attachments', false)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "ticket_attachments_rw" ON storage.objects
    FOR ALL TO authenticated
    USING (bucket_id = 'ticket_attachments')
    WITH CHECK (bucket_id = 'ticket_attachments');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── RLS für die neuen Tabellen ──
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ticket_templates','recurring_tickets','project_templates',
    'customer_onboarding','ticket_attachments'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = t AND policyname = t || '_all') THEN
      EXECUTE format('CREATE POLICY %I ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t || '_all', t);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = t AND policyname = t || '_service') THEN
      EXECUTE format('CREATE POLICY %I ON %I FOR ALL TO service_role USING (true) WITH CHECK (true)', t || '_service', t);
    END IF;
  END LOOP;
END $$;

-- Öffentliche Hilfe-Seite: anon darf öffentliche KB-Artikel lesen
DO $$ BEGIN
  CREATE POLICY "kb_articles_public_read" ON kb_articles
    FOR SELECT TO anon
    USING (visibility = 'public' AND status = 'published');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

NOTIFY pgrst, 'reload schema';
