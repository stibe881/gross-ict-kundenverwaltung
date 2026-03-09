-- Migration: Leads & Lead Activities für Akquise-Modul

-- 1. Leads Tabelle
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT,
    company TEXT,
    email TEXT,
    phone TEXT,
    mobile TEXT,
    website TEXT,
    address TEXT,
    value NUMERIC(12,2) DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'proposal', 'won', 'lost')),
    source TEXT,
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    notes TEXT,
    assigned_to UUID REFERENCES users(id),
    quote_id UUID REFERENCES quotes(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Lead Activities (Historie/Aktivitäten)
CREATE TABLE IF NOT EXISTS lead_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'activity' CHECK (type IN ('activity', 'system', 'email', 'call', 'meeting', 'note')),
    content TEXT NOT NULL,
    user_name TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. RLS aktivieren
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_activities ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
CREATE POLICY "Authenticated users can manage leads" ON leads
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage lead activities" ON lead_activities
    FOR ALL USING (auth.role() = 'authenticated');

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_lead_activities_lead_id ON lead_activities(lead_id);
