-- ============================================================
-- Tabelle: monitoring_urls
-- Zweck:   URLs speichern, die im CRM überwacht werden sollen
-- ============================================================

CREATE TABLE IF NOT EXISTS monitoring_urls (
  id                  uuid              DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             uuid              REFERENCES users(id) ON DELETE SET NULL,
  name                text              NOT NULL,
  url                 text              NOT NULL,
  check_interval      integer           DEFAULT 5,          -- Prüfintervall in Minuten (für künftige Hintergrundprüfungen)
  is_active           boolean           DEFAULT true,
  last_checked_at     timestamptz,
  last_status         text              DEFAULT 'unknown',   -- 'up' | 'down' | 'unknown'
  last_response_time  integer,                               -- Antwortzeit in Millisekunden
  last_status_code    integer,                               -- HTTP-Statuscode
  notes               text,
  created_at          timestamptz       DEFAULT now(),
  updated_at          timestamptz       DEFAULT now()
);

-- Index für schnelle Abfragen nach Benutzer
CREATE INDEX IF NOT EXISTS idx_monitoring_urls_user_id ON monitoring_urls (user_id);

-- RLS aktivieren
ALTER TABLE monitoring_urls ENABLE ROW LEVEL SECURITY;

-- Alle authentifizierten Benutzer dürfen alle URLs lesen (Teamüberwachung)
CREATE POLICY "Alle Mitarbeiter können Monitoring-URLs lesen"
  ON monitoring_urls FOR SELECT
  USING (auth.role() = 'authenticated');

-- Erstellen: nur eingeloggte Benutzer
CREATE POLICY "Eingeloggte Benutzer können URLs erstellen"
  ON monitoring_urls FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Bearbeiten und Löschen: jeder Benutzer kann alle URLs verwalten (Team-Ansatz)
CREATE POLICY "Mitarbeiter können URLs aktualisieren"
  ON monitoring_urls FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Mitarbeiter können URLs löschen"
  ON monitoring_urls FOR DELETE
  USING (auth.role() = 'authenticated');
