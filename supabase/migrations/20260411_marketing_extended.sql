-- Marketing Extended: Content Planner + Settings Store
-- In Supabase SQL Editor ausfuehren

-- 1. Marketing Settings (Key-Value fuer GA4 Config etc.)
CREATE TABLE IF NOT EXISTS marketing_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE marketing_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mktg_settings_all" ON marketing_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Standard-Einstellungen einfuegen
INSERT INTO marketing_settings (key, value) VALUES
  ('ga4_property_id', ''),
  ('ga4_api_key', ''),
  ('ga4_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

-- 2. Content Planner (Social Media, Blog, Newsletter Planung)
CREATE TABLE IF NOT EXISTS marketing_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'linkedin',
  content_type TEXT NOT NULL DEFAULT 'post',
  status TEXT NOT NULL DEFAULT 'draft',
  planned_date DATE,
  published_at TIMESTAMP WITH TIME ZONE,
  content TEXT,
  hashtags TEXT,
  image_url TEXT,
  link_url TEXT,
  campaign_id UUID REFERENCES marketing_campaigns(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE marketing_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mktg_content_all" ON marketing_content FOR ALL TO authenticated USING (true) WITH CHECK (true);
