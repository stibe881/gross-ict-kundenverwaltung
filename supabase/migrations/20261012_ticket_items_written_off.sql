-- Offene Aufwände: Positionen können abgeschrieben werden (zählen nicht mehr als offen)
ALTER TABLE ticket_items ADD COLUMN IF NOT EXISTS written_off BOOLEAN DEFAULT false;
NOTIFY pgrst, 'reload schema';
