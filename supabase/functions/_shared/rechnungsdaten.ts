// Datum und Zahlungsziel für das Rechnungs-PDF.
// Ein Entwurf wurde bisher OHNE Datum und Zahlungsziel gedruckt. Beim Versenden setzt die App
// aber Datum = heute und Zahlungsziel = heute + dieselbe Frist wie im Entwurf (sonst 30 Tage).
// Damit der Ausdruck dem späteren Versand entspricht, wird dieselbe Regel hier angewendet.
// Reine Funktion (keine Deno-/Netzwerkzugriffe), damit sie sich testen lässt.

const TAG_MS = 24 * 3600 * 1000;

function iso(d: Date): string {
  return d.toISOString().split("T")[0];
}

export function rechnungsDaten(
  inv: { status?: string | null; invoice_date?: string | null; due_date?: string | null },
  standardTage = 30,
  heute: Date = new Date(),
): { invoiceDate: string; dueDate: string } {
  if (inv.status !== "draft") {
    return { invoiceDate: inv.invoice_date || "", dueDate: inv.due_date || "" };
  }
  const von = inv.invoice_date ? new Date(inv.invoice_date).getTime() : NaN;
  const bis = inv.due_date ? new Date(inv.due_date).getTime() : NaN;
  let tage = Math.round((bis - von) / TAG_MS);
  if (!Number.isFinite(tage) || tage < 0) tage = standardTage > 0 ? standardTage : 30;
  return { invoiceDate: iso(heute), dueDate: iso(new Date(heute.getTime() + tage * TAG_MS)) };
}
