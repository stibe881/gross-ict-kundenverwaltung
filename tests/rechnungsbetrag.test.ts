import { describe, expect, it } from "vitest";
import { rechnungsbetrag } from "../supabase/functions/_shared/rechnungsbetrag";

describe("Gesamtbetrag der Rechnung", () => {
  it("nimmt die Summe der Positionen, nicht das abweichende DB-Feld (Fall RE-2026-034)", () => {
    expect(rechnungsbetrag({ total: 529.25, items: [{ total: 472.5 }, { total: 52.5 }] })).toBe(525);
  });
  it("fällt ohne Positionen auf das DB-Feld zurück", () => {
    expect(rechnungsbetrag({ total: 100, items: [] })).toBe(100);
    expect(rechnungsbetrag({ total: "80.5" })).toBe(80.5);
  });
  it("verträgt fehlende und textliche Werte", () => {
    expect(rechnungsbetrag({ total: null, items: [{ total: "12.50" }, { total: null }] })).toBe(12.5);
    expect(rechnungsbetrag({})).toBe(0);
  });
});
