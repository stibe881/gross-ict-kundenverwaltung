-- Partner-Logos auf gross-ict.ch: Die Website liest marketing_settings anonym
-- (Build und Browser). RLS gibt dafür NUR den Eintrag website_partners frei;
-- alle anderen Marketing-Einstellungen bleiben geschützt.
DO $$ BEGIN
  CREATE POLICY "website_partners_public_read" ON marketing_settings
    FOR SELECT TO anon
    USING (key = 'website_partners');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

NOTIFY pgrst, 'reload schema';
