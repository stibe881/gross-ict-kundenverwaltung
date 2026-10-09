// Geografische Eingrenzung der Firmensuche — reine Funktionen ohne Deno-/Netzwerkzugriff,
// damit sie sich in Tests prüfen lassen.

export interface Gebiet {
  /** Vier­stellige Schweizer Postleitzahlen (leer = nicht nach PLZ eingrenzen) */
  plz: string[];
  /** Gemeinde/Ortsname (leer = nicht nach Ort eingrenzen) */
  ort: string;
  /** Umkreis in km um das Zentrum; 0 = nur die genannte PLZ bzw. der genannte Ort */
  radiusKm: number;
  zentrum?: { lat: number; lng: number };
}

/** «Zell LU» -> «zell», «Küssnacht a. R.» bleibt erhalten; Gross-/Kleinschreibung und Akzente fallen weg. */
export function normalisiereOrt(s: string): string {
  return s
    .trim()
    .replace(/\s+(AG|AI|AR|BE|BL|BS|FR|GE|GL|GR|JU|LU|NE|NW|OW|SG|SH|SO|SZ|TG|TI|UR|VD|VS|ZG|ZH)$/i, "") // Kantonskürzel am Ende
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Liest «6144 Zell LU» o. ä. aus einer von Google formatierten Adresse. */
export function plzOrtAusAdresse(adresse: string): { plz: string; ort: string } | null {
  const m = adresse.match(/\b(\d{4})\s+([^,]+)/);
  return m ? { plz: m[1], ort: m[2].trim() } : null;
}

export function entfernungKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = 6371;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

/** Rechteck, das den Kreis um das Zentrum sicher einschliesst (für locationRestriction). */
export function umschliessendesRechteck(z: { lat: number; lng: number }, radiusKm: number) {
  const dLat = radiusKm / 111.32;
  const dLng = radiusKm / (111.32 * Math.max(Math.cos((z.lat * Math.PI) / 180), 0.01));
  return {
    low: { latitude: z.lat - dLat, longitude: z.lng - dLng },
    high: { latitude: z.lat + dLat, longitude: z.lng + dLng },
  };
}

/**
 * Entscheidet, ob ein Treffer im gewünschten Gebiet liegt.
 *  - Umkreis > 0: Luftlinie zum Zentrum (Treffer ohne Koordinaten fallen heraus)
 *  - sonst PLZ-Liste und/oder Ortsname müssen zur Adresse passen
 *  - ohne jede Vorgabe: kein Filter
 */
export function imGebiet(
  treffer: { adresse: string; lat?: number; lng?: number },
  g: Gebiet,
): boolean {
  if (g.radiusKm > 0 && g.zentrum) {
    if (treffer.lat == null || treffer.lng == null) return false;
    return entfernungKm(g.zentrum, { lat: treffer.lat, lng: treffer.lng }) <= g.radiusKm;
  }
  if (!g.plz.length && !g.ort) return true;
  const a = plzOrtAusAdresse(treffer.adresse);
  if (!a) return false;
  // Passt die PLZ ODER der Ort, liegt der Treffer im Gebiet
  if (g.plz.includes(a.plz)) return true;
  if (g.ort) {
    const gewuenscht = normalisiereOrt(g.ort);
    const vorhanden = normalisiereOrt(a.ort);
    return vorhanden === gewuenscht || vorhanden.startsWith(gewuenscht + " ");
  }
  return false;
}
