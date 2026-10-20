import { describe, expect, it } from "vitest";
import { parseSchuldner } from "../supabase/functions/_shared/qr-adresse";

const NAME = "Zentrum für Kieferorthopädie & Kinder- und Jugendzahnmedizin AG";

describe("Zahlungspflichtiger der QR-Rechnung", () => {
  it("nimmt Strasse und PLZ Ort aus dem üblichen Adressblock", () => {
    expect(parseSchuldner("Two Wheels Zinsli GmbH", "Two Wheels Zinsli GmbH\nLischmatt 8\n6153 Ufhusen"))
      .toEqual({ name: "Two Wheels Zinsli GmbH", street: "Lischmatt 8", city: "6153 Ufhusen" });
  });
  it("lässt den doppelten Namen und die Länderzeile weg (der gemeldete Fall)", () => {
    const r = parseSchuldner(NAME, `${NAME}\nHauptstrasse 12\n6003 Luzern\nSchweiz`);
    expect(r).toEqual({ name: NAME, street: "Hauptstrasse 12", city: "6003 Luzern" });
  });
  it("kommt auch ohne Strasse zurecht", () => {
    expect(parseSchuldner("Muster AG", "6003 Luzern")).toEqual({ name: "Muster AG", street: undefined, city: "6003 Luzern" });
  });
  it("entfernt ein Länderkürzel vor der PLZ", () => {
    expect(parseSchuldner("Muster AG", "Bahnhofstrasse 1\nCH-6003 Luzern")?.city).toBe("6003 Luzern");
  });
  it("lässt den Zahlungspflichtigen weg, wenn keine PLZ-Ort-Zeile da ist", () => {
    expect(parseSchuldner(NAME, `${NAME}\nSchweiz`)).toBeNull();
    expect(parseSchuldner("Muster AG", "")).toBeNull();
    expect(parseSchuldner(undefined, "6003 Luzern")).toBeNull();
  });
  it("vergleicht Namen ohne Rücksicht auf Gross-/Kleinschreibung und Akzente", () => {
    expect(parseSchuldner("Müller AG", "MULLER AG\nWeg 3\n6000 Luzern")?.street).toBe("Weg 3");
  });
});
