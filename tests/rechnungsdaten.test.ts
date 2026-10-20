import { describe, expect, it } from "vitest";
import { rechnungsDaten } from "../supabase/functions/_shared/rechnungsdaten";

const heute = new Date("2026-10-20T10:00:00Z");

describe("Datum und Zahlungsziel im Rechnungs-PDF", () => {
  it("übernimmt bei gesendeten Rechnungen die gespeicherten Daten", () => {
    expect(rechnungsDaten({ status: "open", invoice_date: "2026-10-01", due_date: "2026-10-31" }, 30, heute))
      .toEqual({ invoiceDate: "2026-10-01", dueDate: "2026-10-31" });
  });
  it("zeigt beim Entwurf heute und dieselbe Frist wie im Entwurf", () => {
    expect(rechnungsDaten({ status: "draft", invoice_date: "2026-10-01", due_date: "2026-10-15" }, 30, heute))
      .toEqual({ invoiceDate: "2026-10-20", dueDate: "2026-11-03" });
  });
  it("nimmt bei einem Entwurf ohne Daten die Standardfrist", () => {
    expect(rechnungsDaten({ status: "draft", invoice_date: null, due_date: null }, 30, heute))
      .toEqual({ invoiceDate: "2026-10-20", dueDate: "2026-11-19" });
    expect(rechnungsDaten({ status: "draft" }, 14, heute).dueDate).toBe("2026-11-03");
  });
  it("korrigiert ein Fälligkeitsdatum vor dem Rechnungsdatum", () => {
    expect(rechnungsDaten({ status: "draft", invoice_date: "2026-10-10", due_date: "2026-10-01" }, 30, heute).dueDate).toBe("2026-11-19");
  });
  it("gibt bei fehlenden Daten einer gesendeten Rechnung leere Texte zurück", () => {
    expect(rechnungsDaten({ status: "open" }, 30, heute)).toEqual({ invoiceDate: "", dueDate: "" });
  });
});
