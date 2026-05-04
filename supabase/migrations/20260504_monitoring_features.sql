-- ============================================================
-- Add new features to monitoring_urls table
-- ============================================================

ALTER TABLE monitoring_urls 
ADD COLUMN IF NOT EXISTS expected_keyword text,
ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS muted_until timestamptz,
ADD COLUMN IF NOT EXISTS domain_expiry date,
ADD COLUMN IF NOT EXISTS domain_alert_sent boolean DEFAULT false;

-- Create an index on customer_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_monitoring_urls_customer_id ON monitoring_urls (customer_id);
