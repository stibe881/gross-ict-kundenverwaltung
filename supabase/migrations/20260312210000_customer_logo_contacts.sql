-- Kunden-Logo: Spalte für die Logo-URL
ALTER TABLE customers ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Kunden-Kontakte: Separate Tabelle für mehrere Ansprechpartner pro Kunde
CREATE TABLE IF NOT EXISTS customer_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    phone TEXT,
    position TEXT,             -- z.B. "Geschäftsführer", "IT-Leiter"
    is_primary BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE customer_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON customer_contacts
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Storage bucket for customer logos (run manually if not exists)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('customer-logos', 'customer-logos', true)
-- ON CONFLICT (id) DO NOTHING;
