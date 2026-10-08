import { describe, expect, it } from "vitest";
import { normDomain, normEmail, normTelefon, berechneScore } from "../lib/akquise-regeln";
import type { Campaign, Prospect } from "../lib/akquise-regeln";

describe("Normalisierung (Grundlage von Duplikat- und Sperrlistenprüfung)", () => {
  it("bringt Domains auf eine vergleichbare Form", () => {
    expect(normDomain("https://www.Muster-AG.ch/kontakt?x=1")).toBe("muster-ag.ch");
    expect(normDomain("muster-ag.ch")).toBe("muster-ag.ch");
    expect(normDomain("http://muster-ag.ch:8080/")).toBe("muster-ag.ch");
    expect(normDomain("kein domain")).toBeNull();
    expect(normDomain("")).toBeNull();
    expect(normDomain(null)).toBeNull();
  });

  it("vergleicht Schweizer Telefonnummern unabhängig von der Schreibweise", () => {
    const gleich = ["041 562 34 16", "+41 41 562 34 16", "0041 41 562 34 16", "041/562.34.16", "(041) 562 34 16"];
    for (const nr of gleich) expect(normTelefon(nr)).toBe("41415623416");
  });

  it("verwirft zu kurze oder leere Nummern", () => {
    expect(normTelefon("123")).toBeNull();
    expect(normTelefon("")).toBeNull();
    expect(normTelefon(undefined)).toBeNull();
  });

  it("normalisiert E-Mail-Adressen", () => {
    expect(normEmail("  Info@Muster-AG.ch ")).toBe("info@muster-ag.ch");
    expect(normEmail("keine-mail")).toBeNull();
  });
});

describe("Score (erklärbar)", () => {
  const kampagne = { kantone: ["LU", "ZG"], branchen: ["Sanitär", "Heizung"] } as Campaign;
  const basis = {
    kanton: null, branche: null, domain: null, telefon: null, email: null, web_check: null,
  } as unknown as Prospect;

  it("gibt für jeden Punkt eine Begründung aus und summiert", () => {
    const p = { ...basis, kanton: "LU", branche: "sanitär", domain: "x.ch", telefon: "041 000 00 00", email: "a@x.ch",
      web_check: { priority: "high", sslValid: false } } as Prospect;
    const { score, begruendung } = berechneScore(p, kampagne);
    expect(score).toBe(15 + 10 + 10 + 20 + 5 + 5 + 5);
    expect(begruendung).toHaveLength(7);
    expect(begruendung.every((z) => z.startsWith("+"))).toBe(true);
  });

  it("zählt Punkte nur für belegte Eigenschaften", () => {
    expect(berechneScore(basis, kampagne)).toEqual({ score: 0, begruendung: [] });
  });

  it("ist auf 100 begrenzt", () => {
    const grosse = { kantone: ["LU"], branchen: ["a"] } as Campaign;
    const p = { ...basis, kanton: "LU", branche: "a", domain: "x.ch", telefon: "0415623416", email: "a@x.ch", web_check: { priority: "high", sslValid: false } } as Prospect;
    expect(berechneScore(p, grosse).score).toBeLessThanOrEqual(100);
  });
});
