-- Öffentlicher Storage-Bucket für Website-Bilder (Partner-Logos, Referenz-Bilder),
-- die im CRM direkt hochgeladen werden.
INSERT INTO storage.buckets (id, name, public)
VALUES ('website-bilder', 'website-bilder', true)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "website_bilder_rw" ON storage.objects
    FOR ALL TO authenticated
    USING (bucket_id = 'website-bilder')
    WITH CHECK (bucket_id = 'website-bilder');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

NOTIFY pgrst, 'reload schema';
