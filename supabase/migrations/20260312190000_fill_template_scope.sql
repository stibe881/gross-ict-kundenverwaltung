-- Fill default_scope_of_services for existing contract templates
-- Uses ILIKE pattern matching to find templates by common names

-- Wartungsvertrag (Maintenance Contract)
UPDATE public.contract_templates
SET default_scope_of_services = 
'• Regelmässige Wartung und Überprüfung der IT-Infrastruktur
• Sicherheitsupdates und Patch-Management für Server und Arbeitsplätze
• Überwachung (Monitoring) der Systeme auf Verfügbarkeit und Performance
• Backup-Kontrolle und Wiederherstellungstests
• Entstörung und Fehlerbehebung im Rahmen der vereinbarten Reaktionszeiten
• Telefonischer und Remote-Support während der Geschäftszeiten (Mo–Fr, 08:00–17:00)
• Vor-Ort-Einsätze nach Absprache (im Rahmen des vereinbarten Stundenkontingents)
• Dokumentation aller durchgeführten Arbeiten'
WHERE name ILIKE '%wartung%' AND default_scope_of_services IS NULL;

-- Hostingvertrag (Hosting Contract)
UPDATE public.contract_templates
SET default_scope_of_services = 
'• Bereitstellung und Betrieb von Webhosting-Infrastruktur (Webspace, Datenbank, E-Mail)
• Garantierte Verfügbarkeit von 99.5% (SLA)
• Tägliche Backups mit einer Aufbewahrungsdauer von 30 Tagen
• SSL/TLS-Zertifikat (Let''s Encrypt) inklusive
• E-Mail-Hosting mit Spam- und Virenfilter
• Technischer Support per E-Mail und Telefon während der Geschäftszeiten
• Regelmässige Updates der Server-Software und Sicherheitspatches
• Traffic-Volumen gemäss gewähltem Hosting-Paket'
WHERE name ILIKE '%hosting%' AND default_scope_of_services IS NULL;

-- Domainvertrag (Domain Contract)
UPDATE public.contract_templates
SET default_scope_of_services = 
'• Registrierung und Verwaltung der Domain(s) beim zuständigen Registrar
• DNS-Verwaltung (A-Records, MX-Records, CNAME, TXT etc.)
• Automatische Verlängerung der Domain vor Ablauf
• Whois-Datenschutz (sofern verfügbar)
• Unterstützung bei Domain-Transfers und Umzügen
• Technischer Support bei DNS-Konfigurationen'
WHERE name ILIKE '%domain%' AND default_scope_of_services IS NULL;

-- SLA / Service-Level-Agreement
UPDATE public.contract_templates
SET default_scope_of_services = 
'• Garantierte Reaktionszeiten gemäss vereinbartem Service-Level (z.B. 4h / 8h / NBD)
• 24/7-Erreichbarkeit für kritische Störungen (Severity 1)
• Priorisierte Bearbeitung von Störungsmeldungen
• Monatliches Reporting über Verfügbarkeit und Incidents
• Regelmässige Service-Review-Meetings (quartalsweise)
• Eskalationsmanagement bei SLA-Verletzungen
• Proaktives Monitoring und Alarmierung'
WHERE name ILIKE '%sla%' OR name ILIKE '%service level%' OR name ILIKE '%service-level%' AND default_scope_of_services IS NULL;

-- Support-Vertrag
UPDATE public.contract_templates
SET default_scope_of_services = 
'• IT-Support per Telefon, E-Mail und Remote-Zugriff
• Unterstützung bei Hard- und Softwareproblemen
• Einrichtung und Konfiguration von Arbeitsplätzen
• Benutzer- und Rechteverwaltung (Active Directory, Microsoft 365)
• Beratung bei IT-Fragen und Beschaffung
• Vor-Ort-Support nach Vereinbarung
• Dokumentation der Support-Fälle im Ticketsystem'
WHERE name ILIKE '%support%' AND default_scope_of_services IS NULL;

-- Backup-Vertrag
UPDATE public.contract_templates
SET default_scope_of_services = 
'• Einrichtung und Betrieb einer automatisierten Backup-Lösung
• Tägliche Sicherung aller relevanten Daten (Dateien, Datenbanken, E-Mails)
• Verschlüsselte Speicherung der Backups (lokal und/oder Cloud)
• Regelmässige Wiederherstellungstests (quartalsweise)
• Überwachung und Alarmierung bei fehlgeschlagenen Backups
• Aufbewahrung gemäss vereinbartem Rotationsschema
• Unterstützung bei der Wiederherstellung im Störungsfall'
WHERE name ILIKE '%backup%' AND default_scope_of_services IS NULL;

-- Cloud / Microsoft 365 Vertrag
UPDATE public.contract_templates
SET default_scope_of_services = 
'• Bereitstellung und Verwaltung von Microsoft 365 Lizenzen
• Einrichtung und Administration von Exchange Online, SharePoint und Teams
• Benutzer- und Gruppenverwaltung im Azure AD / Entra ID
• Konfiguration von Sicherheitsrichtlinien (MFA, Conditional Access)
• E-Mail-Migration und -Konfiguration
• Schulung und Einführung für Endbenutzer
• Laufender Support für Microsoft 365 Anwendungen'
WHERE (name ILIKE '%cloud%' OR name ILIKE '%microsoft%' OR name ILIKE '%m365%' OR name ILIKE '%office%') AND default_scope_of_services IS NULL;

-- Netzwerk-Vertrag
UPDATE public.contract_templates
SET default_scope_of_services = 
'• Planung, Installation und Wartung der Netzwerk-Infrastruktur
• Konfiguration und Management von Switches, Routern und Firewalls
• WLAN-Planung und -Optimierung
• VPN-Einrichtung für sicheren Remote-Zugriff
• Netzwerk-Monitoring und Performance-Analyse
• Regelmässige Sicherheitsüberprüfungen und Firmware-Updates
• Dokumentation der Netzwerk-Topologie'
WHERE name ILIKE '%netzwerk%' OR name ILIKE '%network%' AND default_scope_of_services IS NULL;

-- Managed Services Vertrag
UPDATE public.contract_templates
SET default_scope_of_services = 
'• Vollständige Übernahme des IT-Betriebs (Managed IT Services)
• Proaktives Monitoring aller Systeme und Netzwerke (24/7)
• Patch-Management und Sicherheitsupdates
• Backup-Management inkl. regelmässiger Wiederherstellungstests
• Helpdesk und Anwendersupport (1st & 2nd Level)
• Strategische IT-Beratung und Technologie-Roadmap
• Quartalsweise Service-Reviews und Reporting
• Asset-Management und Lifecycle-Planung'
WHERE (name ILIKE '%managed%' OR name ILIKE '%vollservice%' OR name ILIKE '%flatrate%') AND default_scope_of_services IS NULL;
