// Akquise-Kampagnen und geprüfte Prospect-Queue (Roadmap Stufe 1).
// Prospects sind recherchierte, noch NICHT freigegebene Firmen. Erst nach
// erfolgter Compliance-Prüfung werden sie als regulärer Lead übernommen.
// Die verbindlichen Regeln (Sperrliste, Freigabe nur bei «allowed») gelten
// zusätzlich in der Datenbank (Migration 20261026).
import { supabase } from "./supabase";
import { createLead } from "./data";
import { normDomain, normTelefon, normEmail, berechneScore } from "./akquise-regeln";
import type { Campaign, Prospect, ComplianceStatus } from "./akquise-regeln";

export * from "./akquise-regeln";

const db = supabase as any;

// ── Kampagnen ────────────────────────────────────────────────────────────

export async function getCampaigns(): Promise<Campaign[]> {
  const { data, error } = await db.from("acquisition_campaigns").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function saveCampaign(id: string | null, werte: Partial<Campaign>): Promise<void> {
  const payload = { ...werte, updated_at: new Date().toISOString() };
  const { error } = id
    ? await db.from("acquisition_campaigns").update(payload).eq("id", id)
    : await db.from("acquisition_campaigns").insert(payload);
  if (error) throw new Error(error.message);
}

export async function deleteCampaign(id: string): Promise<void> {
  const { error } = await db.from("acquisition_campaigns").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ── Prospects ────────────────────────────────────────────────────────────

export async function getProspects(campaignId: string): Promise<Prospect[]> {
  const { data, error } = await db.from("prospects").select("*").eq("campaign_id", campaignId).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

export interface NeuerProspect {
  firma: string;
  domain?: string;
  adresse?: string;
  plz?: string;
  ort?: string;
  kanton?: string;
  branche?: string;
  telefon?: string;
  email?: string;
  ansprechpartner?: string;
  quelle?: string;
  quelle_notiz?: string;
}

export interface ImportErgebnis {
  angelegt: number;
  uebersprungen: { firma: string; grund: string }[];
}

/**
 * Legt Prospects an und überspringt Duplikate gegenüber bestehenden Prospects,
 * Leads und Kunden (Domain, Telefon, E-Mail). Die Sperrliste greift in der Datenbank.
 */
export async function createProspects(campaignId: string, rows: NeuerProspect[], userId?: string): Promise<ImportErgebnis> {
  const [prosp, leads, kunden] = await Promise.all([
    db.from("prospects").select("norm_domain, norm_telefon, norm_email"),
    db.from("leads").select("website, phone, mobile, email"),
    db.from("customers").select("website, phone, email"),
  ]);
  const domains = new Map<string, string>();
  const telefone = new Map<string, string>();
  const emails = new Map<string, string>();
  const merke = (quelle: string, d?: string | null, t?: string | null, e?: string | null) => {
    const nd = normDomain(d), nt = normTelefon(t), ne = normEmail(e);
    if (nd && !domains.has(nd)) domains.set(nd, quelle);
    if (nt && !telefone.has(nt)) telefone.set(nt, quelle);
    if (ne && !emails.has(ne)) emails.set(ne, quelle);
  };
  (prosp.data || []).forEach((p: any) => {
    if (p.norm_domain && !domains.has(p.norm_domain)) domains.set(p.norm_domain, "bereits als Prospect erfasst");
    if (p.norm_telefon && !telefone.has(p.norm_telefon)) telefone.set(p.norm_telefon, "bereits als Prospect erfasst");
    if (p.norm_email && !emails.has(p.norm_email)) emails.set(p.norm_email, "bereits als Prospect erfasst");
  });
  (leads.data || []).forEach((l: any) => { merke("bereits Lead", l.website, l.phone, l.email); merke("bereits Lead", null, l.mobile, null); });
  (kunden.data || []).forEach((c: any) => merke("bereits Kunde", c.website, c.phone, c.email));

  const ergebnis: ImportErgebnis = { angelegt: 0, uebersprungen: [] };
  const imLauf = { d: new Set<string>(), t: new Set<string>(), e: new Set<string>() };

  for (const r of rows) {
    const firma = r.firma?.trim();
    if (!firma) continue;
    const nd = normDomain(r.domain), nt = normTelefon(r.telefon), ne = normEmail(r.email);
    const grund =
      (nd && domains.get(nd)) || (nt && telefone.get(nt)) || (ne && emails.get(ne)) ||
      (nd && imLauf.d.has(nd) && "doppelt in dieser Liste") || (nt && imLauf.t.has(nt) && "doppelt in dieser Liste") || (ne && imLauf.e.has(ne) && "doppelt in dieser Liste") ||
      null;
    if (grund) { ergebnis.uebersprungen.push({ firma, grund }); continue; }

    const { error } = await db.from("prospects").insert({
      campaign_id: campaignId,
      firma,
      domain: r.domain?.trim() || null,
      adresse: r.adresse?.trim() || null,
      plz: r.plz?.trim() || null,
      ort: r.ort?.trim() || null,
      kanton: r.kanton?.trim().toUpperCase() || null,
      branche: r.branche?.trim() || null,
      telefon: r.telefon?.trim() || null,
      email: r.email?.trim() || null,
      ansprechpartner: r.ansprechpartner?.trim() || null,
      quelle: r.quelle?.trim() || "manuell",
      quelle_notiz: r.quelle_notiz?.trim() || null,
      norm_domain: nd,
      norm_telefon: nt,
      norm_email: ne,
      created_by: userId || null,
    });
    if (error) { ergebnis.uebersprungen.push({ firma, grund: error.message }); continue; }
    ergebnis.angelegt++;
    if (nd) imLauf.d.add(nd);
    if (nt) imLauf.t.add(nt);
    if (ne) imLauf.e.add(ne);
  }
  return ergebnis;
}

export async function updateProspect(id: string, werte: Partial<Prospect>): Promise<void> {
  const { error } = await db.from("prospects").update({ ...werte, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteProspect(id: string): Promise<void> {
  const { error } = await db.from("prospects").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ── Compliance ───────────────────────────────────────────────────────────

/** Prüfergebnis festhalten (Nachweis bleibt dauerhaft gespeichert) und am Prospect setzen. */
export async function setzeCompliance(
  p: Prospect,
  status: ComplianceStatus,
  nachweis: { anlass?: string; quelle?: string; notiz?: string },
  userId?: string,
): Promise<void> {
  if (status === "allowed" && (!nachweis.anlass?.trim() || !nachweis.quelle?.trim())) {
    throw new Error("Für «Anruf erlaubt» sind Anlass und Prüfquelle erforderlich (z.B. «lokaler.ch geprüft am …»).");
  }
  const { error: e1 } = await db.from("lead_compliance_checks").insert({
    prospect_id: p.id,
    norm_telefon: normTelefon(p.telefon),
    status,
    anlass: nachweis.anlass?.trim() || null,
    quelle: nachweis.quelle?.trim() || null,
    notiz: nachweis.notiz?.trim() || null,
    geprueft_von: userId || null,
  });
  if (e1) throw new Error(e1.message);
  await updateProspect(p.id, { compliance_status: status, status: p.status === "neu" ? "geprueft" : p.status });
}

/** «Nicht mehr kontaktieren»: dauerhaft auf die Sperrliste, Datenbank sperrt alle Treffer sofort. */
export async function aufSperrlisteSetzen(p: Prospect, grund: string, userId?: string): Promise<void> {
  const { error } = await db.from("do_not_contact").insert({
    norm_telefon: normTelefon(p.telefon),
    norm_email: normEmail(p.email),
    norm_domain: normDomain(p.domain),
    firma: p.firma,
    grund: grund.trim() || "Nicht mehr kontaktieren",
    quelle: "Akquise-Kampagne",
    created_by: userId || null,
  });
  if (error) throw new Error(error.message);
}

// ── Website prüfen (belegt) ──────────────────────────────────────────────

export async function pruefeWebsite(p: Prospect, k: Campaign, userId?: string): Promise<Prospect> {
  if (!p.domain) throw new Error("Für die Website-Prüfung braucht der Prospect eine Domain.");
  const { data, error } = await supabase.functions.invoke("analyze-website", { body: { url: p.domain } });
  if (error) throw new Error(error.message || "Website-Prüfung fehlgeschlagen.");
  if ((data as any)?.error) throw new Error((data as any).error);
  const wc = data as any;
  const abgerufen = new Date().toISOString();

  // Belege festhalten: URL, Zeitpunkt, was gefunden wurde
  const belege: any[] = [];
  const url = wc.url || `https://${p.domain}`;
  const beleg = (feld: string, text: string, vertrauen: "niedrig" | "mittel" | "hoch" = "mittel") =>
    belege.push({ prospect_id: p.id, quelle_url: url, feld, textauszug: text.slice(0, 500), vertrauen, abgerufen_am: abgerufen, created_by: userId || null });
  if (wc.sslValid !== undefined) beleg("HTTPS", wc.sslValid ? "HTTPS erreichbar" : "Kein gültiges HTTPS-Zertifikat", "hoch");
  if (wc.isResponsive !== undefined) beleg("Mobil", wc.isResponsive ? "Viewport-Angabe vorhanden" : "Keine Viewport-Angabe (Hinweis auf fehlende Mobil-Optimierung)", "mittel");
  if (wc.hasImpressum !== undefined) beleg("Impressum", wc.hasImpressum ? "Impressum gefunden" : "Kein Impressum gefunden", "mittel");
  if (wc.hasPrivacy !== undefined) beleg("Datenschutz", wc.hasPrivacy ? "Datenschutzerklärung gefunden" : "Keine Datenschutzerklärung gefunden", "mittel");
  if (belege.length) await db.from("prospect_evidence").insert(belege);

  const aktualisiert: Prospect = { ...p, web_check: { ...wc, abgerufen_am: abgerufen } };
  const { score, begruendung } = berechneScore(aktualisiert, k);
  await updateProspect(p.id, { web_check: aktualisiert.web_check, score, score_begruendung: begruendung } as any);
  return { ...aktualisiert, score, score_begruendung: begruendung };
}

export async function getEvidence(prospectId: string): Promise<any[]> {
  const { data } = await db.from("prospect_evidence").select("*").eq("prospect_id", prospectId).order("abgerufen_am", { ascending: false });
  return data || [];
}

// ── Übernahme als Lead ───────────────────────────────────────────────────

export async function alsLeadUebernehmen(p: Prospect, k: Campaign): Promise<string> {
  if (p.lead_id) throw new Error("Dieser Prospect wurde bereits als Lead übernommen.");
  if (p.compliance_status !== "allowed") throw new Error("Übernahme nur nach erfolgter Compliance-Prüfung («Anruf erlaubt»).");
  if (p.status !== "freigegeben") throw new Error("Bitte den Prospect zuerst freigeben.");

  const notizen = [
    `Kampagne: ${k.name}`,
    p.quelle ? `Quelle: ${p.quelle}${p.quelle_notiz ? ` (${p.quelle_notiz})` : ""}` : "",
    p.score != null ? `Score: ${p.score}/100` : "",
    ...(p.score_begruendung || []),
    k.call_ziel ? `Ziel des Anrufs: ${k.call_ziel}` : "",
  ].filter(Boolean).join("\n");

  const lead = await createLead({
    name: p.ansprechpartner || p.firma,
    company: p.firma,
    email: p.email || undefined,
    phone: p.telefon || undefined,
    website: p.domain || undefined,
    address: p.adresse || undefined,
    zip: p.plz || undefined,
    city: p.ort || undefined,
    status: "new",
    priority: (p.score ?? 0) >= 60 ? "high" : (p.score ?? 0) >= 30 ? "medium" : "low",
    source: "kampagne",
    notes: notizen,
    value: 0,
  });
  await updateProspect(p.id, { lead_id: lead.id, status: "uebernommen" });
  return lead.id;
}
