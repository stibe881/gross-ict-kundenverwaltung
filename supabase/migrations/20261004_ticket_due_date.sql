-- Ticket-Modul: Fälligkeitsdatum für Tickets
-- Im Supabase SQL Editor ausführen
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS due_date DATE;

NOTIFY pgrst, 'reload schema';
