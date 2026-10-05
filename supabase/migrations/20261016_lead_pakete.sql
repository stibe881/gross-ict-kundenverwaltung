-- Potenzial-Pakete: vordefinierte Produktbündel fürs Lead-Potenzial
-- (z.B. "Webseite Unternehmen" = Domain + Webseite + Hosting + SEO-Modul)
CREATE TABLE IF NOT EXISTS lead_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    items JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE lead_packages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lead_packages_rw" ON lead_packages;
CREATE POLICY "lead_packages_rw" ON lead_packages
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
