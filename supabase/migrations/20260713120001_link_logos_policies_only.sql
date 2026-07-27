-- Only create the RLS policies (bucket already exists)
-- Drop existing policies if any to avoid conflicts
DROP POLICY IF EXISTS "Allow authenticated uploads to link-logos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates to link-logos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes from link-logos" ON storage.objects;
DROP POLICY IF EXISTS "Allow public reads from link-logos" ON storage.objects;

-- Create fresh policies
CREATE POLICY "Allow authenticated uploads to link-logos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'link-logos');

CREATE POLICY "Allow authenticated updates to link-logos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'link-logos');

CREATE POLICY "Allow authenticated deletes from link-logos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'link-logos');

CREATE POLICY "Allow public reads from link-logos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'link-logos');
