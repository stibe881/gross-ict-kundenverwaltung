-- Telefon-Einstieg (KI) dauerhaft am Lead speichern
ALTER TABLE leads ADD COLUMN IF NOT EXISTS call_script JSONB;
