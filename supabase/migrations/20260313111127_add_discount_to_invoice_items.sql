-- Migration: Add discount_percentage to invoice_items
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS discount_percentage numeric(5,2) DEFAULT 0;
