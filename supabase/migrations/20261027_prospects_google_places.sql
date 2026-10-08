-- Google Places als Quelle für Prospects (Places API (New)).
-- Nach den Google-Richtlinien darf von Places-Inhalten nur die place_id dauerhaft
-- gespeichert werden; Name, Adresse, Telefon und Website werden bei Bedarf live
-- abgefragt und NICHT in dieser Tabelle abgelegt. Firmendaten für den Lead stammen
-- aus der eigenen Website der Firma (Impressum/Kontakt).

ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS google_place_id text;

-- Prospects, die nur über die Google-place_id bekannt sind, haben noch keinen Firmennamen
ALTER TABLE public.prospects ALTER COLUMN firma DROP NOT NULL;
ALTER TABLE public.prospects DROP CONSTRAINT IF EXISTS prospects_firma_oder_place;
ALTER TABLE public.prospects ADD CONSTRAINT prospects_firma_oder_place
  CHECK (firma IS NOT NULL OR google_place_id IS NOT NULL);

-- Jeder Google-Eintrag nur einmal pro Kampagne
CREATE UNIQUE INDEX IF NOT EXISTS prospects_campaign_place_uniq
  ON public.prospects (campaign_id, google_place_id) WHERE google_place_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS prospects_place_idx ON public.prospects (google_place_id);

NOTIFY pgrst, 'reload schema';
