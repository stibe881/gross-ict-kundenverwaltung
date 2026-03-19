-- Update contracts table to support internal contracts mapped to employees
-- Using public.users so it can be queried normally down the line if needed
ALTER TABLE public.contracts 
ADD COLUMN IF NOT EXISTS employee_id UUID;

-- Drop older constraint if it was already pointing to auth.users
ALTER TABLE public.contracts DROP CONSTRAINT IF EXISTS contracts_employee_id_fkey;

-- Add correct constraint
ALTER TABLE public.contracts ADD CONSTRAINT contracts_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- Allow customer_id to be NULL for internal contracts
ALTER TABLE public.contracts
ALTER COLUMN customer_id DROP NOT NULL;
