-- Vertrags-Update für Public Link und Digitale Signatur
-- Fügt neue Felder zur `contracts`-Tabelle hinzu

ALTER TABLE contracts
ADD COLUMN IF NOT EXISTS token UUID DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS signature_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS signature_ip TEXT,
ADD COLUMN IF NOT EXISTS signature_name TEXT;

-- Sicherstellen, dass bestehende Verträge auch ein Token erhalten
UPDATE contracts SET token = gen_random_uuid() WHERE token IS NULL;

-- Token soll auch unique sein für schnelles Nachschlagen (Link-Zugriff)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'idx_contracts_token'
        AND n.nspname = 'public'
    ) THEN
        CREATE UNIQUE INDEX idx_contracts_token ON contracts (token);
    END IF;
END $$;
