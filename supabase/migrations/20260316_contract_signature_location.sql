-- Add signature_location column to contracts table for storing signing location
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS signature_location TEXT;
