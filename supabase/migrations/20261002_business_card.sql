-- Digitale Visitenkarte: Kartendaten zentral pro Benutzer speichern
-- (bisher nur lokal auf dem Gerät via AsyncStorage)
ALTER TABLE users ADD COLUMN IF NOT EXISTS business_card JSONB;

NOTIFY pgrst, 'reload schema';
