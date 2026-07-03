-- Quote Activities Table (Activity Log)
CREATE TABLE IF NOT EXISTS quote_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  user_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quote_activities_quote_id ON quote_activities(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_activities_created_at ON quote_activities(created_at);

-- Enable RLS
ALTER TABLE quote_activities ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read/write
CREATE POLICY "quote_activities_select" ON quote_activities FOR SELECT TO authenticated USING (true);
CREATE POLICY "quote_activities_insert" ON quote_activities FOR INSERT TO authenticated WITH CHECK (true);

-- Allow service role full access (for edge functions)
CREATE POLICY "quote_activities_service" ON quote_activities FOR ALL TO service_role USING (true) WITH CHECK (true);
