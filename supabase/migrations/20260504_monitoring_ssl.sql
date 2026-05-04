-- ============================================================
-- Add SSL check fields to monitoring_urls
-- ============================================================

ALTER TABLE monitoring_urls
ADD COLUMN ssl_valid boolean,
ADD COLUMN ssl_expiry timestamptz,
ADD COLUMN ssl_issuer text;
