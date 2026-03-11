-- Ausgaben-Tabelle für Buchhaltung (Schweizer Einzelfirma)
CREATE TABLE IF NOT EXISTS expenses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount DECIMAL(10,2) NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'other',
    supplier TEXT,
    payment_method TEXT DEFAULT 'bank',
    tax_rate DECIMAL(4,2) DEFAULT 0,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    is_deductible BOOLEAN DEFAULT true,
    receipt_url TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON expenses FOR ALL USING (true) WITH CHECK (true);

-- Index
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
