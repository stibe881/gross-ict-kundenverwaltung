-- Mahnwesen: Einstellungen und Historie

-- Dunning Settings (Singleton-Tabelle)
CREATE TABLE IF NOT EXISTS dunning_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    auto_enabled BOOLEAN DEFAULT false,
    dunning_fee DECIMAL(10,2) DEFAULT 20.00,
    days_after_due_reminder INTEGER DEFAULT 3,
    days_between_levels INTEGER DEFAULT 10,
    -- Mahntexte pro Stufe
    text_reminder TEXT DEFAULT 'Wir möchten Sie freundlich daran erinnern, dass die Rechnung {invoice_number} über CHF {amount} seit dem {due_date} fällig ist. Bitte überweisen Sie den ausstehenden Betrag auf unser Konto. Sollten Sie die Zahlung bereits veranlasst haben, betrachten Sie diese Erinnerung bitte als gegenstandslos.',
    text_level1 TEXT DEFAULT 'Leider mussten wir feststellen, dass die Rechnung {invoice_number} über CHF {amount} trotz Fälligkeit am {due_date} noch nicht beglichen wurde. Wir bitten Sie, den ausstehenden Betrag innert 10 Tagen zu überweisen. Andernfalls sehen wir uns gezwungen, Ihnen eine Mahngebühr von CHF 20.00 in Rechnung zu stellen.',
    text_level2 TEXT DEFAULT 'Trotz unserer bisherigen Zahlungserinnerung ist die Rechnung {invoice_number} über CHF {amount} weiterhin unbezahlt. Der Rechnung wurde eine Mahngebühr von CHF 20.00 hinzugefügt. Wir fordern Sie auf, den Gesamtbetrag innert 10 Tagen zu begleichen. Bei Nichtbezahlung behalten wir uns vor, die von uns erbrachten Dienstleistungen (z.B. Webseite) zu sperren.',
    text_level3 TEXT DEFAULT 'Dies ist unsere letzte Mahnung. Die Rechnung {invoice_number} über CHF {amount} ist seit dem {due_date} unbezahlt. Sollte der ausstehende Betrag nicht innert 10 Tagen auf unserem Konto eingehen, werden wir ohne weitere Ankündigung die Betreibung einleiten. Sämtliche daraus entstehenden Kosten gehen zu Ihren Lasten.',
    subject_reminder TEXT DEFAULT 'Zahlungserinnerung: Rechnung {invoice_number}',
    subject_level1 TEXT DEFAULT '1. Mahnung: Rechnung {invoice_number}',
    subject_level2 TEXT DEFAULT '2. Mahnung: Rechnung {invoice_number}',
    subject_level3 TEXT DEFAULT 'Letzte Mahnung: Rechnung {invoice_number}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Mahnhistorie pro Rechnung
CREATE TABLE IF NOT EXISTS invoice_dunning_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    dunning_level INTEGER NOT NULL DEFAULT 0,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    email_to TEXT,
    notes TEXT
);

-- RLS
ALTER TABLE dunning_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON dunning_settings FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE invoice_dunning_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON invoice_dunning_history FOR ALL USING (true) WITH CHECK (true);

-- Index
CREATE INDEX IF NOT EXISTS idx_dunning_history_invoice ON invoice_dunning_history(invoice_id);
CREATE INDEX IF NOT EXISTS idx_dunning_history_level ON invoice_dunning_history(dunning_level);

-- Default-Eintrag für Einstellungen
INSERT INTO dunning_settings (id) VALUES (gen_random_uuid())
ON CONFLICT DO NOTHING;

-- Spalte reminder_level auf invoices (optional, für schnellen Zugriff)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS dunning_level INTEGER DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS last_dunning_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS dunning_stopped BOOLEAN DEFAULT false;

-- Rechnungseinstellungen (Singleton)
CREATE TABLE IF NOT EXISTS invoice_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    greeting_text TEXT DEFAULT 'Vielen Dank für Ihr Vertrauen. Bitte überweisen Sie den Rechnungsbetrag innert 30 Tagen auf das unten angegebene Konto.',
    closing_text TEXT DEFAULT 'Freundliche Grüsse',
    bank_name TEXT DEFAULT 'Bank Cler AG',
    account_holder TEXT DEFAULT 'Stefan Gross',
    iban TEXT DEFAULT 'CH39 0844 0261 0416 9200 1',
    swift_bic TEXT DEFAULT '',
    account_number TEXT DEFAULT '2610.4169.200',
    payment_terms_days INTEGER DEFAULT 30,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE invoice_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON invoice_settings FOR ALL USING (true) WITH CHECK (true);

INSERT INTO invoice_settings (id) VALUES (gen_random_uuid()) ON CONFLICT DO NOTHING;
