-- Marketing-Modul: Neue Tabellen
-- In Supabase SQL Editor ausfuehren

-- 1. Multi-Channel Marketing Kampagnen
CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'other',
  status TEXT NOT NULL DEFAULT 'planned',
  budget DECIMAL(10,2),
  spent DECIMAL(10,2) DEFAULT 0,
  leads_generated INT DEFAULT 0,
  revenue_generated DECIMAL(10,2) DEFAULT 0,
  start_date DATE,
  end_date DATE,
  description TEXT,
  target_audience TEXT,
  goal TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE marketing_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mktg_campaigns_all" ON marketing_campaigns FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. Veranstaltungen / Events
CREATE TABLE IF NOT EXISTS marketing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'messe',
  status TEXT NOT NULL DEFAULT 'planned',
  event_date DATE NOT NULL,
  end_date DATE,
  location TEXT,
  description TEXT,
  budget DECIMAL(10,2),
  attendees_expected INT DEFAULT 0,
  attendees_actual INT DEFAULT 0,
  leads_generated INT DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE marketing_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mktg_events_all" ON marketing_events FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Kundenstimmen / Testimonials
CREATE TABLE IF NOT EXISTS customer_testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  company TEXT,
  role TEXT,
  testimonial_text TEXT NOT NULL,
  rating INT DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
  is_published BOOLEAN DEFAULT false,
  use_for_website BOOLEAN DEFAULT false,
  category TEXT DEFAULT 'allgemein',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE customer_testimonials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mktg_testimonials_all" ON customer_testimonials FOR ALL TO authenticated USING (true) WITH CHECK (true);
