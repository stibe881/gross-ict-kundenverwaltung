-- Rückbau Marketing-Modul: Tabellen entfernen
-- Im Supabase SQL Editor ausführen
--
-- Bewusst NICHT entfernt:
--   - marketing_settings (speichert die eigenen Ausgaben-Kategorien der Buchhaltung)
--   - newsletter_* Tabellen (Versandhistorie; Abmelde-Links in alten Mails bleiben gültig)

DROP TABLE IF EXISTS marketing_brainstorming;
DROP TABLE IF EXISTS marketing_content;
DROP TABLE IF EXISTS marketing_sponsorships;
DROP TABLE IF EXISTS customer_testimonials;
DROP TABLE IF EXISTS marketing_events;
DROP TABLE IF EXISTS marketing_campaigns;

NOTIFY pgrst, 'reload schema';
