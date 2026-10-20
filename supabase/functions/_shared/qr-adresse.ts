// Zahlungspflichtiger für die QR-Rechnung aus Kundenname und Adresstext ableiten.
// Reine Funktion (keine Deno-/Netzwerkzugriffe), damit sie sich testen lässt.
//
// Die Adresse kommt als mehrzeiliger Text, z. B. «Name / Strasse / 6153 Ufhausen» —
// manchmal mit dem Namen als erster Zeile, manchmal mit einer Länderzeile («Schweiz»).
// Die QR-Rechnung verlangt Name, Strasse (optional) und «PLZ Ort». Findet sich keine
// PLZ-Ort-Zeile, wird der Zahlungspflichtige weggelassen (der Schein bleibt dann
// zum Ausfüllen leer) statt falsche Angaben in den QR-Code zu schreiben.

export interface Schuldner { name: string; street?: string; city: string }

const LAENDER = /^(schweiz|suisse|svizzera|switzerland|ch|liechtenstein|li)$/i;

function norm(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function parseSchuldner(name: string | undefined | null, adresse: string | undefined | null): Schuldner | null {
  const n = (name || "").trim();
  if (!n) return null;
  const zeilen = (adresse || "")
    .split(/\r?\n|<br\s*\/?>/i)
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => norm(l) !== norm(n))      // Name steht schon oben
    .filter((l) => !LAENDER.test(l));        // Länderzeile gehört nicht in Strasse/Ort

  // «PLZ Ort», auch mit Länderkürzel davor (CH-6153 Ufhusen)
  let plzIdx = -1;
  for (let i = zeilen.length - 1; i >= 0; i--) {
    if (/^(?:[A-Z]{1,2}[- ])?\d{4,5}\s+\S/.test(zeilen[i])) { plzIdx = i; break; }
  }
  if (plzIdx < 0) return null;

  const city = zeilen[plzIdx].replace(/^[A-Z]{1,2}[- ](?=\d)/, "");
  const street = plzIdx > 0 ? zeilen[plzIdx - 1] : undefined;
  return { name: n, street, city };
}
