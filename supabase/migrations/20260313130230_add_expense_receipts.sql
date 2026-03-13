-- Add receipt columns to expenses table
ALTER TABLE "expenses"
ADD COLUMN IF NOT EXISTS "receipt_path" text,
ADD COLUMN IF NOT EXISTS "receipt_url" text;

-- Create storage bucket for expense receipts
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'expense_receipts', 
    'expense_receipts', 
    true, 
    52428800, -- 50MB limit
    array['image/jpeg', 'image/png', 'image/heic', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET 
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage policies for authenticated users
CREATE POLICY "Authenticated users can upload expense receipts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'expense_receipts');

CREATE POLICY "Authenticated users can update their expense receipts"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'expense_receipts');

CREATE POLICY "Authenticated users can read expense receipts"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'expense_receipts');

CREATE POLICY "Authenticated users can delete expense receipts"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'expense_receipts');
