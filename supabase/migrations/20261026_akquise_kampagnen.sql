-- Akquise-Kampagnen mit geprüfter Prospect-Queue (Roadmap Stufe 1).
-- Firmen werden zuerst als PROSPECT recherchiert, geprüft und erst nach
-- Freigabe als regulärer Lead ins CRM übernommen. Die Compliance-Regeln
-- (Sperrliste, Freigabe nur nach Prüfung) gelten in der Datenbank und lassen
-- sich aus der App nicht umgehen.
--
-- Zugriff: nur Mitarbeitende mit Rolle admin, administration oder akquise.
-- Portal-Kunden haben keinen Zugriff.

CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.akquise_berechtigt() RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
           SELECT 1 FROM public.users u
           WHERE u.id = auth.uid()
             AND COALESCE(u.is_active, true)
             AND u.roles && ARRAY['admin', 'administration', 'akquise']
         )
     AND NOT EXISTS (SELECT 1 FROM public.customer_portal_users p WHERE p.id = auth.uid())
$$;
REVOKE ALL ON FUNCTION private.akquise_berechtigt() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.akquise_berechtigt() TO authenticated;

-- ── Kampagnen ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.acquisition_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'aktiv' CHECK (status IN ('entwurf', 'aktiv', 'pausiert', 'abgeschlossen')),
  kantone text[] NOT NULL DEFAULT '{}',
  plz_liste text,
  radius_km integer,
  branchen text[] NOT NULL DEFAULT '{}',
  angebotsprofil text,
  call_ziel text,
  ausschluesse text,
  owner_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── Prospects (ungeprüfte Firmen vor der Lead-Erstellung) ───────────────
CREATE TABLE IF NOT EXISTS public.prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.acquisition_campaigns(id) ON DELETE CASCADE,
  firma text NOT NULL,
  domain text,
  adresse text,
  plz text,
  ort text,
  kanton text,
  branche text,
  telefon text,
  email text,
  ansprechpartner text,
  quelle text NOT NULL DEFAULT 'manuell',
  quelle_notiz text,
  rohdaten jsonb,
  status text NOT NULL DEFAULT 'neu' CHECK (status IN ('neu', 'geprueft', 'freigegeben', 'verworfen', 'uebernommen')),
  compliance_status text NOT NULL DEFAULT 'pending_review' CHECK (
    compliance_status IN ('pending_review', 'allowed', 'blocked_star_or_unlisted', 'blocked_do_not_contact', 'blocked_other')
  ),
  norm_domain text,
  norm_telefon text,
  norm_email text,
  web_check jsonb,
  score integer,
  score_begruendung jsonb,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS prospects_campaign_idx ON public.prospects (campaign_id);
CREATE INDEX IF NOT EXISTS prospects_norm_domain_idx ON public.prospects (norm_domain);
CREATE INDEX IF NOT EXISTS prospects_norm_telefon_idx ON public.prospects (norm_telefon);
-- Dieselbe Firma (Domain) nur einmal pro Kampagne
CREATE UNIQUE INDEX IF NOT EXISTS prospects_campaign_domain_uniq
  ON public.prospects (campaign_id, norm_domain) WHERE norm_domain IS NOT NULL;

-- ── Belege zu einem Prospect (Quelle, Auszug, Zeitpunkt) ────────────────
CREATE TABLE IF NOT EXISTS public.prospect_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  quelle_url text,
  feld text,
  textauszug text,
  vertrauen text NOT NULL DEFAULT 'mittel' CHECK (vertrauen IN ('niedrig', 'mittel', 'hoch')),
  abgerufen_am timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
CREATE INDEX IF NOT EXISTS prospect_evidence_prospect_idx ON public.prospect_evidence (prospect_id);

-- ── Sperrliste «Nicht mehr kontaktieren» ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.do_not_contact (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  norm_telefon text,
  norm_email text,
  norm_domain text,
  firma text,
  grund text,
  quelle text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (norm_telefon IS NOT NULL OR norm_email IS NOT NULL OR norm_domain IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS dnc_telefon_idx ON public.do_not_contact (norm_telefon);
CREATE INDEX IF NOT EXISTS dnc_email_idx ON public.do_not_contact (norm_email);
CREATE INDEX IF NOT EXISTS dnc_domain_idx ON public.do_not_contact (norm_domain);

-- ── Prüfnachweise zur Compliance (nur anfügen, nie ändern) ──────────────
CREATE TABLE IF NOT EXISTS public.lead_compliance_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid REFERENCES public.prospects(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  norm_telefon text,
  status text NOT NULL CHECK (
    status IN ('pending_review', 'allowed', 'blocked_star_or_unlisted', 'blocked_do_not_contact', 'blocked_other')
  ),
  anlass text,
  quelle text,
  notiz text,
  geprueft_von uuid,
  geprueft_am timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS compliance_prospect_idx ON public.lead_compliance_checks (prospect_id);

-- ── Regeln in der Datenbank ─────────────────────────────────────────────
-- 1) Was auf der Sperrliste steht, bleibt gesperrt — egal was die App setzt.
CREATE OR REPLACE FUNCTION private.prospect_sperrliste() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.do_not_contact d
    WHERE (d.norm_telefon IS NOT NULL AND d.norm_telefon = NEW.norm_telefon)
       OR (d.norm_email   IS NOT NULL AND d.norm_email   = NEW.norm_email)
       OR (d.norm_domain  IS NOT NULL AND d.norm_domain  = NEW.norm_domain)
  ) THEN
    NEW.compliance_status := 'blocked_do_not_contact';
  END IF;
  RETURN NEW;
END $$;

-- 2) Freigabe/Übernahme nur nach abgeschlossener Prüfung und ohne Sperre.
CREATE OR REPLACE FUNCTION private.prospect_freigabe() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IN ('freigegeben', 'uebernommen')
     AND NEW.compliance_status <> 'allowed' THEN
    RAISE EXCEPTION 'Freigabe nicht möglich: Compliance-Status ist % (erforderlich: allowed).', NEW.compliance_status
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS prospect_sperrliste_trg ON public.prospects;
CREATE TRIGGER prospect_sperrliste_trg BEFORE INSERT OR UPDATE ON public.prospects
  FOR EACH ROW EXECUTE FUNCTION private.prospect_sperrliste();
DROP TRIGGER IF EXISTS prospect_freigabe_trg ON public.prospects;
CREATE TRIGGER prospect_freigabe_trg BEFORE INSERT OR UPDATE ON public.prospects
  FOR EACH ROW EXECUTE FUNCTION private.prospect_freigabe();

-- 3) Neuer Sperrlisten-Eintrag sperrt vorhandene Prospects sofort.
CREATE OR REPLACE FUNCTION private.sperrliste_wirkt() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.prospects p
     SET compliance_status = 'blocked_do_not_contact',
         status = CASE WHEN p.status IN ('freigegeben') THEN 'geprueft' ELSE p.status END,
         updated_at = now()
   WHERE (NEW.norm_telefon IS NOT NULL AND p.norm_telefon = NEW.norm_telefon)
      OR (NEW.norm_email   IS NOT NULL AND p.norm_email   = NEW.norm_email)
      OR (NEW.norm_domain  IS NOT NULL AND p.norm_domain  = NEW.norm_domain);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS sperrliste_wirkt_trg ON public.do_not_contact;
CREATE TRIGGER sperrliste_wirkt_trg AFTER INSERT ON public.do_not_contact
  FOR EACH ROW EXECUTE FUNCTION private.sperrliste_wirkt();

-- ── Zugriffsregeln (RLS) ────────────────────────────────────────────────
ALTER TABLE public.acquisition_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospect_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.do_not_contact ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_compliance_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "campaigns_akquise_all" ON public.acquisition_campaigns;
CREATE POLICY "campaigns_akquise_all" ON public.acquisition_campaigns
  FOR ALL TO authenticated USING (private.akquise_berechtigt()) WITH CHECK (private.akquise_berechtigt());

DROP POLICY IF EXISTS "prospects_akquise_all" ON public.prospects;
CREATE POLICY "prospects_akquise_all" ON public.prospects
  FOR ALL TO authenticated USING (private.akquise_berechtigt()) WITH CHECK (private.akquise_berechtigt());

DROP POLICY IF EXISTS "prospect_evidence_akquise_all" ON public.prospect_evidence;
CREATE POLICY "prospect_evidence_akquise_all" ON public.prospect_evidence
  FOR ALL TO authenticated USING (private.akquise_berechtigt()) WITH CHECK (private.akquise_berechtigt());

-- Sperrliste und Prüfnachweise: lesen und anfügen, nicht ändern oder löschen
DROP POLICY IF EXISTS "dnc_select" ON public.do_not_contact;
DROP POLICY IF EXISTS "dnc_insert" ON public.do_not_contact;
CREATE POLICY "dnc_select" ON public.do_not_contact FOR SELECT TO authenticated USING (private.akquise_berechtigt());
CREATE POLICY "dnc_insert" ON public.do_not_contact FOR INSERT TO authenticated WITH CHECK (private.akquise_berechtigt());

DROP POLICY IF EXISTS "compliance_select" ON public.lead_compliance_checks;
DROP POLICY IF EXISTS "compliance_insert" ON public.lead_compliance_checks;
CREATE POLICY "compliance_select" ON public.lead_compliance_checks FOR SELECT TO authenticated USING (private.akquise_berechtigt());
CREATE POLICY "compliance_insert" ON public.lead_compliance_checks FOR INSERT TO authenticated WITH CHECK (private.akquise_berechtigt());

NOTIFY pgrst, 'reload schema';
