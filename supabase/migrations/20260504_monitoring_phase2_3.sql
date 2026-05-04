-- ============================================================
-- Phase 2 & 3: Blacklists & Server Agent
-- ============================================================

ALTER TABLE monitoring_urls 
ADD COLUMN IF NOT EXISTS blacklist_status jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS agent_url text,
ADD COLUMN IF NOT EXISTS agent_key text,
ADD COLUMN IF NOT EXISTS agent_data jsonb;
