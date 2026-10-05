-- Kontaktvermerke ("Kontakt festhalten"): manueller Kundenkontakt per
-- Telefon/WhatsApp/E-Mail/vor Ort. Zählt als Aktivität für die
-- Inaktivitäts-Erinnerung und erscheint in der Kunden-Timeline.
CREATE TABLE IF NOT EXISTS customer_touchpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    channel TEXT DEFAULT 'other',
    note TEXT,
    touched_at DATE NOT NULL DEFAULT CURRENT_DATE,
    user_name TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE customer_touchpoints ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "customer_touchpoints_rw" ON customer_touchpoints;
CREATE POLICY "customer_touchpoints_rw" ON customer_touchpoints
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
