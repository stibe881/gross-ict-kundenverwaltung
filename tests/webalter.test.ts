import { describe, expect, it } from "vitest";
import { bewerteAlter } from "../supabase/functions/_shared/webalter";

const jetzt = new Date("2026-10-09");

describe("Alterseinschätzung einer Webseite", () => {
  it("erkennt einen alten Copyright-Vermerk, auch bei Zeiträumen", () => {
    const r = bewerteAlter("<footer>© 2014 Muster AG</footer>", undefined, jetzt);
    expect(r.veraltet).toBe(true);
    expect(r.copyrightJahr).toBe(2014);
    expect(bewerteAlter("<footer>© 2009–2017 Muster</footer>", undefined, jetzt).copyrightJahr).toBe(2017);
    expect(bewerteAlter("&copy; 2012 - 2016 Muster", undefined, jetzt).copyrightJahr).toBe(2016);
  });

  it("wertet ein aktuelles Jahr nicht als veraltet", () => {
    const r = bewerteAlter("<footer>© 2026 Muster AG</footer>", undefined, jetzt);
    expect(r.veraltet).toBe(false);
    expect(r.copyrightJahr).toBe(2026);
    expect(bewerteAlter("© 2024 Muster", undefined, jetzt).veraltet).toBe(false);
  });

  it("nimmt das jüngste Jahr, wenn mehrere Vermerke vorkommen", () => {
    expect(bewerteAlter("© 2011 A … Copyright 2025 B", undefined, jetzt).copyrightJahr).toBe(2025);
  });

  it("erkennt den Last-Modified-Header", () => {
    expect(bewerteAlter("", "Tue, 03 Mar 2015 10:00:00 GMT", jetzt).veraltet).toBe(true);
    expect(bewerteAlter("", "Tue, 03 Mar 2026 10:00:00 GMT", jetzt).veraltet).toBe(false);
    expect(bewerteAlter("", "kein Datum", jetzt).veraltet).toBe(false);
  });

  it("erkennt veraltete Technik", () => {
    expect(bewerteAlter("<marquee>Neu!</marquee>", undefined, jetzt).hinweise.join()).toContain("marquee");
    expect(bewerteAlter("<frameset cols='20%,80%'>", undefined, jetzt).veraltet).toBe(true);
    expect(bewerteAlter('<script src="/js/swfobject.js"></script>', undefined, jetzt).hinweise.join()).toContain("Flash");
    expect(bewerteAlter('<script src="/js/jquery-1.11.3.min.js"></script>', undefined, jetzt).hinweise.join()).toContain("jQuery 1.11");
    expect(bewerteAlter('<script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>', undefined, jetzt).veraltet).toBe(false);
    expect(bewerteAlter('<meta name="generator" content="WordPress 4.9.8" />', undefined, jetzt).veraltet).toBe(true);
    expect(bewerteAlter('<meta name="generator" content="WordPress 6.6" />', undefined, jetzt).veraltet).toBe(false);
    expect(bewerteAlter('<meta name="generator" content="Joomla! - Open Source Content Management 3.9" />', undefined, jetzt).veraltet).toBe(true);
  });

  it("meldet bei einer modernen Seite nichts", () => {
    const r = bewerteAlter("<html><body><footer>© 2026 Muster</footer></body></html>", undefined, jetzt);
    expect(r).toEqual({ veraltet: false, hinweise: [], copyrightJahr: 2026 });
  });
});
