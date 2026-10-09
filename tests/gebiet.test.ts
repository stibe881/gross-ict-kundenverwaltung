import { describe, expect, it } from "vitest";
import {
  entfernungKm, imGebiet, normalisiereOrt, plzOrtAusAdresse, umschliessendesRechteck,
} from "../supabase/functions/_shared/gebiet";

const zell = { plz: ["6144"], ort: "", radiusKm: 0 };

describe("Adresse und Ortsname", () => {
  it("liest PLZ und Ort aus der Google-Adresse", () => {
    expect(plzOrtAusAdresse("Hauptstrasse 1, 6144 Zell LU, Schweiz")).toEqual({ plz: "6144", ort: "Zell LU" });
    expect(plzOrtAusAdresse("keine Adresse")).toBeNull();
  });
  it("vergleicht Orte ohne Kanton, Gross-/Kleinschreibung und Akzente", () => {
    expect(normalisiereOrt("Zell LU")).toBe("zell");
    expect(normalisiereOrt("zell lu")).toBe("zell");
    expect(normalisiereOrt("Zürich")).toBe("zurich");
  });
});

describe("Gebiet ohne Umkreis (Radius leer oder 0)", () => {
  it("lässt nur die genannte PLZ zu", () => {
    expect(imGebiet({ adresse: "Dorfstrasse 3, 6144 Zell LU, Schweiz" }, zell)).toBe(true);
    expect(imGebiet({ adresse: "Bahnhofstrasse 5, 6130 Willisau, Schweiz" }, zell)).toBe(false);
  });
  it("lässt nur den genannten Ort zu — nicht ähnlich klingende", () => {
    const g = { plz: [], ort: "Zell LU", radiusKm: 0 };
    expect(imGebiet({ adresse: "A 1, 6144 Zell LU, Schweiz" }, g)).toBe(true);
    expect(imGebiet({ adresse: "A 1, 8486 Zell ZH, Schweiz" }, g)).toBe(true); // gleicher Name, Kanton nicht erfasst
    expect(imGebiet({ adresse: "A 1, 6130 Willisau, Schweiz" }, g)).toBe(false);
    expect(imGebiet({ adresse: "A 1, 9999 Zellweger, Schweiz" }, g)).toBe(false);
  });
  it("ohne Vorgabe wird nichts herausgefiltert", () => {
    expect(imGebiet({ adresse: "irgendwo" }, { plz: [], ort: "", radiusKm: 0 })).toBe(true);
  });
  it("Treffer ohne lesbare Adresse fallen bei gesetztem Gebiet heraus", () => {
    expect(imGebiet({ adresse: "" }, zell)).toBe(false);
  });
});

describe("Umkreis", () => {
  const luzern = { lat: 47.0502, lng: 8.3093 };
  const g = { plz: ["6003"], ort: "", radiusKm: 10, zentrum: luzern };
  it("misst die Luftlinie", () => {
    const zug = { lat: 47.1724, lng: 8.5176 };
    const d = entfernungKm(luzern, zug);
    expect(d).toBeGreaterThan(18);
    expect(d).toBeLessThan(23);
  });
  it("lässt nahe Treffer zu und weit entfernte nicht", () => {
    expect(imGebiet({ adresse: "x", lat: 47.0466, lng: 8.3258 }, g)).toBe(true);   // Kriens-Nähe
    expect(imGebiet({ adresse: "x", lat: 47.1724, lng: 8.5176 }, g)).toBe(false); // Zug
  });
  it("Treffer ohne Koordinaten fallen bei Umkreissuche heraus", () => {
    expect(imGebiet({ adresse: "6003 Luzern" }, g)).toBe(false);
  });
  it("das Suchrechteck schliesst den Kreis ein", () => {
    const r = umschliessendesRechteck(luzern, 10);
    expect(r.low.latitude).toBeLessThan(luzern.lat - 0.08);
    expect(r.high.longitude).toBeGreaterThan(luzern.lng + 0.1);
  });
});
