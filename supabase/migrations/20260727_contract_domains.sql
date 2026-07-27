-- Domains-Feld für Verträge (JSONB Array)
-- Format: [{name: "example.com", annual_amount: 35.00, internal_costs: 5.00}]
ALTER TABLE public.contracts
ADD COLUMN IF NOT EXISTS domains JSONB DEFAULT '[]'::jsonb;
