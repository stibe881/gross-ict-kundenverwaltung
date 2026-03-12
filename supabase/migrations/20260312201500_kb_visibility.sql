-- Add visibility column to kb_articles (public vs internal)
ALTER TABLE kb_articles ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'internal' CHECK (visibility IN ('public', 'internal'));
CREATE INDEX IF NOT EXISTS idx_kb_articles_visibility ON kb_articles(visibility);
