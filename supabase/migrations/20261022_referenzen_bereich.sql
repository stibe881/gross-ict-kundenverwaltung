-- Referenzen nach Bereich trennen: 'web' (Web- & Appdesign) oder 'ict'
-- (ICT Services). Bestehende Referenzen gehören zum Webbereich.
ALTER TABLE website_references
  ADD COLUMN IF NOT EXISTS bereich text NOT NULL DEFAULT 'web';
