-- Runde 7: Kontaktformular-Leads, Review-Mails, Anruf-Modus, Cross-Selling,
-- ABC/Inaktivität/Jahresgespräch, Willkommenspaket, Posteingang, Einsatzplan,
-- Checklisten, Cmd+K, Duplizieren, Forecast
-- Im Supabase SQL Editor ausführen

-- ── Protokoll der Bewertungs-Anfragen (Google-Review-Mails) ──
CREATE TABLE IF NOT EXISTS review_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  ticket_id UUID,
  sent_to TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_review_requests_customer ON review_requests(customer_id, created_at);

DO $$
BEGIN
  EXECUTE 'ALTER TABLE review_requests ENABLE ROW LEVEL SECURITY';
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'review_requests' AND policyname = 'review_requests_all') THEN
    CREATE POLICY review_requests_all ON review_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'review_requests' AND policyname = 'review_requests_service') THEN
    CREATE POLICY review_requests_service ON review_requests FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
