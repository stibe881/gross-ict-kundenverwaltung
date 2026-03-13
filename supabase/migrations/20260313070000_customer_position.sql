-- Position-Feld für Kunden (Ansprechpartner-Funktion)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS position TEXT;
