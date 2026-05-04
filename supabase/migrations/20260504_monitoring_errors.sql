-- Migration: Add error_message to monitoring_urls and monitoring_logs

ALTER TABLE monitoring_urls 
ADD COLUMN IF NOT EXISTS last_error text;

ALTER TABLE monitoring_logs 
ADD COLUMN IF NOT EXISTS error_message text;

-- End of migration
