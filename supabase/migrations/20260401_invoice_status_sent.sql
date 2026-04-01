-- Add 'sent' to the invoices status check constraint
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('draft', 'open', 'sent', 'paid', 'overdue', 'cancelled'));
