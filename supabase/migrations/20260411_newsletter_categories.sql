-- 1. Kunden-Tabelle: Newsletter Opt-Out Flag hinzufügen
ALTER TABLE customers ADD COLUMN IF NOT EXISTS newsletter_opt_out BOOLEAN DEFAULT false;

-- 2. Newsletter-Kategorien
CREATE TABLE IF NOT EXISTS newsletter_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Verknüpfung: Kunden <-> Kategorien
CREATE TABLE IF NOT EXISTS customer_newsletter_categories (
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  category_id UUID REFERENCES newsletter_categories(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (customer_id, category_id)
);

-- 4. Kampagnen-Zielgruppen (Array von Kategorien-IDs)
ALTER TABLE newsletter_campaigns ADD COLUMN IF NOT EXISTS target_category_ids UUID[] DEFAULT '{}';

-- 5. RLS Policies
ALTER TABLE newsletter_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_newsletter_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" ON newsletter_categories
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON customer_newsletter_categories
  FOR ALL USING (auth.role() = 'authenticated');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_customer_newsletter_cat ON customer_newsletter_categories(category_id);
