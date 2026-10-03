-- Runde 4: Wiederkehrende Ausgaben, Zahlungspläne, Meilensteine, Aufgaben,
-- SLA, Lead-Aktionen, Portal-Ausbau, Inventar, Wartungsfenster, Log & Papierkorb
-- Im Supabase SQL Editor ausführen (eine Datei für alles)

-- ── Wiederkehrende Ausgaben ──
CREATE TABLE IF NOT EXISTS recurring_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  description TEXT NOT NULL,
  category TEXT,
  amount NUMERIC NOT NULL,
  tax_rate NUMERIC DEFAULT 0,
  interval TEXT NOT NULL DEFAULT 'monthly', -- monthly | yearly
  next_date DATE NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Teilzahlungen / Zahlungspläne ──
CREATE TABLE IF NOT EXISTS invoice_installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  due_date DATE NOT NULL,
  paid_at TIMESTAMPTZ,
  reminder_sent_at TIMESTAMPTZ,
  sort INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_installments_invoice ON invoice_installments(invoice_id);

-- ── Projekt-Meilensteine: Anteil für Teilrechnungen ──
ALTER TABLE project_milestones ADD COLUMN IF NOT EXISTS percent NUMERIC DEFAULT 0;

-- ── Geräte-/Lizenzliste pro Kunde ──
CREATE TABLE IF NOT EXISTS customer_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'device', -- device | license
  name TEXT NOT NULL,
  serial_number TEXT,
  expires_at DATE, -- Garantie- bzw. Lizenzablauf
  notes TEXT,
  expiry_warned_at DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customer_assets_customer ON customer_assets(customer_id);

-- ── Im Portal geteilte Dokumente ──
CREATE TABLE IF NOT EXISTS customer_document_shares (
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (customer_id, file_name)
);

-- ── Stammdaten-Änderungsanträge aus dem Portal ──
CREATE TABLE IF NOT EXISTS customer_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  requested_by TEXT,
  changes JSONB NOT NULL DEFAULT '{}',
  status TEXT DEFAULT 'pending', -- pending | approved | rejected
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_change_requests_status ON customer_change_requests(status);

-- ── Wartungsfenster ──
CREATE TABLE IF NOT EXISTS maintenance_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  customer_ids UUID[], -- NULL oder leer = alle Kunden
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Aktivitäts-Log ──
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  action TEXT NOT NULL, -- created | updated | deleted | restored
  description TEXT,
  user_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);

-- ── Papierkorb (30 Tage) ──
CREATE TABLE IF NOT EXISTS trash_bin (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL, -- customer | invoice | ticket
  entity_label TEXT,
  payload JSONB NOT NULL,
  deleted_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Neue Spalten auf bestehenden Tabellen ──
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS sla_response_hours INT;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS sla_warning_sent BOOLEAN DEFAULT false;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS followup_sent_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS rating TEXT; -- hot | warm | cold
ALTER TABLE leads ADD COLUMN IF NOT EXISTS next_action TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS next_action_date DATE;
ALTER TABLE ticket_items ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL;

-- ── RLS für alle neuen Tabellen ──
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'recurring_expenses','invoice_installments',
    'customer_assets','customer_document_shares','customer_change_requests',
    'maintenance_windows','audit_log','trash_bin'
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

-- ── Ticket über ID-Präfix finden (für E-Mail-Threading [TKT-xxxxxxxx]) ──
CREATE OR REPLACE FUNCTION find_ticket_by_prefix(prefix TEXT)
RETURNS TABLE(id UUID, title TEXT, status TEXT)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT t.id, t.title, t.status FROM tickets t WHERE t.id::text ILIKE prefix || '%' LIMIT 1;
$$;

NOTIFY pgrst, 'reload schema';
