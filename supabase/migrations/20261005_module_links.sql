-- Modul-Verzahnung: Verknüpfungs-Spalten
-- Im Supabase SQL Editor ausführen
--
-- invoices.quote_id / project_id: Rechnung kennt ihr Quell-Angebot und Projekt
-- tickets.project_id: Ticket kann einem Projekt zugeordnet werden (Aufwände im Projekt sichtbar)

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS quote_id UUID;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS project_id UUID;
ALTER TABLE tickets  ADD COLUMN IF NOT EXISTS project_id UUID;

NOTIFY pgrst, 'reload schema';
