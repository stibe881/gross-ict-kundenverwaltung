-- Angebots-Vorlagen: wiederverwendbare Positionssätze für neue Angebote
-- Im Supabase SQL Editor ausführen
CREATE TABLE IF NOT EXISTS quote_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  notes TEXT,
  special_discount NUMERIC DEFAULT 0,
  special_discount_type TEXT DEFAULT 'amount',
  items JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE quote_templates ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'quote_templates' AND policyname = 'quote_templates_all') THEN
    CREATE POLICY "quote_templates_all" ON quote_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'quote_templates' AND policyname = 'quote_templates_service') THEN
    CREATE POLICY "quote_templates_service" ON quote_templates FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
