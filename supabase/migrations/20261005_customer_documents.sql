-- Dokumentenablage pro Kunde: privater Storage-Bucket + Zugriff für angemeldete Benutzer
-- Im Supabase SQL Editor ausführen

INSERT INTO storage.buckets (id, name, public)
VALUES ('customer-documents', 'customer-documents', false)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "customer_documents_rw" ON storage.objects
    FOR ALL TO authenticated
    USING (bucket_id = 'customer-documents')
    WITH CHECK (bucket_id = 'customer-documents');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
