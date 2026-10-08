-- Der Website-Build lädt die Referenzen mit dem öffentlichen anon-Schlüssel
-- (bisher mit dem geheimen service_role-Schlüssel aus der .env). Dafür dürfen
-- anonyme Besucher NUR aktive Referenzen lesen — Entwürfe und ausgeblendete
-- Einträge bleiben verborgen. Schreiben bleibt Mitarbeitern vorbehalten.
ALTER TABLE public.website_references ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "website_references_public_read" ON public.website_references;
CREATE POLICY "website_references_public_read" ON public.website_references
  FOR SELECT TO anon USING (active = true);
