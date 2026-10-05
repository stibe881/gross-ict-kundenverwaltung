# Design-Brief gross-ict.ch (v3 — umgesetztes Mockup)

Gemäss CLAUDE.md vor dem Code festgehalten. v3 folgt dem vom Inhaber
freigegebenen Mockup (claude.ai/artifact/BZC9Rr9KYcZmgdiDQirtcF) und
dessen Vorlagen; wo das Mockup bewusst von einzelnen CLAUDE.md-Regeln
abweicht (Farbverläufe der Farbwelten), gilt die Freigabe des Inhabers.

## 1. Design Statement

Zwei Markenwelten unter einem Dach: Die Startseite teilt den Viewport
in eine Magenta/Violett-Welt (Web- und Appdesign) und eine
Tiefblau-Welt (ICT Services). Die Webdesign-Seite inszeniert sich wie
eine Kreativagentur — cinematisches Vollbild-Foto (Bergsonnenuntergang),
kondensierte Anton-Versalien, dunkle Referenz-Galerie mit echten
Monitor-Szenen. Die ICT-Seite tritt hell und corporate auf — Foto-Hero
mit Blau-Überlagerung, überlappende weisse Leistungskarten. Gold
(#D9A96A) ist die verbindende Markenfarbe, das echte Logo steht überall
freigestellt.

## 2. Token-System

Farben:
- Dunkle Basis: `--bg #0B0E1A`, Panels `#121318`/`#1A1B22`, Linien `#2A2B33`
- Text: `#EDEFF5`, gedämpft `#A9AEBC`
- Marke: `--gold #D9A96A`, hell `#EBD9BC`
- Webwelt: Verlauf `#C0188F → #8B2FC9 → #4C1D95`
- ICT-Welt: Verlauf `#081831 → #0E3B6E → #0B5392`, Akzent `#38BDF8`
- Helle ICT-Seite: Grund `#F5F7FA`, Karten weiss, Text `#152238`/`#5A6578`

Typografie (alle lokal gehostet):
- Anton 400: kondensierte Display-Versalien (Hero-Zeilen bis 170px,
  Sektionstitel der Webwelt)
- Sora 600–800: Logo-Ersatztexte, UI-Titel, Versal-Headlines der ICT-Welt
- Manrope 400–800: Fliesstext 16px/1.65

Form: Pill-Buttons (radius 999), Karten 14–16px Radius; Schatten nur
in der hellen ICT-Welt und unter Monitor-Szenen (fotografischer Look).

## 3. Layout-Blueprint

- Start (ohne Chrome): 50/50-Farbwelten-Split mit schwebenden
  UI-Motiven links und Leiterbahnen rechts, freigestelltes Logo
  (76px) oben Mitte, ENTDECKEN-Pillen, Kontaktzeile (17px) unten.
- Webdesign: transparenter Header über Vollbild-Sonnenuntergang,
  Anton-Headline «Web- & App-Agentur mit WEITBLICK», Scroll-Kreis zu
  den Referenzen; Referenzen als Zeilen — links Foto-Szene
  (Umgebungsbild passend zur Branche + Monitor mit echtem Screenshot
  der Kundenseite), rechts Infos (Kunde in Gold, Anton-Titel, Text,
  Link, Tag-Pillen); danach Angebote, Spezialpreise, Prozess, Kontakt.
- ICT Services (hell): weisse Navigation, Foto-Hero (Serverraum) mit
  Blau-Überlagerung und Gold-CTA, drei überlappende weisse Karten,
  Vertrag-Band, Kontakt.
- Rechner (/rechner.html): Originallogik unverändert, dunkle Gruppen
  mit Magenta-Checked-State, helle Sticky-Preisübersicht.
- Dynamik: Scroll-Reveal auf Referenzzeilen/Sektionen (eine
  Translate/Fade-Transition, respektiert prefers-reduced-motion);
  Referenzdaten zentral als Datenliste gepflegt.
- Copy: konkret, ohne die verbotenen Wörter der CLAUDE.md.

Bildnachweis: Umgebungsfotos sind CC-lizenzierte Platzhalter
(Openverse/Flickr) — vor dem Livegang durch eigene oder lizenzfreie
Bilder ersetzen oder Attribution im Impressum ergänzen.
