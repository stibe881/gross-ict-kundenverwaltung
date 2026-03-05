/**
 * Formatiert einen Betrag in CHF mit Schweizer Formatierung
 * @param amount Betrag in Rappen oder Franken
 * @param decimals Anzahl Dezimalstellen (Standard: 2)
 */
export function formatCurrency(amount: number, decimals: number = 2): string {
  return `CHF ${amount.toLocaleString("de-CH", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

/**
 * Formatiert ein Datum im Format DD.MM.YYYY
 * @param date Datum als Date-Objekt oder ISO-String
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

/**
 * Formatiert ein Datum mit Uhrzeit im Schweizer Format (TT.MM.JJJJ HH:MM)
 * @param date Datum als Date-Objekt oder ISO-String
 */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const dateStr = formatDate(d);
  const hours = d.getHours().toString().padStart(2, "0");
  const minutes = d.getMinutes().toString().padStart(2, "0");
  return `${dateStr} ${hours}:${minutes}`;
}

/**
 * Schweizer MwSt-Sätze
 */
export const VAT_RATES = {
  normal: 8.1,
  reduced: 2.6,
  special: 3.8, // Beherbergung
  none: 0,
} as const;

/**
 * Berechnet den MwSt-Betrag
 * @param amount Nettobetrag
 * @param rate MwSt-Satz in Prozent
 */
export function calculateVAT(amount: number, rate: number): number {
  return (amount * rate) / 100;
}

/**
 * Berechnet den Bruttobetrag
 * @param amount Nettobetrag
 * @param rate MwSt-Satz in Prozent
 */
export function calculateGross(amount: number, rate: number): number {
  return amount + calculateVAT(amount, rate);
}
