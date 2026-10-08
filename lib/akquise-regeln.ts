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
  firma: string;
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

