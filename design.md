# Design-Konzept: Kundenverwaltungssoftware

## Übersicht
Eine umfassende Business-Management-Plattform für 5-10 gleichzeitige Benutzer mit Rollenverwaltung, optimiert für mobile und Web-Nutzung.

## Zielgruppe
- **Primär**: Desktop-Nutzer (Büroumgebung) für komplexe Aufgaben wie Buchhaltung
- **Sekundär**: Mobile-Nutzer für schnellen Zugriff auf Kundendaten, Tickets und Akquise-Updates

## Design-Philosophie
- **Professionell und übersichtlich**: Klare Strukturen, keine Spielereien
- **Datenintensiv**: Viele Tabellen, Listen und Formulare
- **Effizienz**: Schneller Zugriff auf häufig genutzte Funktionen
- **Flexibilität**: Anpassbares Dashboard mit Drag-and-Drop-Kacheln

## Farbschema
- **Primärfarbe**: #0066CC (Professionelles Blau) - für Aktionen, Links, Buttons
- **Hintergrund Hell**: #FFFFFF (Weiß) - Haupthintergrund
- **Hintergrund Dunkel**: #1A1A1A (Dunkelgrau) - Dark Mode
- **Oberflächen**: #F8F9FA (Hellgrau) - Karten, Panels
- **Text Primär**: #212529 (Dunkelgrau) - Haupttext
- **Text Sekundär**: #6C757D (Mittelgrau) - Hilfstext
- **Erfolg**: #28A745 (Grün) - Positive Aktionen
- **Warnung**: #FFC107 (Gelb) - Warnungen
- **Fehler**: #DC3545 (Rot) - Fehler, Löschungen
- **Info**: #17A2B8 (Türkis) - Informationen

## Bildschirm-Struktur

### 1. Login & Authentifizierung
**Inhalt:**
- E-Mail/Benutzername-Eingabe
- Passwort-Eingabe
- "Angemeldet bleiben"-Checkbox
- Login-Button
- Passwort-vergessen-Link

**Flow:**
Login → Dashboard

---

### 2. Dashboard (Startseite)
**Inhalt:**
- **Anpassbare Kacheln** (Drag-and-Drop):
  - Kundenübersicht (Anzahl aktive/inaktive Kunden)
  - Offene Tickets (Anzahl nach Priorität)
  - Akquise-Pipeline (Leads nach Status)
  - Umsatz aktueller Monat
  - Ausstehende Rechnungen
  - Ablaufende Verträge (nächste 30 Tage)
  - Geplante Newsletter
  - Letzte Aktivitäten
- **Schnellzugriff-Buttons**: Neuer Kunde, Neues Ticket, Neue Rechnung
- **Benachrichtigungen**: Wichtige Updates

**Navigation:**
- Seitliches Menü (Desktop) / Bottom Tab Bar (Mobile)
- Module: Dashboard, CRM, Akquise, Verträge, Tickets, Buchhaltung, Newsletter, Einstellungen

**User Flow:**
Dashboard → Modul auswählen → Detailansicht

---

### 3. CRM-Modul
**Bildschirme:**

#### 3.1 Kundenliste
**Inhalt:**
- Suchleiste (Name, E-Mail, Firma)
- Filter (Status: Aktiv/Inaktiv, Kategorie, Tags)
- Sortierung (Name, Erstelldatum, Letzte Aktivität)
- Tabelle mit Spalten:
  - Name
  - Firma
  - E-Mail
  - Telefon
  - Status
  - Letzte Aktivität
  - Aktionen (Bearbeiten, Löschen)
- "Neuer Kunde"-Button

**Flow:**
Kundenliste → Kunde auswählen → Kundendetails

#### 3.2 Kundendetails
**Inhalt:**
- **Kopfbereich**: Name, Firma, Status-Badge
- **Tabs**:
  - **Stammdaten**: Name, Firma, Adresse, Kontaktdaten, Notizen
  - **Kommunikation**: Historie aller E-Mails, Anrufe, Meetings (Zeitstempel, Benutzer, Notiz)
  - **Verträge**: Liste aller Verträge des Kunden
  - **Rechnungen**: Liste aller Rechnungen
  - **Tickets**: Liste aller Support-Tickets
  - **Akquise**: Akquise-Verlauf (wenn aus Lead konvertiert)
- **Aktionen**: Bearbeiten, Löschen, E-Mail senden, Anruf protokollieren

**Flow:**
Kundendetails → Tab wechseln / Bearbeiten / Neue Aktivität hinzufügen

---

### 4. Akquisemodul
**Bildschirme:**

#### 4.1 Lead-Pipeline
**Inhalt:**
- **Kanban-Board** mit Spalten:
  - Neu
  - Kontaktiert
  - Qualifiziert
  - Angebot erstellt
  - Verhandlung
  - Gewonnen
  - Verloren
- Jede Karte zeigt: Lead-Name, Firma, Wert, Letzte Aktivität
- Drag-and-Drop zwischen Spalten
- Filter nach Benutzer, Datum, Wert
- "Neuer Lead"-Button

**Flow:**
Pipeline → Lead auswählen → Lead-Details

#### 4.2 Lead-Details
**Inhalt:**
- **Kopfbereich**: Lead-Name, Firma, Status, Wert
- **Tabs**:
  - **Stammdaten**: Name, Firma, Kontaktdaten, Quelle, Zuständiger Mitarbeiter
  - **Verlauf**: Chronologische Liste aller Aktivitäten (Anrufe, E-Mails, Meetings, Status-Änderungen)
  - **Notizen**: Freitextfeld für Notizen
  - **Dokumente**: Angebote, Präsentationen hochladen
- **Aktionen**: Status ändern, Aktivität hinzufügen, In Kunde konvertieren, Löschen

**Flow:**
Lead-Details → Aktivität hinzufügen / Status ändern / In Kunde konvertieren

---

### 5. Vertragsmodul
**Bildschirme:**

#### 5.1 Vertragsliste
**Inhalt:**
- Suchleiste (Vertragsnummer, Kunde)
- Filter (Status: Aktiv/Abgelaufen/Gekündigt, Vertragsart)
- Sortierung (Startdatum, Enddatum, Kunde)
- Tabelle mit Spalten:
  - Vertragsnummer
  - Kunde
  - Vertragsart
  - Startdatum
  - Enddatum
  - Status
  - Kündigungsfrist
  - Aktionen
- Warnungen für ablaufende Verträge (< 30 Tage)
- "Neuer Vertrag"-Button

**Flow:**
Vertragsliste → Vertrag auswählen → Vertragsdetails

#### 5.2 Vertragsdetails
**Inhalt:**
- **Kopfbereich**: Vertragsnummer, Kunde, Status-Badge
- **Vertragsdetails**: Vertragsart, Laufzeit, Kündigungsfrist, Wert, Zahlungsintervall
- **Dokumente**: PDF-Upload (Vertragsdokument)
- **Verlauf**: Änderungen, Verlängerungen, Kündigungen
- **Aktionen**: Bearbeiten, Kündigen, Verlängern, Dokument hochladen

**Flow:**
Vertragsdetails → Bearbeiten / Kündigen / Dokument hochladen

---

### 6. Ticketsystem
**Bildschirme:**

#### 6.1 Ticket-Liste
**Inhalt:**
- Suchleiste (Ticket-ID, Kunde, Betreff)
- Filter (Status: Offen/In Bearbeitung/Geschlossen, Priorität, Zugewiesen an)
- Sortierung (Erstelldatum, Priorität, Letzte Aktualisierung)
- Tabelle mit Spalten:
  - Ticket-ID
  - Kunde
  - Betreff
  - Status
  - Priorität
  - Zugewiesen an
  - Erstellt am
  - Aktionen
- "Neues Ticket"-Button

**Flow:**
Ticket-Liste → Ticket auswählen → Ticket-Details

#### 6.2 Ticket-Details
**Inhalt:**
- **Kopfbereich**: Ticket-ID, Betreff, Status, Priorität
- **Ticket-Informationen**: Kunde, Kategorie, Zugewiesen an, Erstellt am, Letzte Aktualisierung
- **Beschreibung**: Ursprüngliche Ticket-Beschreibung
- **Kommentare**: Chronologische Liste (Benutzer, Zeitstempel, Kommentar)
- **Anhänge**: Dateien hochladen/herunterladen
- **Aktionen**: Status ändern, Priorität ändern, Zuweisen, Kommentar hinzufügen, In Wissensdatenbank übernehmen

**Flow:**
Ticket-Details → Kommentar hinzufügen / Status ändern / In KB übernehmen

#### 6.3 Wissensdatenbank
**Inhalt:**
- Suchleiste (Titel, Inhalt)
- Kategorien (Dropdown)
- Sichtbarkeit-Filter (Intern/Extern)
- Liste von KB-Einträgen:
  - Titel
  - Kategorie
  - Sichtbarkeit
  - Erstellt von
  - Aktionen
- "Neuer KB-Eintrag"-Button

**Flow:**
Wissensdatenbank → Eintrag auswählen → KB-Details / Bearbeiten

---

### 7. Buchhaltungsmodul
**Bildschirme:**

#### 7.1 Buchhaltungs-Dashboard
**Inhalt:**
- **Übersichtskarten**:
  - Umsatz aktueller Monat
  - Offene Forderungen
  - Überfällige Rechnungen
  - Ausgaben aktueller Monat
- **Schnellzugriff**: Neue Rechnung, Neue Ausgabe, Kontenplan

**Flow:**
Buchhaltungs-Dashboard → Modul auswählen (Rechnungen/Ausgaben/Kontenplan/Berichte)

#### 7.2 Rechnungsliste
**Inhalt:**
- Suchleiste (Rechnungsnummer, Kunde)
- Filter (Status: Entwurf/Versendet/Bezahlt/Überfällig, Zeitraum)
- Sortierung (Rechnungsdatum, Fälligkeitsdatum, Betrag)
- Tabelle mit Spalten:
  - Rechnungsnummer
  - Kunde
  - Rechnungsdatum
  - Fälligkeitsdatum
  - Betrag
  - Status
  - Aktionen
- "Neue Rechnung"-Button

**Flow:**
Rechnungsliste → Rechnung auswählen → Rechnungsdetails

#### 7.3 Rechnungsdetails/Erstellen
**Inhalt:**
- **Rechnungskopf**: Rechnungsnummer (automatisch), Kunde (Dropdown), Rechnungsdatum, Fälligkeitsdatum
- **Positionen**: Tabelle (Beschreibung, Menge, Einzelpreis, MwSt-Satz, Gesamtpreis)
  - Zeilen hinzufügen/entfernen
- **Summen**: Netto, MwSt, Brutto
- **Notizen**: Zahlungsbedingungen, Hinweise
- **Aktionen**: Speichern als Entwurf, Als PDF generieren, Per E-Mail versenden, Als bezahlt markieren

**Flow:**
Rechnungsdetails → Bearbeiten / PDF generieren / Versenden / Als bezahlt markieren

#### 7.4 Kontenplan
**Inhalt:**
- Hierarchische Liste von Konten (Kontonummer, Kontoname, Kontoart)
- Suchleiste
- "Neues Konto"-Button
- Aktionen: Bearbeiten, Löschen

**Flow:**
Kontenplan → Konto auswählen → Kontobuchungen anzeigen

#### 7.5 Belege/Ausgaben
**Inhalt:**
- Liste aller Ausgaben/Belege
- Suchleiste, Filter (Kategorie, Zeitraum)
- Tabelle: Datum, Beschreibung, Kategorie, Betrag, Beleg (PDF)
- "Neue Ausgabe"-Button

**Flow:**
Ausgabenliste → Ausgabe auswählen → Details / Beleg anzeigen

#### 7.6 Berichte/Auswertungen
**Inhalt:**
- **Berichtstypen** (Dropdown):
  - Gewinn- und Verlustrechnung (GuV)
  - Bilanz
  - Umsatzsteuer-Voranmeldung
  - Offene Posten
  - Kundenumsätze
- **Zeitraum-Auswahl**: Von-Bis-Datum
- **Anzeige**: Tabelle/Diagramm
- **Aktionen**: Als PDF exportieren, Als Excel exportieren

**Flow:**
Berichte → Berichtstyp wählen → Zeitraum wählen → Bericht generieren → Exportieren

---

### 8. Newsletter-Modul
**Bildschirme:**

#### 8.1 Newsletter-Übersicht
**Inhalt:**
- Liste aller Newsletter-Kampagnen
- Tabelle: Titel, Status (Entwurf/Geplant/Versendet), Empfänger, Versanddatum, Öffnungsrate
- Filter (Status, Zeitraum)
- "Neuer Newsletter"-Button

**Flow:**
Newsletter-Übersicht → Newsletter auswählen → Newsletter-Details

#### 8.2 Newsletter erstellen/bearbeiten
**Inhalt:**
- **Kopfbereich**: Titel, Betreff
- **Empfänger**: Auswahl (Alle Kunden, Bestimmte Tags, Manuelle Auswahl)
- **Inhalt**: Rich-Text-Editor (Überschriften, Text, Bilder, Links)
- **Vorschau**: Desktop/Mobile-Vorschau
- **Versandoptionen**: Sofort senden / Zeitpunkt planen
- **Aktionen**: Speichern als Entwurf, Test-E-Mail senden, Versenden

**Flow:**
Newsletter erstellen → Inhalt bearbeiten → Empfänger auswählen → Vorschau → Versenden/Planen

#### 8.3 Newsletter-Statistiken
**Inhalt:**
- **Metriken**: Versendet, Zugestellt, Geöffnet, Geklickt, Abgemeldet
- **Öffnungsrate**: Prozentsatz + Diagramm
- **Klickrate**: Prozentsatz + Diagramm
- **Empfängerliste**: Wer hat geöffnet/geklickt

**Flow:**
Newsletter-Statistiken → Details anzeigen

---

### 9. Einstellungen
**Bildschirme:**

#### 9.1 Benutzerverwaltung
**Inhalt:**
- Liste aller Benutzer
- Tabelle: Name, E-Mail, Rolle, Status (Aktiv/Inaktiv)
- "Neuer Benutzer"-Button
- Aktionen: Bearbeiten, Deaktivieren, Löschen

**Rollen:**
- **Administrator**: Voller Zugriff auf alle Module und Einstellungen
- **Manager**: Zugriff auf alle Module, keine Benutzerverwaltung
- **Buchhalter**: Nur Buchhaltungsmodul
- **Vertrieb**: CRM, Akquise, Verträge
- **Support**: Tickets, Wissensdatenbank, CRM (nur lesen)

**Flow:**
Benutzerverwaltung → Benutzer auswählen → Bearbeiten / Rolle ändern

#### 9.2 Unternehmenseinstellungen
**Inhalt:**
- Firmenname, Logo, Adresse, Kontaktdaten
- Rechnungseinstellungen (Präfix, nächste Nummer, Zahlungsbedingungen)
- E-Mail-Einstellungen (SMTP-Server für Newsletter)
- Speichern-Button

**Flow:**
Unternehmenseinstellungen → Bearbeiten → Speichern

---

## Navigation-Struktur

### Desktop (Web)
- **Seitliches Menü** (links, immer sichtbar):
  - Dashboard
  - CRM
  - Akquise
  - Verträge
  - Tickets
  - Buchhaltung
  - Newsletter
  - Einstellungen
- **Kopfzeile**: Logo, Suchleiste (global), Benachrichtigungen, Benutzerprofil

### Mobile (App)
- **Bottom Tab Bar** (5 Hauptbereiche):
  - Dashboard
  - CRM
  - Tickets
  - Akquise
  - Mehr (Menü mit Verträge, Buchhaltung, Newsletter, Einstellungen)
- **Kopfzeile**: Titel des aktuellen Bildschirms, Benachrichtigungen, Menü-Button

---

## Hauptfunktionen pro Modul

### CRM
- Kundenverwaltung (CRUD)
- Kommunikationshistorie
- Kundensuche und -filterung
- Tags und Kategorien

### Akquise
- Lead-Management mit Pipeline
- Aktivitätsverlauf pro Lead
- Lead-zu-Kunde-Konvertierung
- Wert- und Wahrscheinlichkeits-Tracking

### Verträge
- Vertragsverwaltung (CRUD)
- Laufzeit- und Kündigungsfristen-Tracking
- Dokumenten-Upload
- Ablaufwarnungen

### Tickets
- Ticket-Erstellung und -Zuweisung
- Status- und Prioritätsverwaltung
- Kommentare und Anhänge
- Wissensdatenbank (intern/extern)

### Buchhaltung
- Rechnungserstellung und -verwaltung
- Kontenplan
- Belegverwaltung
- Berichte (GuV, Bilanz, USt-VA)

### Newsletter
- E-Mail-Kampagnen erstellen
- Empfängerverwaltung
- Rich-Text-Editor
- Versandstatistiken

---

## Technische Anforderungen

### Authentifizierung
- OAuth-basierte Anmeldung (integriert)
- Rollenverwaltung (5 Rollen)
- Session-Management

### Datenbank
- MySQL-Datenbank
- Relationale Struktur für alle Module
- Audit-Logs für wichtige Änderungen

### API
- tRPC für Backend-Kommunikation
- RESTful-Prinzipien
- Validierung mit Zod

### Performance
- Lazy Loading für große Listen
- Paginierung (50 Einträge pro Seite)
- Caching für häufig abgerufene Daten

### Sicherheit
- Rollenbasierte Zugriffskontrolle (RBAC)
- Verschlüsselte Passwörter
- HTTPS für alle Verbindungen
- Input-Validierung

---

## Responsive Design

### Desktop (> 1024px)
- Seitliches Menü + Hauptbereich
- Tabellen mit allen Spalten
- Multi-Column-Layouts

### Tablet (768px - 1024px)
- Kollabierendes Menü
- Tabellen mit weniger Spalten
- 2-Column-Layouts

### Mobile (< 768px)
- Bottom Tab Bar
- Karten statt Tabellen
- Single-Column-Layouts
- Touch-optimierte Buttons

---

## Priorität der Implementierung

1. **Phase 1**: Authentifizierung, Datenbank, CRM
2. **Phase 2**: Akquise, Verträge
3. **Phase 3**: Tickets, Wissensdatenbank
4. **Phase 4**: Buchhaltung (Rechnungen, Kontenplan)
5. **Phase 5**: Newsletter
6. **Phase 6**: Dashboard, Reporting, Feinschliff
