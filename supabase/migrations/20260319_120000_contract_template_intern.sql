INSERT INTO contract_templates (
    name, 
    description, 
    default_duration_months, 
    default_notice_period_months, 
    default_payment_terms, 
    default_scope_of_services, 
    default_special_agreements
) VALUES (
    'Interner Vertrag Freie Mitarbeit',
    'Vertragsvorlage für freie Mitarbeiter von Gross ICT, inkl. Provisions- und Infrastrukturabzügen (25%)',
    1,
    3,
    'Ausbezahlung nach Kundenzahlung',
    'Akquise von Kunden und Ausführung von IT-Dienstleistungen (Webdesign, Support, Beratungen) im Namen und unter dem Branding von Gross ICT.',
    'Vergütung und Abzüge:
- 25% Abzug vom Netto-Projektumsatz (nach Deckung etwaiger projektbezogener Fremdkosten).
- Davon 10% Provision/Geschäftsrisiko für Gross ICT.
- Davon 15% Infrastruktur-Pauschale (E-Mail, Gross ICT Portal, MS Teams, Passwortmanager).
- Verbleibende 75% werden als Honorar ausbezahlt.

Kündigung:
- Gross ICT: 3 Monate Frist auf das Ende eines jeden Kalendermonats.
- Freier Mitarbeiter: Jederzeit fristlos möglich (mit Pflicht zur geordneten Übergabe laufender Projekte).

Kundenstamm:
- Der Kundenstamm (inkl. aller während der Mitarbeit akquirierten Kunden) verbleibt rechtlich vollumfänglich bei Gross ICT. Die Kunden werden direkt zu Kunden von Gross ICT.'
);
