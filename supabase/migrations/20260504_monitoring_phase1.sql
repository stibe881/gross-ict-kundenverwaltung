-- ============================================================
-- Phase 1: Escalation, Server Info, and DNS Tracking
-- ============================================================

ALTER TABLE monitoring_urls 
ADD COLUMN IF NOT EXISTS down_since timestamptz,
ADD COLUMN IF NOT EXISTS escalation_level integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS server_info text,
ADD COLUMN IF NOT EXISTS security_warnings jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS dns_a_records jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS dns_mx_records jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS dns_warnings jsonb DEFAULT '[]'::jsonb;
