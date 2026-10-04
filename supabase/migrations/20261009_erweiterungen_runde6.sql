-- Runde 6: Zahlungsziel pro Kunde, Ticket-Zusammenführen, Asset-Verknüpfung,
-- Abwesenheiten, Meine Woche, @-Erwähnungen, Dubletten, Kunden-Tags,
-- Geburtstage/Jubiläen, E-Mail-Kampagnen, Angebots-Öffnungen, KI-Angebotstexte
-- Im Supabase SQL Editor ausführen (eine Datei für alles)

-- ── Kunden: Zahlungsziel, Tags (Abmeldung nutzt bestehendes newsletter_opt_out) ──
ALTER TABLE customers ADD COLUMN IF NOT EXISTS payment_terms_days INT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- ── Kontakte: Geburtstag ──
ALTER TABLE customer_contacts ADD COLUMN IF NOT EXISTS birthday DATE;

-- ── Tickets: betroffenes Gerät/Lizenz aus dem Inventar ──
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS asset_id UUID REFERENCES customer_assets(id) ON DELETE SET NULL;

-- ── Abwesenheiten (Ferien/Krankheit) ──
CREATE TABLE IF NOT EXISTS user_absences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  type TEXT DEFAULT 'vacation', -- vacation | sick | other
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_absences_user ON user_absences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_absences_dates ON user_absences(start_date, end_date);

-- ── E-Mail-Kampagnen (Versandprotokoll) ──
CREATE TABLE IF NOT EXISTS email_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  recipient_count INT DEFAULT 0,
  recipients JSONB DEFAULT '[]', -- [{email, name}]
  sent_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── RLS für die neuen Tabellen ──
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['user_absences','email_campaigns'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = t AND policyname = t || '_all') THEN
      EXECUTE format('CREATE POLICY %I ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t || '_all', t);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = t AND policyname = t || '_service') THEN
      EXECUTE format('CREATE POLICY %I ON %I FOR ALL TO service_role USING (true) WITH CHECK (true)', t || '_service', t);
    END IF;
  END LOOP;
END $$;

-- Abmelde-Link: anon darf email_opt_out über die Edge Function setzen (Service-Role),
-- daher keine zusätzliche anon-Policy nötig.

NOTIFY pgrst, 'reload schema';
