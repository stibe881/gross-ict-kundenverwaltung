-- Add special_discount and special_discount_type to invoices and quotes
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS special_discount DECIMAL(10, 2) DEFAULT 0.00;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS special_discount_type TEXT DEFAULT 'amount' CHECK (special_discount_type IN ('amount', 'percentage'));

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS special_discount DECIMAL(10, 2) DEFAULT 0.00;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS special_discount_type TEXT DEFAULT 'amount' CHECK (special_discount_type IN ('amount', 'percentage'));
