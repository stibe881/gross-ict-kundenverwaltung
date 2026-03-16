-- Contract Activities Table (Activity Log)
CREATE TABLE IF NOT EXISTS contract_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  user_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contract_activities_contract_id ON contract_activities(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_activities_created_at ON contract_activities(created_at);

-- Enable RLS
ALTER TABLE contract_activities ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read/write
CREATE POLICY "contract_activities_select" ON contract_activities FOR SELECT TO authenticated USING (true);
CREATE POLICY "contract_activities_insert" ON contract_activities FOR INSERT TO authenticated WITH CHECK (true);

-- Allow service role full access (for edge functions)
CREATE POLICY "contract_activities_service" ON contract_activities FOR ALL TO service_role USING (true) WITH CHECK (true);
