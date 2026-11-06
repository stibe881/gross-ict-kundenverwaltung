// Gesamtbetrag einer Rechnung — derselbe Betrag, den PDF, Einzahlungsschein und Listen nennen:
// die Summe der Positionen. Das DB-Feld «total» kann abweichen (z. B. durch früher aufgeschlagene MwSt)
// und ist nur der Ersatz, wenn es keine Positionen gibt. Reine Funktion, damit sie sich testen lässt.
export function rechnungsbetrag(invoice: { total?: number | string | null; items?: Array<{ total?: number | string | null }> | null }): number {
  const summe = (invoice.items || []).reduce((s, i) => s + (Number(i.total) || 0), 0);
  return summe > 0 ? summe : Number(invoice.total) || 0;
}
