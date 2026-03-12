-- Storage Policies für customer-logos Bucket
-- Erlaubt authentifizierten Benutzern das Hochladen und Verwalten von Logos
-- Erlaubt öffentlichen Zugriff zum Lesen (da public bucket)

CREATE POLICY "Allow authenticated uploads to customer-logos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'customer-logos');

CREATE POLICY "Allow authenticated updates to customer-logos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'customer-logos');

CREATE POLICY "Allow authenticated deletes from customer-logos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'customer-logos');

CREATE POLICY "Allow public reads from customer-logos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'customer-logos');
