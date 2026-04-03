-- Backfill: Rechnungen die bereits vom Empfänger geöffnet wurden (viewed-Aktivität vorhanden)
-- aber noch den Status 'open' haben, auf 'sent' setzen.
UPDATE invoices
SET status = 'sent'
WHERE id IN (
  SELECT DISTINCT invoice_id
  FROM invoice_activities
  WHERE type = 'viewed'
)
AND status = 'open';
