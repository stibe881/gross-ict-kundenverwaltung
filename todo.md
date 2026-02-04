# Projekt TODO

## Authentifizierung & Rollenverwaltung
- [x] Benutzer-Datenmodell mit Rollen (Admin, Manager, Buchhalter, Vertrieb, Support)
- [x] Login-Screen mit E-Mail/Passwort
- [x] Rollenbasierte Zugriffskontrolle (RBAC) implementieren
- [x] Session-Management

## Datenbank-Schema
- [x] Kunden-Tabelle (CRM)
- [x] Kommunikationshistorie-Tabelle
- [x] Leads-Tabelle (Akquise)
- [x] Aktivitäten-Tabelle (Akquise-Verlauf)
- [x] Verträge-Tabelle
- [x] Tickets-Tabelle
- [x] Ticket-Kommentare-Tabelle
- [x] Wissensdatenbank-Tabelle
- [x] Rechnungen-Tabelle
- [x] Rechnungspositionen-Tabelle
- [x] Kontenplan-Tabelle
- [x] Belege/Ausgaben-Tabelle
- [x] Newsletter-Kampagnen-Tabelle
- [x] Newsletter-Empfänger-Tabelle
- [x] Benutzer-Tabelle

## CRM-Modul
- [x] Kundenliste mit Suche und Filter (Backend)
- [ ] Kundendetails-Screen mit Tabs (Stammdaten, Kommunikation, Verträge, Rechnungen, Tickets)
- [x] Kunde erstellen/bearbeiten (Backend)
- [x] Kommunikationshistorie hinzufügen (E-Mail, Anruf, Meeting) (Backend)
- [x] Kunde löschen (Backend)

## Akquisemodul
- [ ] Lead-Pipeline (Kanban-Board mit Drag-and-Drop)
- [ ] Lead-Details-Screen mit Verlauf
- [ ] Lead erstellen/bearbeiten
- [ ] Aktivität zum Lead hinzufügen
- [ ] Lead-Status ändern
- [ ] Lead in Kunde konvertieren
- [ ] Lead löschen

## Vertragsmodul
- [ ] Vertragsliste mit Suche und Filter
- [ ] Vertragsdetails-Screen
- [ ] Vertrag erstellen/bearbeiten
- [ ] Vertragsdokument hochladen
- [ ] Ablaufwarnungen (< 30 Tage)
- [ ] Vertrag kündigen
- [ ] Vertrag löschen

## Ticketsystem
- [ ] Ticket-Liste mit Suche und Filter
- [ ] Ticket-Details-Screen mit Kommentaren
- [ ] Ticket erstellen/bearbeiten
- [ ] Ticket-Status ändern
- [ ] Ticket-Priorität ändern
- [ ] Ticket zuweisen
- [ ] Kommentar hinzufügen
- [ ] Anhänge hochladen
- [ ] Ticket in Wissensdatenbank übernehmen
- [ ] Wissensdatenbank-Liste mit Suche
- [ ] KB-Eintrag erstellen/bearbeiten (intern/extern)

## Buchhaltungsmodul
- [ ] Buchhaltungs-Dashboard mit Übersichtskarten
- [ ] Rechnungsliste mit Suche und Filter
- [ ] Rechnung erstellen/bearbeiten mit Positionen
- [ ] Rechnung als PDF generieren
- [ ] Rechnung per E-Mail versenden
- [ ] Rechnung als bezahlt markieren
- [ ] Kontenplan-Liste
- [ ] Konto erstellen/bearbeiten/löschen
- [ ] Ausgaben/Belege-Liste
- [ ] Ausgabe erstellen mit Beleg-Upload
- [ ] Berichte (GuV, Bilanz, USt-VA, Offene Posten, Kundenumsätze)
- [ ] Berichte als PDF/Excel exportieren

## Newsletter-Modul
- [ ] Newsletter-Übersicht mit Kampagnenliste
- [ ] Newsletter erstellen/bearbeiten mit Rich-Text-Editor
- [ ] Empfänger auswählen (Alle, Tags, Manuell)
- [ ] Newsletter-Vorschau (Desktop/Mobile)
- [ ] Test-E-Mail senden
- [ ] Newsletter sofort versenden
- [ ] Newsletter zeitlich planen
- [ ] Newsletter-Statistiken (Öffnungsrate, Klickrate)

## Dashboard
- [x] Dashboard mit Übersichtskacheln
- [x] Kacheln: Kundenübersicht, Offene Tickets, Akquise-Pipeline, Buchhaltung
- [x] Schnellzugriff-Buttons (Neuer Kunde, Neues Ticket, Neue Rechnung)
- [ ] Benachrichtigungen
- [ ] Drag-and-Drop für Kacheln

## Navigation & Layout
- [x] Bottom Tab Bar (Mobile) mit 5 Hauptbereichen
- [ ] Seitliches Menü (Desktop)
- [ ] Globale Suchleiste
- [ ] Benachrichtigungssystem
- [ ] Benutzerprofil-Menü

## Einstellungen
- [ ] Benutzerverwaltung (Liste, Erstellen, Bearbeiten, Deaktivieren)
- [ ] Unternehmenseinstellungen (Firma, Logo, Adresse, Rechnungseinstellungen)
- [ ] E-Mail-Einstellungen (SMTP für Newsletter)

## Branding & Design
- [ ] App-Logo generieren
- [ ] Farbschema anwenden
- [ ] Theme-Konfiguration (Hell/Dunkel)

## Testing & Finalisierung
- [ ] End-to-End-Tests für alle Hauptfunktionen
- [ ] Responsive Design testen (Desktop, Tablet, Mobile)
- [ ] Performance-Optimierung
- [ ] Dokumentation erstellen

## Aktuell zu beheben
- [x] CRM-Modul UI implementieren (Kundenliste mit Suche und Statistik)
- [x] Buchhaltungsmodul UI implementieren (Tabs: Übersicht, Rechnungen, Ausgaben)
- [x] Akquisemodul UI implementieren (Lead-Pipeline mit Stages)
- [x] Ticketsystem UI implementieren (Ticket-Liste mit Filter und Statistik)
- [ ] Login-Funktionalität - OAuth wird automatisch vom Backend gehandhabt

## Benutzer-Feedback
- [x] Währung von EUR auf CHF ändern (alle Module)

## Neue Anforderungen
- [x] Formular zum Erstellen von Kunden implementieren
- [x] Formular zum Erstellen von Rechnungen implementieren (mit Positionen)
- [x] Formular zum Erstellen von Leads implementieren
- [x] Schweizer Datumsformat (TT.MM.JJJJ) - Hilfsfunktionen erstellt
- [x] Schweizer Zahlenformatierung (Tausendertrennzeichen) - formatCurrency-Funktion
- [x] Schweizer MwSt-Sätze (8.1% Normal, 2.6% Reduziert) im Rechnungsformular
- [ ] Zahlungsverwaltung für Rechnungen (bezahlter Betrag eingeben können) - Wird in Rechnungsdetails implementiert

## Artikel-/Dienstleistungsverwaltung
- [x] Artikel/Dienstleistungen-Tabelle in Datenbank erstellen
- [x] API-Endpunkte für Produkte (list, create, update, delete)
- [x] Artikel-Auswahl im Rechnungsformular (Dropdown mit Katalog)
- [x] Schnellerfassung: Link zu "Neues Produkt erstellen" im Rechnungsformular
- [ ] Artikel/Dienstleistungen-Verwaltungsseite (separater Screen)

## Kundenauswahl
- [x] Kunden-Dropdown im Rechnungsformular
- [ ] Kunden-Dropdown im Ticket-Formular

## Produktverwaltung & Rechnungsfunktionen
- [x] Produktverwaltungs-Screen (Liste aller Artikel/Dienstleistungen)
- [x] Produkt erstellen/bearbeiten im Produktverwaltungs-Screen
- [x] Neuer Tab "Produkte" in der Navigation
- [ ] Rechnungen per E-Mail versenden
- [ ] Rechnungen als PDF herunterladen

## Lead-Verwaltung
- [x] Lead bearbeiten (Formular mit vorausgefüllten Daten)
- [ ] Lead-Detailseite mit Historie
- [ ] Automatische Historie bei Änderungen (Status, Wert, etc.)
- [ ] Manuelle Aktivitäten zur Historie hinzufügen (Notizen, Anrufe, Meetings)

## Lead-zu-Kunde-Konvertierung
- [x] "Als Kunde erfassen"-Button in Lead-Karten
- [x] Lead-Daten automatisch in Kundenformular übernehmen
- [x] Bestätigungsdialog mit Lead-Informationen

## Bugfixes
- [x] Dashboard: "Neuer Kunde", "Neues Ticket", "Neue Rechnung" Buttons funktional machen
- [x] Tickets: Plus-Button oben rechts funktional machen
- [x] Tickets: Ticket-Details öffnen können

## Datumsformat
- [x] Datumsformat in Tickets auf DD.MM.YYYY angepasst
- [x] formatDate()-Funktion bereits vorhanden in lib/format.ts

## Ticket-Formular
- [x] Ticket-Formular-Komponente erstellt
- [x] Ticket-Plus-Button funktional
- [x] Ticket-Details öffnen funktioniert
- [x] Kundenauswahl im Ticket-Formular

## Ticket-Historie
- [x] Ticket-Historie-Anzeige im Details-Modal
- [x] Beispiel-Historie mit System- und Benutzer-Kommentaren
- [x] Manuelle Kommentare zur Historie hinzufügen können
- [x] Chronologische Darstellung mit Zeitstempel (DD.MM.YYYY HH:MM)
- [ ] Automatische Historie bei Statusänderungen (Backend)
- [ ] Automatische Historie bei Prioritätsänderungen (Backend)

## Lead-Historie
- [x] Lead-Details-Modal erstellen
- [x] Lead-Historie-Anzeige im Details-Modal (Aktivitätsverlauf)
- [x] Beispiel-Historie mit System- und Benutzer-Aktivitäten
- [x] Manuelle Aktivitäten zur Historie hinzufügen können
- [x] Chronologische Darstellung mit Zeitstempel (DD.MM.YYYY HH:MM)
- [x] Lead-Karten klickbar - öffnet Details-Modal

## Benutzerverwaltung (Admin)
- [x] Benutzerverwaltungs-Screen erstellen (nur für Admins)
- [x] Benutzerliste mit Rollen anzeigen (Admin, Manager, Buchhalter, Vertrieb, Support)
- [x] Rollenbasierte Navigation (Admin-Kachel nur für Admins sichtbar)
- [x] Zugriffskontrolle - Nicht-Admins sehen Fehlermeldung
- [x] Statistik-Kacheln (Gesamt, Aktiv, Inaktiv)
- [x] Filterung nach Status (Alle, Aktiv, Inaktiv)
- [ ] Neuen Benutzer erstellen (Formular)
- [ ] Benutzer bearbeiten (Rolle ändern, aktivieren/deaktivieren)
- [ ] Benutzer löschen/deaktivieren

## Vertragsmodul (Priorität 1)
- [x] Vertragsmodul-Screen erstellen (/contracts)
- [x] Vertragsliste mit Beispieldaten anzeigen
- [x] Vertragsstatus (Aktiv, Gekündigt, Abgelaufen) mit Farbcodierung
- [x] Filterung nach Status
- [x] Statistik-Kacheln (Aktiv, Gekündigt, Abgelaufen)
- [x] Dashboard-Kachel für Verträge hinzugefügt
- [x] Neuen Vertrag erstellen (Kunde, Titel, Beschreibung, Betrag, Laufzeit, Kündigungsfrist)
- [x] Automatische Berechnung des Enddatums basierend auf Startdatum + Laufzeit
- [x] Kundenauswahl im Vertragsformular
- [x] Plus-Button im Contracts-Screen funktional
- [x] Vertrags-Details-Modal mit Historie
- [x] Verträge klickbar - öffnet Details-Modal
- [x] Bearbeiten-Button im Details-Modal
- [ ] Vertrag bearbeiten (Formular mit vorausgefüllten Daten)
- [ ] Integration in Kunden-Detailansicht

## Neue Prioritäten
- [ ] Newsletter-Modul implementieren (E-Mail-Kampagnen, Empfängerlisten, Versand)
- [ ] Rechnungs-PDF-Export (PDF-Generierung mit MwSt-Ausweis)
- [x] Dashboard-Statistiken mit echten Daten (Backend-Endpunkt) aus der Datenbank

## Aktuelle Prioritäten
- [x] Dark/Light Mode Toggle implementieren (Dashboard-Header)
- [x] Sun/Moon Icons zum Icon-Mapping hinzugefügt
- [x] Newsletter-Modul implementieren (Kampagnenliste mit Status und Statistiken)
- [x] Newsletter-Screen mit Filter (Alle, Entwürfe, Geplant, Versendet)
- [x] Newsletter-Kachel zum Dashboard hinzugefügt
- [ ] Newsletter-Formular (Kampagne erstellen)
- [ ] Empfängerlisten-Verwaltung
- [x] Rechnungs-PDF-Export (Backend-Funktion mit HTML-Template)
- [x] PDF-Export-Endpunkt im Router
- [ ] PDF-Download-Button im Buchhaltungsmodul
- [x] Dashboard-Statistiken mit echten Daten (Backend-Endpunkt)

## Finale Features
- [x] PDF-Download-Button im Buchhaltungsmodul
- [x] Newsletter-Formular zum Erstellen neuer Kampagnen
- [x] Branding mit Gross ICT Logo konfigurieren
- [x] App-Name auf "Gross ICT" geändert
- [x] Logo in alle erforderlichen Formate kopiert (icon.png, splash-icon.png, favicon.png, android-icon-foreground.png)

## Bugfix - Lead-Status
- [x] Status-Auswahl im Lead-Formular hinzugefügt (Neu, Kontaktiert, Qualifiziert, Angebot, Gewonnen, Verloren)

## Bugfix - Dark Mode Toggle
- [x] Dark/Light Mode Toggle korrigiert - zeigt Info-Meldung, dass Theme den Systemeinstellungen folgt
- [x] Hinweis auf manuelle Theme-Änderung in System-Einstellungen

## Neue Features (Priorität)
- [x] Kundendetailseite mit Tabs (Stammdaten, Kommunikation, Verträge, Rechnungen, Tickets)
- [x] Navigation von Kundenliste zu Detailseite
- [ ] Dashboard-Daten live aus Datenbank laden (echte Statistiken)
- [x] Supabase-Integration konfigurieren (Project ID: bvluvvyvftygnxtmboxw)
- [x] Supabase Anon Public Key hinterlegen
- [x] Datenbankverbindung testen (Tests erfolgreich)

## Supabase-Migration
- [x] Datenbankschema in Supabase erstellen (supabase-schema.sql)
- [x] API-Endpunkte auf Supabase umgestellt (alle tRPC-Router)
- [x] Dashboard-Statistiken mit echten Supabase-Daten (getDashboardStats)
- [x] Supabase-Datenbankfunktionen erstellt (supabase-db.ts)

## Theme-Auswahl
- [x] Theme-Auswahl mit 3 Optionen (Dark, Light, System) implementiert
- [x] Theme-Einstellung persistent speichern (AsyncStorage)
- [x] Theme-Wechsel ohne Reload
- [x] Modal mit Icon-Auswahl für Theme-Modi

## Kunden-Portal & Ticket-Zugriff
- [x] Ticket-Kommentare: Interne/Externe Unterscheidung (Standard: intern)
- [x] Kunden-Einstellung: Portal-Zugriff aktivieren/deaktivieren
- [x] Kunden-Benutzer-Tabelle erstellen (mehrere Benutzer pro Kunde)
- [x] Kunden-Benutzer-Rollen: "Benutzer" (nur eigene Tickets) und "Administrator" (alle Firmen-Tickets)
- [x] Kunden-Benutzer-Verwaltung im Kundendetail (Portal-Tab)
- [x] Kunden-Login-System (UI implementiert)
- [x] Kunden-Portal-UI (Ticket-Übersicht für Kunden)
- [x] Externe Kommentare für Kunden sichtbar machen
- [ ] API-Integration für Portal-Login
- [ ] API-Integration für Portal-Benutzerverwaltung
- [ ] API-Integration für Ticket-Kommentare (Internal/External)
- [ ] Supabase-Schema ausführen (customer_portal_users Tabelle)

## Theme-System Anpassung
- [x] Theme-System entfernen (Light/Dark/System Toggle)
- [x] Festes dunkles Design implementieren
- [x] Theme-Toggle aus Dashboard entfernt

## Zugriffskontrolle & Test-Benutzer
- [x] Zugriffskontrolle für abgemeldete Benutzer (Redirect zu Login)
- [x] Kunden-Portal-Trennung (Kunden sehen nur Portal)
- [x] Test-Admin-Benutzer erstellen (SQL-Script)
- [x] Test-Firmen-Kunde mit Portal-Zugang erstellen (SQL-Script)
- [x] Portal-Login mit API-Integration
- [x] Separate Session-Verwaltung für Kunden

## Admin-Benutzer erstellen
- [x] Stefan Gross (stefan.gross@gross-ict.ch) als Admin erstellen (SQL-Script bereit)
- [x] Joel Hediger (joel.hediger@gross-ict.ch) als Admin erstellen (SQL-Script bereit)
- [ ] SQL-Script in Supabase ausführen (create-admin-users.sql)

## Zugriffskontrolle Bugfix
- [x] Tab-Navigation für nicht angemeldete Benutzer ausblenden
- [x] Auth-Guard-Komponente erstellt
- [x] Tab-Layout mit Auth-Guard geschützt
- [x] Dashboard mit Auth-Check geschützt

## Blink-Problem beheben
- [x] Redirect-Loop analysieren
- [x] Auth-Check optimieren um wiederholte Redirects zu vermeiden
- [x] Doppelten Redirect im Dashboard entfernt
