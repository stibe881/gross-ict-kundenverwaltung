-- Standard-Eigenkosten zur contract_templates-Tabelle hinzufügen
ALTER TABLE public.contract_templates
ADD COLUMN IF NOT EXISTS default_internal_costs NUMERIC(10,2) DEFAULT NULL;
