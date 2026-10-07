-- Supabase-Linter-Befunde beheben: RLS war auf vier öffentlichen Tabellen
-- ausgeschaltet — bei users existierten zwar Policies, sie wirkten aber
-- nicht, und die Tabelle (inkl. IBAN) war über die anon-API offen.
--
-- Die CRM-App und das Kundenportal greifen auf diese Tabellen nur
-- angemeldet zu; die Edge Functions nutzen den Service-Role-Schlüssel
-- und sind von RLS nicht betroffen.

-- users: RLS einschalten, damit die bestehenden Policies greifen,
-- und den anonymen Vollzugriff entfernen (sensible Daten wie IBAN).
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon access" ON public.users;

-- lead_items / quotes / quote_items: RLS einschalten, Zugriff nur noch
-- für angemeldete Benutzer (wie von der CRM-App verwendet).
ALTER TABLE public.lead_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lead_items_authenticated_all" ON public.lead_items;
CREATE POLICY "lead_items_authenticated_all" ON public.lead_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "quotes_authenticated_all" ON public.quotes;
CREATE POLICY "quotes_authenticated_all" ON public.quotes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "quote_items_authenticated_all" ON public.quote_items;
CREATE POLICY "quote_items_authenticated_all" ON public.quote_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
