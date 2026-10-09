// Reine Regeln der Akquise-Kampagnen (ohne Datenbankzugriff, daher testbar):
// Typen, Normalisierung von Domain/Telefon/E-Mail und der erklärbare Score.

// ── Typen ────────────────────────────────────────────────────────────────

export type ComplianceStatus =
  | "pending_review"
  | "allowed"
  | "blocked_star_or_unlisted"
  | "blocked_do_not_contact"
  | "blocked_other";

export type ProspectStatus = "neu" | "geprueft" | "freigegeben" | "verworfen" | "uebernommen";

export interface Campaign {
  id: string;
  name: string;
  status: "entwurf" | "aktiv" | "pausiert" | "abgeschlossen";
  kantone: string[];
  plz_liste: string | null;
  radius_km: number | null;
  branchen: string[];
  angebotsprofil: string | null;
  call_ziel: string | null;
  ausschluesse: string | null;
  created_at: string;
}

export interface Prospect {
  id: string;
  campaign_id: string;
  firma: string | null;
  google_place_id: string | null;
  domain: string | null;
  adresse: string | null;
  plz: string | null;
  ort: string | null;
  kanton: string | null;
  branche: string | null;
  telefon: string | null;
  email: string | null;
  ansprechpartner: string | null;
  quelle: string;
  quelle_notiz: string | null;
  status: ProspectStatus;
  compliance_status: ComplianceStatus;
  web_check: any | null;
  score: number | null;
  score_begruendung: string[] | null;
  lead_id: string | null;
  created_at: string;
}

export const COMPLIANCE_LABEL: Record<ComplianceStatus, string> = {
  pending_review: "Noch nicht geprüft",
  allowed: "Anruf erlaubt",
  blocked_star_or_unlisted: "Gesperrt (Sterneintrag/kein Eintrag)",
  blocked_do_not_contact: "Gesperrt (nicht kontaktieren)",
  blocked_other: "Gesperrt (anderer Grund)",
};

export const SCHWEIZER_KANTONE = [
  "AG", "AI", "AR", "BE", "BL", "BS", "FR", "GE", "GL", "GR", "JU", "LU", "NE",
  "NW", "OW", "SG", "SH", "SO", "SZ", "TG", "TI", "UR", "VD", "VS", "ZG", "ZH",
];

// ── Normalisierung (Grundlage der Duplikat- und Sperrlisten-Prüfung) ───────

export function normDomain(eingabe?: string | null): string | null {
  if (!eingabe) return null;
  const d = eingabe.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0].replace(/:\d+$/, "");
  return d && d.includes(".") ? d : null;
}

/** Schweizer Telefonnummern in eine vergleichbare Form bringen (nur Ziffern, Landesvorwahl 41). */
export function normTelefon(eingabe?: string | null): string | null {
  if (!eingabe) return null;
  let z = eingabe.replace(/[^\d+]/g, "");
  if (!z) return null;
  if (z.startsWith("+")) z = z.slice(1);
  else if (z.startsWith("00")) z = z.slice(2);
  else if (z.startsWith("0")) z = "41" + z.slice(1);
  return z.length >= 9 ? z : null;
}

export function normEmail(eingabe?: string | null): string | null {
  const e = eingabe?.trim().toLowerCase();
  return e && e.includes("@") ? e : null;
}

// ── Score (erklärbar) ────────────────────────────────────────────────────

export function berechneScore(p: Prospect, k: Campaign): { score: number; begruendung: string[] } {
  const b: string[] = [];
  let s = 0;
  const add = (punkte: number, text: string) => { s += punkte; b.push(`+${punkte}: ${text}`); };
  if (p.kanton && k.kantone.includes(p.kanton)) add(15, `Standort im Zielgebiet (${p.kanton})`);
  if (p.branche && k.branchen.some((x) => x.toLowerCase() === p.branche!.toLowerCase())) add(10, `Zielbranche (${p.branche})`);
  if (p.domain) add(10, "Firmenwebsite vorhanden");
  const wc = p.web_check;
  if (wc) {
    if (wc.priority === "high") add(20, "Website zeigt deutlichen Verbesserungsbedarf");
    else if (wc.priority === "medium") add(10, "Website zeigt einigen Verbesserungsbedarf");
    if (wc.sslValid === false) add(5, "Website ohne gültiges HTTPS-Zertifikat");
  }
  if (p.telefon) add(5, "Telefonnummer vorhanden");
  if (p.email) add(5, "E-Mail-Adresse vorhanden");
  return { score: Math.min(100, s), begruendung: b };
}


// ── Befund der Website-Prüfung (für die Anzeige auf der Karte) ──────────────

export interface BefundZeile {
  label: string;
  /** true = in Ordnung, false = Mangel, null = nicht beurteilbar */
  ok: boolean | null;
  text: string;
}

/** Übersetzt das gespeicherte Ergebnis der Website-Prüfung in lesbare Zeilen. */
export function webBefund(wc: any): { zeilen: BefundZeile[]; botSchutz: boolean } | null {
  if (!wc || typeof wc !== "object") return null;

  // Bei Bot-Schutz (z.B. Cloudflare) konnte nichts gelesen werden — keine falschen Mängel melden
  if (typeof wc.notes === "string" && wc.notes.includes("Bot-Schutz")) {
    return { botSchutz: true, zeilen: [] };
  }

  const zeilen: BefundZeile[] = [];
  const ja = (v: any) => (v === undefined || v === null ? null : !!v);

  zeilen.push({
    label: "Aktualität",
    ok: wc.outdated === undefined ? null : !wc.outdated,
    text: wc.outdated === undefined
      ? "noch nicht beurteilt — bitte die Website erneut prüfen"
      : wc.outdated
        ? `wirkt veraltet: ${(wc.outdatedHints || []).join("; ")}`
        : wc.copyrightYear ? `keine Anzeichen für einen veralteten Stand (Copyright ${wc.copyrightYear})` : "keine Anzeichen für einen veralteten Stand",
  });
  zeilen.push({ label: "Impressum", ok: ja(wc.hasImpressum), text: wc.hasImpressum === undefined || wc.hasImpressum === null ? "nicht geprüft" : wc.hasImpressum ? "vorhanden" : "fehlt" });
  zeilen.push({ label: "Datenschutzerklärung", ok: ja(wc.hasPrivacy), text: wc.hasPrivacy === undefined || wc.hasPrivacy === null ? "nicht geprüft" : wc.hasPrivacy ? "vorhanden" : "fehlt" });
  zeilen.push({
    label: "Barrierefreiheit",
    ok: ja(wc.wcagOk),
    text: wc.wcagOk === undefined || wc.wcagOk === null
      ? "nicht geprüft"
      : wc.wcagOk
        ? "keine Auffälligkeiten erkannt (automatische Prüfung, ersetzt keinen Test)"
        : `nicht barrierefrei: ${(wc.wcagHints || []).join("; ") || "Mängel erkannt"}`,
  });
  zeilen.push({ label: "Mobil-Ansicht", ok: ja(wc.isResponsive), text: wc.isResponsive === undefined || wc.isResponsive === null ? "nicht geprüft" : wc.isResponsive ? "für Mobilgeräte angepasst" : "nicht für Mobilgeräte angepasst" });
  zeilen.push({ label: "Sichere Verbindung", ok: ja(wc.sslValid), text: wc.sslValid === undefined || wc.sslValid === null ? "nicht geprüft" : wc.sslValid ? "HTTPS gültig" : "kein gültiges HTTPS-Zertifikat" });

  return { zeilen, botSchutz: false };
}

/** Befund als Klartext für die Lead-Notizen («✗ Impressum: fehlt»). Leer, wenn nichts Lesbares vorliegt. */
export function befundAlsText(wc: any): string {
  const b = webBefund(wc);
  if (!b || b.botSchutz) return "";
  const stand = wc?.abgerufen_am ? ` (Stand ${new Date(wc.abgerufen_am).toLocaleDateString("de-CH")})` : "";
  return b.zeilen
    .map((z) => `${z.ok === true ? "✓" : z.ok === false ? "✗" : "–"} ${z.label}: ${z.text}`)
    .join("\n") + (stand ? `\n${stand.trim()}` : "");
}

// ── Eingabe «Ort oder PLZ» der Firmensuche ──────────────────────────────────

/** Eingabefeld «Ort oder PLZ» (z. B. «6144, 6260» oder «Zell LU») in PLZ-Liste und Ortsname zerlegen. */
export function gebietAusEingabe(text: string): { plz: string[]; ort: string } {
  const teile = text.split(/[,;\n]+/).map((t) => t.trim()).filter(Boolean);
  const plz: string[] = [];
  const orte: string[] = [];
  for (const t of teile) {
    const m = t.match(/^(\d{4})(?:\s+(.+))?$/);
    if (m) { plz.push(m[1]); if (m[2]) orte.push(m[2]); }
    else orte.push(t);
  }
  return { plz: [...new Set(plz)].slice(0, 20), ort: orte[0] ?? "" };
}

// ── Anzeige der Quelle, Bot-Seiten und Verzeichnis-Websites ─────────────────

/** Quelle für die Anzeige: bei Google nur «Google Places», sonst Quelle plus Notiz. */
export function quelleText(p: { quelle?: string | null; quelle_notiz?: string | null }): string {
  if (p.quelle === "google_places") return "Google Places";
  return `${p.quelle || "–"}${p.quelle_notiz ? ` (${p.quelle_notiz})` : ""}`;
}

/** Titel der Wartesiten von Bot-Schutz-Diensten («Dein Browser wird geprüft!», «Just a moment…») sind keine Firmennamen. */
export function istBotSeitenTitel(titel: string | null | undefined): boolean {
  if (!titel) return false;
  return /browser wird gepr|überprüfung deines browsers|ueberpruefung|just a moment|checking your browser|attention required|verifying you are human|are you a robot|bist du ein mensch|ein moment geduld|access denied|zugriff verweigert|ddos protection/i.test(titel);
}

/** Ein Name ist brauchbar, wenn er nicht leer ist und nicht von einer Bot-Wartesite stammt. */
export function istBrauchbarerName(name: string | null | undefined): name is string {
  return !!name && name.trim().length > 1 && !istBotSeitenTitel(name);
}

const VERZEICHNIS_DOMAINS = [
  "local.ch", "search.ch", "tel.search.ch", "moneyhouse.ch", "zefix.ch", "firmenverzeichnis.ch",
  "google.com", "google.ch", "goo.gl", "g.page", "maps.app.goo.gl",
  "facebook.com", "instagram.com", "linkedin.com", "xing.com", "twitter.com", "x.com", "youtube.com", "tiktok.com",
  "yelp.com", "tripadvisor.com", "tripadvisor.ch", "booking.com", "ricardo.ch", "homegate.ch",
];

/** True, wenn die Adresse zu einem Verzeichnis oder Social-Media-Profil gehört — keine eigene Firmenwebsite. */
export function istVerzeichnisDomain(adresseOderDomain: string | null | undefined): boolean {
  const d = normDomain(adresseOderDomain);
  if (!d) return false;
  return VERZEICHNIS_DOMAINS.some((v) => d === v || d.endsWith("." + v));
}
