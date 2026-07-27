-- Create storage bucket for link logos (nützliche Links)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'link-logos',
    'link-logos',
    true,
    10485760, -- 10MB limit
    array['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Allow authenticated users to upload logos
CREATE POLICY "Allow authenticated uploads to link-logos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'link-logos');

-- Allow authenticated users to update logos
CREATE POLICY "Allow authenticated updates to link-logos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'link-logos');

-- Allow authenticated users to delete logos
CREATE POLICY "Allow authenticated deletes from link-logos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'link-logos');

-- Allow public read access (bucket is public)
CREATE POLICY "Allow public reads from link-logos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'link-logos');
