-- Inaktivitäts-Erinnerung ("Seit 6 Monaten keine Rechnung und kein Ticket")
-- pro Kunde steuerbar machen: später erneut erinnern oder ganz stummschalten.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS inactive_snooze_until DATE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS inactive_muted BOOLEAN DEFAULT FALSE;
