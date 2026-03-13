-- Add recurring billing fields to contracts table
ALTER TABLE public.contracts
ADD COLUMN IF NOT EXISTS recurring_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS billing_cycle TEXT DEFAULT 'yearly'
  CHECK (billing_cycle IN ('monthly', 'quarterly', 'semi_annual', 'yearly')),
ADD COLUMN IF NOT EXISTS next_invoice_date DATE,
ADD COLUMN IF NOT EXISTS last_invoice_date DATE,
ADD COLUMN IF NOT EXISTS auto_renewal BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS vat_rate NUMERIC DEFAULT 0;
