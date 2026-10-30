import { describe, expect, it } from "vitest";
import { istVollBezahlt } from "../lib/format";

describe("Rechnung vollständig bezahlt", () => {
  it("rechnet mit dem Betrag aus den Positionen, nicht mit dem veralteten DB-Feld", () => {
    // DB-Feld total ist veraltet (56.75), die Positionen ergeben 52.50 und wurden bezahlt
    expect(istVollBezahlt({ total: 56.75, items: [{ total: 52.5 }] }, 52.5)).toBe(true);
  });
  it("nimmt das DB-Feld, wenn keine Positionen vorhanden sind", () => {
    expect(istVollBezahlt({ total: 100, items: [] }, 100)).toBe(true);
    expect(istVollBezahlt({ total: 100 }, 99.99)).toBe(false);
  });
  it("erkennt Teilzahlungen als nicht vollständig", () => {
    expect(istVollBezahlt({ items: [{ total: 60 }, { total: 52.5 }] }, 60)).toBe(false);
    expect(istVollBezahlt({ items: [{ total: 60 }, { total: 52.5 }] }, 112.5)).toBe(true);
  });
  it("verträgt Rundungsabweichungen von einem halben Rappen", () => {
    expect(istVollBezahlt({ items: [{ total: 112.5 }] }, 112.496)).toBe(true);
  });
  it("gilt eine Rechnung über 0 nicht als bezahlt", () => {
    expect(istVollBezahlt({ total: 0, items: [] }, 0)).toBe(false);
  });
});
