-- ============================================================
-- Tabelle: monitoring_logs
-- Zweck:   Verlauf der Überprüfungen für jede URL
-- ============================================================

CREATE TABLE IF NOT EXISTS monitoring_logs (
  id                  uuid              DEFAULT gen_random_uuid() PRIMARY KEY,
  url_id              uuid              NOT NULL REFERENCES monitoring_urls(id) ON DELETE CASCADE,
  status              text              NOT NULL, -- 'up' | 'down' | 'unknown'
  response_time       integer,          -- Antwortzeit in ms
  status_code         integer,          -- HTTP Statuscode
  checked_at          timestamptz       DEFAULT now()
);

-- Index für schnelle Abfragen nach URL und Zeit
CREATE INDEX IF NOT EXISTS idx_monitoring_logs_url_id ON monitoring_logs (url_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_logs_checked_at ON monitoring_logs (checked_at DESC);

-- RLS aktivieren
ALTER TABLE monitoring_logs ENABLE ROW LEVEL SECURITY;

-- Alle authentifizierten Benutzer dürfen Logs lesen
CREATE POLICY "Alle Mitarbeiter können Monitoring-Logs lesen"
  ON monitoring_logs FOR SELECT
  USING (auth.role() = 'authenticated');

-- Jeder authentifizierte Benutzer darf Logs erstellen (durch Ping)
CREATE POLICY "Mitarbeiter können Logs erstellen"
  ON monitoring_logs FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
