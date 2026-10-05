-- Akquise Runde 8: Website-Recheck, Verlustgründe, Phasen-Alter,
-- Empfehlungs-Tracking
ALTER TABLE leads ADD COLUMN IF NOT EXISTS web_check JSONB;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS web_check_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lost_reason TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS stage_changed_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE leads ADD COLUMN IF NOT EXISTS referrer_customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;
