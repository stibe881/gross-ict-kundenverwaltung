-- Fix: RLS-Policies für invoice_activities und Status-Constraint für 'sent'

-- 1. invoice_activities Tabelle erstellen falls nicht vorhanden
CREATE TABLE IF NOT EXISTS invoice_activities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    description TEXT NOT NULL,
    user_name TEXT DEFAULT 'System',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. RLS aktivieren (idempotent)
ALTER TABLE invoice_activities ENABLE ROW LEVEL SECURITY;

-- 3. Alte Policies löschen falls vorhanden
DROP POLICY IF EXISTS "Allow all for authenticated" ON invoice_activities;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON invoice_activities;
DROP POLICY IF EXISTS "invoice_activities_select" ON invoice_activities;
DROP POLICY IF EXISTS "invoice_activities_insert" ON invoice_activities;

-- 4. Neue Policies: alle authentifizierten Benutzer dürfen lesen und schreiben
CREATE POLICY "invoice_activities_all" ON invoice_activities
    FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- 5. Index für Performance
CREATE INDEX IF NOT EXISTS idx_invoice_activities_invoice ON invoice_activities(invoice_id);

-- 6. Status-Constraint auf invoices: 'sent' hinzufügen (idempotent)
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_status_check
    CHECK (status IN ('draft', 'open', 'sent', 'paid', 'overdue', 'cancelled'));

-- 7. Backfill: Rechnungen die bereits geöffnet wurden auf 'sent' setzen
UPDATE invoices
SET status = 'sent'
WHERE id IN (
    SELECT DISTINCT invoice_id FROM invoice_activities WHERE type = 'viewed'
)
AND status = 'open';
