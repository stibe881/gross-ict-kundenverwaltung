-- Vertragsnummer zur contracts-Tabelle hinzufügen
-- Format: VT-YYYY-NNN (z.B. VT-2026-001)

ALTER TABLE public.contracts
ADD COLUMN IF NOT EXISTS contract_number TEXT UNIQUE;

-- Bestehende Verträge rückwirkend nummerieren (sortiert nach created_at)
DO $$
DECLARE
    r RECORD;
    seq INTEGER := 1;
    yr TEXT;
    prev_yr TEXT := '';
    yr_seq INTEGER := 1;
BEGIN
    FOR r IN
        SELECT id, created_at
        FROM public.contracts
        WHERE contract_number IS NULL
        ORDER BY created_at ASC
    LOOP
        yr := TO_CHAR(r.created_at, 'YYYY');

        IF yr <> prev_yr THEN
            yr_seq := 1;
            prev_yr := yr;
        END IF;

        UPDATE public.contracts
        SET contract_number = 'VT-' || yr || '-' || LPAD(yr_seq::TEXT, 3, '0')
        WHERE id = r.id;

        yr_seq := yr_seq + 1;
    END LOOP;
END $$;

-- Index für schnelle Suche
CREATE UNIQUE INDEX IF NOT EXISTS idx_contracts_contract_number
    ON public.contracts (contract_number)
    WHERE contract_number IS NOT NULL;
