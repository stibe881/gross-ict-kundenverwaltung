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
- [ ] Dashboard-Statistiken mit echten Daten aus der Datenbank
