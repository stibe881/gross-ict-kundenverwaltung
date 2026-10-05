# Design-Brief gross-ict.ch

Gemäss CLAUDE.md vor dem Code festgehalten.

## 1. Design Statement

«Schweizer Werkstatt für digitales Handwerk.» Geerdet, präzis,
selbstbewusst — wie ein gut sortierter Werkzeugkoffer, nicht wie ein
SaaS-Prospekt. Dunkler, warmer Tintengrund; grosse Aussagen in einer
charaktervollen Serife; harte Kanten, flache Flächen, viel bewusster
Leerraum. Die inhaltliche Zweiteilung Webdesign | ICT Services bleibt,
wird aber als asymmetrische Farbfeld-Teilung umgesetzt, nicht als
Gradient-Split.

## 2. Token-System

Farben (earthy, high-contrast, keine Gradients, keine Schatten):
- `--ink    #141311`  Grundfläche (warmes Fast-Schwarz)
- `--ink-2  #1C1A17`  leichte Abstufung für Zeilen/Panels
- `--line   #2B2824`  1px-Linien auf Ink
- `--paper  #EFEAE3`  Invert-Sektionen (Kontakt, Ergebnis)
- `--paper-line #D8D0C3` Linien auf Papier
- `--brass  #C19A6B`  Marke (identisch mit CRM/Portal)
- `--clay   #C8502E`  Akzent Webdesign (gebrannte Erde)
- `--pine   #3E6E64`  Akzent ICT (Tannenpetrol)
- Text auf Ink: `#EDE8E0` / gedämpft `#A49C8F`

Typografie:
- Display: Fraunces 500–700 (Serif, opsz), H1 bis clamp(44px…96px),
  enge Zeilenhöhe 1.02–1.1, leicht negative Laufweite
- Body/UI: Archivo 400–700, 16px/1.65; Labels 11–12px, Versalien,
  +1.5px Laufweite
- Zahlen/Preise: Fraunces 600

Form: Radius max 2px; Borders 1px crisp; keine box-shadows; Buttons
eckig (Brass solid mit Ink-Text, oder 1px-Outline); Links im Fliesstext
unterstrichen.

## 3. Layout-Blueprint

- Start: 58/42-Split (Desktop), links Clay-Feld «Webdesign.», rechts
  Pine-Feld «ICT Services.»; Logo links oben in der Kopfleiste, nicht
  zentriert; Wortmarken linksbündig unten im Feld; Textlink «Entdecken →»
  statt Pillen-Button. Mobil untereinander mit ungleichen Höhen.
- Unterseiten: übergrosser linksbündiger Serif-Titel über ~8 von 12
  Spalten, rechts versetzt eine schmale Fakten-Spalte; Leistungen als
  nummerierte Preiszeilen (01/02/03, 1px-Trennlinien, Preis rechts,
  Hover invertiert die Zeile) statt Kartengrid; Spezialangebote als
  zwei ungleich breite Felder (3/5 + 2/5); Prozess als eine Zeile mit
  Nummern ohne Karten; Kontakt als Papier-Sektion (hell auf dunkel),
  Formular rechts, 5/7-Teilung.
- Rechner: Schritte als flache Listen-Gruppen mit 1px-Linien,
  Preisübersicht als Papier-Panel rechts (sticky), Brass-Buttons.
- Genau eine Animation: das Einblenden der H1 auf Seitenladung.
- Copy: konkret und menschlich, keine Floskeln («modern», «innovativ»,
  «professionell» sind gestrichen), Schweizer Hochdeutsch ohne ß.
