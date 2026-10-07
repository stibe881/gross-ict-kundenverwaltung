-- users enger absichern (baut auf 20261023_rls_absichern.sql auf).
--
-- Vorher durften alle angemeldeten Benutzer — auch Portal-Kunden — alle
-- Mitarbeiterprofile inkl. IBAN, Adresse und Rollen lesen, und jeder durfte
-- seine eigene Rollenliste ändern. Neu:
--   * Profile lesen: nur Mitarbeiter (plus die eigene Zeile bzw. die Zeile
--     mit der eigenen E-Mail, damit der SSO-Login-Sync weiter funktioniert)
--   * Schreiben: nur die eigene Zeile oder Admin; Rollen ändert nur Admin
--   * IBAN: aus users in user_bank verschoben — sichtbar nur für den
--     Besitzer selbst, Admin und Rolle «finanzen»
--   * Portal-Kunden erhalten die Ansprechpartner-Karte über eine
--     Funktion, nicht mehr über direkten Tabellenzugriff

-- ── Hilfsfunktionen in nicht exponiertem Schema ──────────────────────────
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.is_portal_user() RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.customer_portal_users WHERE id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION private.is_employee() RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT private.is_portal_user()
     AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION private.has_role(r text) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND roles @> ARRAY[r])
$$;

REVOKE ALL ON FUNCTION private.is_portal_user(), private.is_employee(), private.has_role(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_portal_user(), private.is_employee(), private.has_role(text) TO authenticated;

-- ── IBAN in eigene Tabelle ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_bank (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  iban text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.user_bank (user_id, iban)
  SELECT id, iban FROM public.users WHERE iban IS NOT NULL AND iban <> ''
  ON CONFLICT (user_id) DO NOTHING;

ALTER TABLE public.user_bank ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_bank_select" ON public.user_bank;
DROP POLICY IF EXISTS "user_bank_insert" ON public.user_bank;
DROP POLICY IF EXISTS "user_bank_update" ON public.user_bank;
DROP POLICY IF EXISTS "user_bank_delete" ON public.user_bank;
CREATE POLICY "user_bank_select" ON public.user_bank FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_role('admin') OR private.has_role('finanzen'));
CREATE POLICY "user_bank_insert" ON public.user_bank FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR private.has_role('admin'));
CREATE POLICY "user_bank_update" ON public.user_bank FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR private.has_role('admin'))
  WITH CHECK (user_id = auth.uid() OR private.has_role('admin'));
CREATE POLICY "user_bank_delete" ON public.user_bank FOR DELETE TO authenticated
  USING (private.has_role('admin'));

-- Kopie ist gesichert; die offene Spalte in users leeren.
UPDATE public.users SET iban = NULL WHERE iban IS NOT NULL;

-- ── Rollen schützen: nur Admin darf Rollen ändern ────────────────────────
CREATE OR REPLACE FUNCTION private.protect_user_roles() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Service-Role (auth.uid() ist NULL) und Admins dürfen alles
  IF auth.uid() IS NOT NULL AND NOT private.has_role('admin') THEN
    NEW.roles := OLD.roles;
    NEW.role := OLD.role;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS protect_user_roles ON public.users;
CREATE TRIGGER protect_user_roles BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION private.protect_user_roles();

-- ── users-Policies neu ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow anon access" ON public.users;
DROP POLICY IF EXISTS "Allow select for authenticated users" ON public.users;
DROP POLICY IF EXISTS "Users can insert" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update their own push token" ON public.users;
DROP POLICY IF EXISTS "Users can update users" ON public.users;
DROP POLICY IF EXISTS "Users can view all users" ON public.users;
DROP POLICY IF EXISTS "users_select" ON public.users;
DROP POLICY IF EXISTS "users_insert" ON public.users;
DROP POLICY IF EXISTS "users_update" ON public.users;
DROP POLICY IF EXISTS "users_delete" ON public.users;

-- Die E-Mail-Bedingung hält den SSO-Login-Sync lauffähig: Er sucht ein
-- bestehendes Profil per E-Mail und hängt es auf die neue Auth-ID um.
CREATE POLICY "users_select" ON public.users FOR SELECT TO authenticated
  USING (
    private.is_employee()
    OR id = auth.uid()
    OR lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
CREATE POLICY "users_insert" ON public.users FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() OR private.has_role('admin'));
CREATE POLICY "users_update" ON public.users FOR UPDATE TO authenticated
  USING (
    id = auth.uid()
    OR private.has_role('admin')
    OR lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
  WITH CHECK (
    id = auth.uid()
    OR private.has_role('admin')
    OR lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
CREATE POLICY "users_delete" ON public.users FOR DELETE TO authenticated
  USING (private.has_role('admin'));

-- ── Portal: Ansprechpartner-Karte ohne Tabellenzugriff ───────────────────
CREATE OR REPLACE FUNCTION public.get_portal_contact_card() RETURNS jsonb
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT business_card FROM public.users WHERE business_card IS NOT NULL LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.get_portal_contact_card() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_portal_contact_card() TO authenticated;
