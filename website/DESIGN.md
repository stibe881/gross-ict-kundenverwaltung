# Design-Brief gross-ict.ch (v2)

Gemäss CLAUDE.md vor dem Code festgehalten. v1 («Schweizer Werkstatt»,
Serif auf Tinte/Papier) wirkte zu altmodisch — v2 zielt auf die Optik
einer zeitgemässen Digital-Agentur, ohne in AI-Slop zu kippen.

## 1. Design Statement

Selbstbewusstes Studio-Portfolio: fast schwarzer Grund, übergrosse,
eng gesetzte Grotesk-Versalien, ein einziger elektrischer Akzent
(Acid-Gelbgrün), Mono-Ziffern als Ordnungssystem, grossflächige
Hover-Reaktionen. Energie kommt aus Typografie-Massstab, Kontrast
und Bewegung im Detail — nicht aus Gradients, Glows oder Karten.

## 2. Token-System

Farben (high-contrast, monochrom + 1 Akzent, keine Gradients/Schatten):
- `--bg     #0D0D0B`  Grund (warmes Fast-Schwarz)
- `--bg-2   #151512`  Panels/Zeilen-Hover
- `--line   #2A2A24`  1px-Linien auf Dunkel
- `--fg     #F1EFE8`  Text (Off-White)
- `--mute   #8F8D80`  Nebentext
- `--acid   #D9FF3F`  der eine Akzent (Buttons, Hover-Füllungen, Marker)
- `--bone   #F1EFE8`  helle Invert-Sektionen (Kontakt/Preis-Panel)
- `--bone-line #D9D6C9`, Text auf Hell `#121210` / gedämpft `#6B695E`

Typografie:
- Display: Space Grotesk 500–700, Versalien, clamp bis 128px,
  line-height 0.95, letter-spacing −0.02em
- Body/UI: Archivo 400–700, 16px/1.65
- Ordnung/Labels: System-Mono (ui-monospace), 11–12px, z.B. «(01)»

Form: keine Radien (0–2px), 1px-Linien, flat; Buttons eckig —
Acid-Füllung mit schwarzem Text oder 1px-Outline; grosse Zeilen
reagieren als ganze Fläche auf Hover (Füllung Acid, Text schwarz).

## 3. Layout-Blueprint

- Durchgehende schlanke Sticky-Nav (Brand links, Links rechts,
  Acid-CTA), alle Seiten mit gleichem Chrome.
- Start: linksbündiger, dreizeiliger Versal-Hero über die volle
  Breite (eine Zeile eingerückt, ein Wort in Acid-Outline-Stil),
  darunter 58/42 zwei grosse Panel-Links Webdesign/ICT mit
  Hover-Invert; dann ein laufendes Acid-Marquee-Band mit den
  Leistungen; Faktenzeile (4 ungleiche Spalten); grosser
  Text-CTA im Footer-Vorfeld.
- Unterseiten: Hero mit Mono-Label + Versal-Titel über ~10/12
  Spalten, Fakten rechts; Leistungen als grosse nummerierte Zeilen
  (Mono-Index, Titel in Display-Grösse, Preis rechts, Hover füllt
  die Zeile Acid); Spezialangebote als 3/5+2/5-Blöcke (ein
  Acid-Block, ein Outline-Block); Prozess als nummerierte Zeile.
- Kontakt: helle Bone-Sektion, 5/7-Teilung, Formular rechts.
- Rechner: Schritte als flache Gruppen mit 1px-Linien und
  Acid-Checked-State; Preisübersicht als helles Sticky-Panel.
- Bewegung: genau zwei animierte Elemente — Hero-Titel-Reveal
  beim Laden und das Marquee-Band; sonst nur Hover-Übergänge.
- Copy: konkret («Sie rufen an, wir nehmen ab»), keine Floskeln,
  Schweizer Hochdeutsch ohne ß.
