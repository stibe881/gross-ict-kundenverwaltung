-- Inaktivitäts-Erinnerung ("Seit 6 Monaten keine Rechnung und kein Ticket")
-- pro Kunde steuerbar machen: später erneut erinnern oder ganz stummschalten.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS inactive_snooze_until DATE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS inactive_muted BOOLEAN DEFAULT FALSE;
-- Intervall in Monaten, nach dem ohne Rechnung/Ticket erinnert wird (NULL = 6)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS inactive_months INTEGER;
