-- Migration: Add website to customers table

ALTER TABLE customers
ADD COLUMN IF NOT EXISTS website text;
