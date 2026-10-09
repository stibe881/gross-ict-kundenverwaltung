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

import { webBefund } from "../lib/akquise-regeln";

describe("Befund der Website-Prüfung", () => {
  it("zeigt Mängel mit Klartext", () => {
    const b = webBefund({
      sslValid: false, hasImpressum: false, hasPrivacy: true, isResponsive: false,
      wcagOk: false, wcagHints: ["3 Bild(er) ohne Alt-Text"],
      outdated: true, outdatedHints: ["Copyright-Vermerk von 2014 (seit 12 Jahren nicht angepasst)"],
    })!;
    const nach = Object.fromEntries(b.zeilen.map((z) => [z.label, z]));
    expect(nach["Impressum"]).toMatchObject({ ok: false, text: "fehlt" });
    expect(nach["Datenschutzerklärung"]).toMatchObject({ ok: true });
    expect(nach["Barrierefreiheit"].text).toContain("nicht barrierefrei: 3 Bild(er) ohne Alt-Text");
    expect(nach["Aktualität"]).toMatchObject({ ok: false });
    expect(nach["Aktualität"].text).toContain("2014");
    expect(nach["Sichere Verbindung"].ok).toBe(false);
  });

  it("meldet bei einer sauberen Seite keine Mängel", () => {
    const b = webBefund({ sslValid: true, hasImpressum: true, hasPrivacy: true, isResponsive: true, wcagOk: true, outdated: false, copyrightYear: 2026 })!;
    expect(b.zeilen.every((z) => z.ok === true)).toBe(true);
  });

  it("kennzeichnet Altstände ohne Alters-Info als nicht beurteilt statt als in Ordnung", () => {
    const b = webBefund({ sslValid: true, hasImpressum: true, hasPrivacy: true, isResponsive: true, wcagOk: true })!;
    expect(b.zeilen.find((z) => z.label === "Aktualität")!.ok).toBeNull();
  });

  it("erfindet bei Bot-Schutz keine Mängel", () => {
    const b = webBefund({ notes: "⚠️ Die Website verwendet einen strikten Bot-Schutz …", hasImpressum: false, hasPrivacy: false })!;
    expect(b).toEqual({ botSchutz: true, zeilen: [] });
  });

  it("gibt ohne Prüfergebnis nichts zurück", () => {
    expect(webBefund(null)).toBeNull();
  });
});

import { befundAlsText } from "../lib/akquise-regeln";

describe("Befund als Text für die Lead-Notizen", () => {
  it("listet jede Zeile mit Haken oder Kreuz", () => {
    const t = befundAlsText({ sslValid: true, hasImpressum: false, hasPrivacy: true, isResponsive: true, wcagOk: false, wcagHints: ["fehlende Sprachangabe"], outdated: false });
    expect(t).toContain("✗ Impressum: fehlt");
    expect(t).toContain("✓ Datenschutzerklärung: vorhanden");
    expect(t).toContain("✗ Barrierefreiheit: nicht barrierefrei: fehlende Sprachangabe");
  });
  it("bleibt bei Bot-Schutz oder ohne Prüfung leer", () => {
    expect(befundAlsText(null)).toBe("");
    expect(befundAlsText({ notes: "Bot-Schutz aktiv" })).toBe("");
  });
});

describe("Befund bei unvollständigen Altdaten", () => {
  it("schreibt «nicht geprüft» statt «fehlt», wenn ein Wert nie ermittelt wurde", () => {
    const b = webBefund({ sslValid: false })!;
    const z = Object.fromEntries(b.zeilen.map((x) => [x.label, x]));
    expect(z["Impressum"]).toMatchObject({ ok: null, text: "nicht geprüft" });
    expect(z["Datenschutzerklärung"].text).toBe("nicht geprüft");
    expect(z["Mobil-Ansicht"].text).toBe("nicht geprüft");
    expect(z["Sichere Verbindung"]).toMatchObject({ ok: false });
  });
});

import { gebietAusEingabe } from "../lib/akquise-regeln";

describe("Eingabe «Ort oder PLZ»", () => {
  it("trennt PLZ und Ortsnamen", () => {
    expect(gebietAusEingabe("6144, 6260")).toEqual({ plz: ["6144", "6260"], ort: "" });
    expect(gebietAusEingabe("Zell LU")).toEqual({ plz: [], ort: "Zell LU" });
    expect(gebietAusEingabe("6144 Zell")).toEqual({ plz: ["6144"], ort: "Zell" });
    expect(gebietAusEingabe("")).toEqual({ plz: [], ort: "" });
  });
});

