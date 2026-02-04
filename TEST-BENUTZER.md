# Test-Benutzer für Gross ICT Kundenverwaltung

## Übersicht

Diese Datei beschreibt die Test-Benutzer für die Kundenverwaltungssoftware.

## 1. Admin-Benutzer (Mitarbeiter)

**Zugang:** Internes Dashboard mit allen Modulen

- **E-Mail:** `admin@gross-ict.ch`
- **Passwort:** Wird über OAuth/SSO verwaltet
- **Rolle:** Administrator
- **Berechtigungen:** Vollzugriff auf alle Module (CRM, Buchhaltung, Tickets, Verträge, Newsletter, Benutzerverwaltung)

**Zugriff auf:**
- Dashboard
- Kundenverwaltung (CRM)
- Akquise (Leads)
- Ticketsystem
- Buchhaltung
- Verträge
- Newsletter
- Benutzerverwaltung (nur Admins)

## 2. Kunden-Portal-Benutzer (Firma: Muster AG)

**Zugang:** Nur Kunden-Portal (keine internen Module)

- **Firma:** Muster AG
- **E-Mail:** `portal@muster-ag.ch`
- **Passwort:** `portal123`
- **Rolle:** Administrator (sieht alle Firmen-Tickets)
- **Berechtigungen:** Zugriff auf alle Tickets der Firma Muster AG

**Zugriff auf:**
- Kunden-Portal Login
- Ticket-Übersicht (alle Tickets der Firma)
- Ticket-Details mit externen Kommentaren
- Antworten auf Tickets möglich

**Hinweis:** Interne Kommentare sind für Kunden-Portal-Benutzer nicht sichtbar.

## Installation

### Schritt 1: Supabase-Schema ausführen

Führen Sie zuerst das Haupt-Schema aus:

```bash
# In Supabase SQL Editor
supabase-schema.sql
```

### Schritt 2: Test-Benutzer erstellen

Führen Sie das Test-Benutzer-Script aus:

```bash
# In Supabase SQL Editor
test-users.sql
```

**Wichtig:** Das Passwort-Hash für den Portal-Benutzer muss noch generiert werden. Verwenden Sie bcrypt:

```javascript
const bcrypt = require('bcrypt');
const hash = await bcrypt.hash('portal123', 10);
console.log(hash);
```

Ersetzen Sie dann den Placeholder `$2a$10$YourHashedPasswordHere` in `test-users.sql` mit dem generierten Hash.

## Login-Flows

### Mitarbeiter-Login

1. Öffnen Sie die Anwendung
2. Sie werden automatisch zum OAuth-Login weitergeleitet
3. Nach erfolgreicher Anmeldung: Zugriff auf Dashboard und alle Module

### Kunden-Portal-Login

1. Navigieren Sie zu `/portal-login`
2. Geben Sie E-Mail und Passwort ein:
   - E-Mail: `portal@muster-ag.ch`
   - Passwort: `portal123`
3. Nach erfolgreicher Anmeldung: Zugriff nur auf Kunden-Portal mit Tickets

## Zugriffskontrolle

- **Nicht angemeldet:** Automatischer Redirect zur Login-Seite, keine Module sichtbar
- **Mitarbeiter:** Zugriff auf internes Dashboard und alle Module
- **Kunden:** Zugriff nur auf Kunden-Portal, keine internen Module

## Test-Szenarien

### Szenario 1: Admin testet internes System

1. Als Admin anmelden
2. Dashboard öffnen - alle Module sichtbar
3. Ticket "Test-Ticket: Frage zur Rechnung" öffnen
4. Beide Kommentare sichtbar (intern + extern)
5. Neuen internen Kommentar hinzufügen

### Szenario 2: Kunde testet Portal

1. Als Kunde anmelden (`portal@muster-ag.ch` / `portal123`)
2. Nur Kunden-Portal sichtbar
3. Ticket "Test-Ticket: Frage zur Rechnung" öffnen
4. Nur externe Kommentare sichtbar
5. Antwort auf Ticket schreiben (wird als extern markiert)

### Szenario 3: Zugriffskontrolle testen

1. Abmelden
2. Versuchen, Dashboard zu öffnen
3. Automatischer Redirect zur Login-Seite
4. Keine Module ohne Anmeldung zugänglich
