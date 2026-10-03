-- Angebots-Annahme: Entscheidung des Kunden zu optionalen Leistungen speichern
-- Im Supabase SQL Editor ausführen
-- NULL = keine Entscheidung erfasst (z.B. manuell angenommen oder keine Optionen)
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS accepted_with_options BOOLEAN;

NOTIFY pgrst, 'reload schema';
