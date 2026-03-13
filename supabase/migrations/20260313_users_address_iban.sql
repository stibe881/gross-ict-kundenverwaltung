-- Add address and IBAN columns to the public.users table if they don't exist

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS iban TEXT;
