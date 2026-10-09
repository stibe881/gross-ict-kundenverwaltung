// Akquise-Kampagnen und geprüfte Prospect-Queue (Roadmap Stufe 1).
// Prospects sind recherchierte, noch NICHT freigegebene Firmen. Erst nach
// erfolgter Compliance-Prüfung werden sie als regulärer Lead übernommen.
// Die verbindlichen Regeln (Sperrliste, Freigabe nur bei «allowed») gelten
// zusätzlich in der Datenbank (Migration 20261026).
import { supabase } from "./supabase";
import { createLead, saveLeadWebCheck, addLeadActivity } from "./data";
import { normDomain, normTelefon, normEmail, berechneScore, befundAlsText, gebietAusEingabe, quelleText, istBrauchbarerName, istBotSeitenTitel, istVerzeichnisDomain } from "./akquise-regeln";
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
    firma: p.firma || null,
    grund: grund.trim() || "Nicht mehr kontaktieren",
    quelle: "Akquise-Kampagne",
    created_by: userId || null,
  });
  if (error) throw new Error(error.message);
}

// ── Website prüfen (belegt) ──────────────────────────────────────────────

/** Ruft die Website-Analyse auf (Impressum, Datenschutz, Barrierefreiheit, Alter, Kontaktdaten). */
async function analysiere(ziel: string): Promise<any> {
  const { data, error } = await supabase.functions.invoke("analyze-website", { body: { url: ziel } });
  if (error) {
    let text = error.message;
    try { const j = await (error as any).context?.json?.(); if (j?.error) text = j.error; } catch {}
    throw new Error(text || "Website-Prüfung fehlgeschlagen.");
  }
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as any;
}

/** Speichert Befund, Belege und Score; setzt «neu» auf «geprüft». `extra` = gleichzeitig zu speichernde Firmendaten. */
async function webergebnisSpeichern(p: Prospect, k: Campaign, wc: any, ziel: string, userId?: string, extra: Partial<Prospect> = {}): Promise<Prospect> {
  const abgerufen = new Date().toISOString();

  // Belege festhalten: URL, Zeitpunkt, was gefunden wurde
  const belege: any[] = [];
  const url = wc.url || `https://${ziel}`;
  const beleg = (feld: string, text: string, vertrauen: "niedrig" | "mittel" | "hoch" = "mittel") =>
    belege.push({ prospect_id: p.id, quelle_url: url, feld, textauszug: text.slice(0, 500), vertrauen, abgerufen_am: abgerufen, created_by: userId || null });
  if (wc.sslValid !== undefined) beleg("HTTPS", wc.sslValid ? "HTTPS erreichbar" : "Kein gültiges HTTPS-Zertifikat", "hoch");
  if (wc.isResponsive !== undefined) beleg("Mobil", wc.isResponsive ? "Viewport-Angabe vorhanden" : "Keine Viewport-Angabe (Hinweis auf fehlende Mobil-Optimierung)", "mittel");
  if (wc.hasImpressum !== undefined) beleg("Impressum", wc.hasImpressum ? "Impressum gefunden" : "Kein Impressum gefunden", "mittel");
  if (wc.hasPrivacy !== undefined) beleg("Datenschutz", wc.hasPrivacy ? "Datenschutzerklärung gefunden" : "Keine Datenschutzerklärung gefunden", "mittel");
  if (wc.outdated !== undefined) beleg("Aktualität", wc.outdated ? `Wirkt veraltet: ${(wc.outdatedHints || []).join("; ")}` : "Keine Anzeichen für einen veralteten Stand", "niedrig");
  if (wc.wcagOk !== undefined) beleg("Barrierefreiheit", wc.wcagOk ? "Keine Auffälligkeiten (automatische Prüfung)" : `Mängel: ${(wc.wcagHints || []).join("; ")}`, "niedrig");
  if (belege.length) await db.from("prospect_evidence").insert(belege);

  const status = p.status === "neu" ? "geprueft" : p.status;
  const aktualisiert: Prospect = { ...p, ...extra, status, web_check: { ...wc, abgerufen_am: abgerufen } } as Prospect;
  const { score, begruendung } = berechneScore(aktualisiert, k);
  await updateProspect(p.id, { ...extra, status, web_check: aktualisiert.web_check, score, score_begruendung: begruendung } as any);
  return { ...aktualisiert, score, score_begruendung: begruendung };
}

export async function pruefeWebsite(p: Prospect, k: Campaign, userId?: string): Promise<Prospect> {
  let ziel = p.domain;
  if (!ziel && p.google_place_id) {
    // Website-Adresse nur für diesen Abruf live bei Google holen (wird nicht gespeichert)
    ziel = (await placeDetails(p.google_place_id)).website || null;
  }
  if (!ziel) throw new Error("Für die Website-Prüfung ist keine Website bekannt.");
  return webergebnisSpeichern(p, k, await analysiere(ziel), ziel, userId);
}

export async function getEvidence(prospectId: string): Promise<any[]> {
  const { data } = await db.from("prospect_evidence").select("*").eq("prospect_id", prospectId).order("abgerufen_am", { ascending: false });
  return data || [];
}

// ── Übernahme als Lead ───────────────────────────────────────────────────

/**
 * Übernimmt einen Prospect mit einem Klick als Lead — mit allen vorhandenen Infos:
 * holt bei Google-Prospects zuerst die Firmendaten von der Firmenwebsite, prüft die
 * Website (falls noch nicht geschehen) und legt den Lead samt Befund, Score und
 * Verkaufs-Tipp an. Einziges Hindernis: die Sperrliste.
 */
export async function alsLeadUebernehmen(p: Prospect, k: Campaign, userId?: string): Promise<string> {
  if (p.lead_id) throw new Error("Dieser Prospect wurde bereits als Lead übernommen.");
  if (p.compliance_status.startsWith("blocked")) throw new Error("Diese Firma steht auf der Sperrliste und kann nicht übernommen werden.");

  // 1) Fehlt der Befund oder der Firmenname (Google-Eintrag), zuerst wie bei «Website prüfen» vorgehen:
  //    holt Firmendaten von der Firmenwebsite, prüft sie — oder stellt fest, dass es keine gibt.
  let webHinweis = "";
  const brauchtPruefung = !p.web_check || (!!p.google_place_id && !istBrauchbarerName(p.firma) && !p.web_check?.keineWebsite);
  // (Ein manueller Prospect ohne Website-Angabe wird nicht automatisch als «ohne Website» gewertet)
  if (brauchtPruefung && (p.domain || p.google_place_id)) {
    let r: { hinweis: string | null; prospect: Prospect } | null = null;
    try { r = await pruefeProspect(p, k, userId); }
    catch (e: any) {
      // Ohne Firmennamen lässt sich kein Lead anlegen; sonst ist die Prüfung nur ein Zusatz
      if (p.google_place_id && !istBrauchbarerName(p.firma)) throw e;
      webHinweis = `Website konnte nicht geprüft werden: ${e.message}`;
    }
    if (r?.hinweis) throw new Error(`${r.hinweis}. Es wurde kein neuer Lead angelegt.`);
    if (r) p = r.prospect;
  }

  const keineWebsite = !!p.web_check?.keineWebsite;
  const firma = p.firma;
  if (!istBrauchbarerName(firma)) {
    throw new Error(keineWebsite
      ? "Diese Firma hat keine eigene Website, daher gibt es keine automatischen Firmendaten. Bitte zuerst «Daten ergänzen» (Name und Telefon sehen Sie mit «Name anzeigen»)."
      : "Es fehlt der Firmenname. Bitte den Prospect ergänzen.");
  }

  // 3) Lead anlegen — mit allen Infos
  const wc = p.web_check as any;
  const befund = befundAlsText(wc);
  const notizen = [
    `Kampagne: ${k.name}`,
    p.quelle ? `Quelle: ${quelleText(p)}` : "",
    p.branche ? `Branche: ${p.branche}` : "",
    p.score != null ? `Score: ${p.score}/100` : "",
    ...(p.score_begruendung || []),
    keineWebsite ? "\nAusgangslage: Die Firma hat keine eigene Website — Ansatz: kompletter Webauftritt aus einer Hand." : "",
    befund ? `\nWebsite-Befund:\n${befund}` : "",
    webHinweis,
    wc?.notes && !String(wc.notes).includes("Bot-Schutz") ? `\n${wc.notes}` : "",
    k.call_ziel ? `\nZiel des Anrufs: ${k.call_ziel}` : "",
  ].filter(Boolean).join("\n");

  const prio = ["high", "medium", "low"].includes(wc?.priority)
    ? wc.priority
    : (p.score ?? 0) >= 60 ? "high" : (p.score ?? 0) >= 30 ? "medium" : "low";

  const lead = await createLead({
    name: p.ansprechpartner || firma,
    company: firma,
    email: p.email || undefined,
    phone: p.telefon || undefined,
    website: p.domain || undefined,
    address: p.adresse || undefined,
    zip: p.plz || undefined,
    city: p.ort || undefined,
    status: "new",
    priority: prio,
    source: "kampagne",
    notes: notizen,
    value: 0,
  });
  await updateProspect(p.id, { lead_id: lead.id, status: "uebernommen" });

  // 4) Nebenwirkungen, die den Lead ergänzen — Fehler hier sind nicht kritisch
  if (wc && !wc.keineWebsite && !wc.notes?.includes?.("Bot-Schutz")) await saveLeadWebCheck(lead.id, wc);
  try {
    await addLeadActivity({
      lead_id: lead.id, type: "system", user_name: "System",
      content: `Aus Kampagne «${k.name}» übernommen${p.score != null ? ` (Score ${p.score}/100)` : ""}.`,
    });
  } catch { /* Verlauf ist optional */ }
  return lead.id;
}

// ── Google Places (Places API (New)) ─────────────────────────────────────
// Richtlinie von Google: Inhalte der Places API dürfen nicht gespeichert werden,
// ausser der place_id. Treffer, Details und die Website-Adresse werden darum nur
// live abgefragt und angezeigt. In der Datenbank steht ausschliesslich die place_id.

export interface PlaceEintrag {
  placeId: string;
  name: string;
  adresse: string;
  telefon: string;
  website: string;
  mapsUrl: string;
  bereitsVorgemerkt?: boolean;
}

async function placesAufruf(body: Record<string, unknown>): Promise<any> {
  const { data, error } = await supabase.functions.invoke("places-recherche", { body });
  if (error) {
    // Fehlertext der Function (z.B. fehlender API-Schlüssel) sichtbar machen
    let text = error.message;
    try { const j = await (error as any).context?.json?.(); if (j?.error) text = j.error; } catch {}
    throw new Error(text || "Places-Recherche fehlgeschlagen.");
  }
  if ((data as any)?.error) throw new Error((data as any).error);
  return data;
}

export interface SuchGebiet {
  /** Eingabe «Ort oder PLZ», z.B. «Zell LU» oder «6144, 6260» */
  eingabe: string;
  /** Umkreis in km; leer oder 0 = nur dieser Ort / diese PLZ */
  radiusKm: number;
  /** Mittelpunkt aus der ersten Seite, damit Folgeseiten nicht erneut suchen */
  zentrum?: { lat: number; lng: number } | null;
}

export interface PlacesSeite {
  treffer: PlaceEintrag[];
  nextPageToken: string | null;
  /** Anzahl Treffer dieser Seite, die ausserhalb des Gebiets lagen und ausgeblendet wurden */
  ausgeblendet: number;
  zentrum: { lat: number; lng: number } | null;
}

export async function placesSuchen(textQuery: string, campaignId: string, gebiet: SuchGebiet, pageToken?: string): Promise<PlacesSeite> {
  const { plz, ort } = gebietAusEingabe(gebiet.eingabe);
  return placesAufruf({
    action: "suche", textQuery, campaignId, pageToken,
    gebiet: { plz, ort, radiusKm: gebiet.radiusKm > 0 ? gebiet.radiusKm : 0, zentrum: gebiet.zentrum ?? undefined },
  });
}

export async function placeDetails(placeId: string): Promise<PlaceEintrag> {
  return (await placesAufruf({ action: "details", placeId })).eintrag;
}

/** Merkt einen Google-Eintrag vor — gespeichert wird NUR die place_id. */
export async function placeVormerken(campaignId: string, placeId: string, userId?: string): Promise<Prospect> {
  const { data, error } = await db.from("prospects").insert({
    campaign_id: campaignId,
    google_place_id: placeId,
    firma: null,
    quelle: "google_places",
    quelle_notiz: "Google Places — nur die place_id ist gespeichert",
    created_by: userId || null,
  }).select().single();
  if (error) {
    if (error.code === "23505") throw new Error("Dieser Google-Eintrag ist in der Kampagne bereits vorgemerkt.");
    throw new Error(error.message);
  }
  return data as Prospect;
}

/** Hält fest, dass eine Firma keine eigene Website hat — für eine Webagentur der beste Fall (Score +40). */
async function keineWebsiteSpeichern(p: Prospect, k: Campaign, grund: string, userId?: string): Promise<Prospect> {
  const abgerufen = new Date().toISOString();
  await db.from("prospect_evidence").insert({
    prospect_id: p.id, quelle_url: null, feld: "Website", textauszug: grund.slice(0, 500),
    vertrauen: "mittel", abgerufen_am: abgerufen, created_by: userId || null,
  });
  // Eine gespeicherte Verzeichnis-Adresse (z.B. local.ch) ist keine eigene Website und wird entfernt
  const extra: Partial<Prospect> & Record<string, any> = istVerzeichnisDomain(p.domain) ? { domain: null, norm_domain: null } : {};
  const status = p.status === "neu" ? "geprueft" : p.status;
  const web_check = { keineWebsite: true, grund, priority: "high", abgerufen_am: abgerufen };
  const aktualisiert = { ...p, ...extra, status, web_check } as Prospect;
  const { score, begruendung } = berechneScore(aktualisiert, k);
  await updateProspect(p.id, { ...extra, status, web_check, score, score_begruendung: begruendung } as any);
  return { ...aktualisiert, score, score_begruendung: begruendung };
}

/**
 * Prüft die Website eines Prospects. Bei einem Google-Eintrag ohne Firmendaten holt dieselbe
 * Analyse zugleich Firmenname, Telefon, E-Mail und Adresse von der Firmenwebsite — damit die
 * Karte erkennbar macht, um welche Firma es geht. «hinweis» meldet ein mögliches Duplikat.
 * Hat die Firma keine eigene Website (oder nur ein Verzeichnis-/Social-Media-Profil), ist das
 * kein Fehler, sondern eine Verkaufschance und wird als solche gespeichert.
 */
export async function pruefeProspect(p: Prospect, k: Campaign, userId?: string): Promise<{ hinweis: string | null; prospect: Prospect }> {
  const braucheName = !!p.google_place_id && !istBrauchbarerName(p.firma);

  if (p.google_place_id) {
    // Die Website-Adresse eines Google-Eintrags gibt es nur live (wird nicht gespeichert)
    let eintrag: PlaceEintrag | undefined;
    if (!p.domain || istVerzeichnisDomain(p.domain) || braucheName) eintrag = await placeDetails(p.google_place_id);
    const adresse = eintrag ? eintrag.website : p.domain;
    if (!adresse || istVerzeichnisDomain(adresse)) {
      const grund = !adresse
        ? "Der Google-Eintrag nennt keine Website"
        : `Nur ein Verzeichnis- oder Social-Media-Eintrag (${normDomain(adresse)}), keine eigene Website`;
      return { hinweis: null, prospect: await keineWebsiteSpeichern(p, k, grund, userId) };
    }
    if (braucheName) return datenVonWebsiteUebernehmen(p, k, userId, eintrag);
  } else if (!p.domain) {
    return { hinweis: null, prospect: await keineWebsiteSpeichern(p, k, "Keine Website bekannt (bei der Erfassung nicht angegeben)", userId) };
  }
  return { hinweis: null, prospect: await pruefeWebsite(p, k, userId) };
}

export interface ProspektDaten {
  firma: string; ansprechpartner: string; telefon: string; email: string;
  adresse: string; plz: string; ort: string; branche: string;
}

/** Firmendaten von Hand ergänzen oder korrigieren (z.B. bei Firmen ohne eigene Website). */
export async function ergaenzeDaten(p: Prospect, k: Campaign, w: ProspektDaten): Promise<void> {
  const v = (x: string) => x.trim() || null;
  const werte: Partial<Prospect> & Record<string, any> = {
    firma: v(w.firma), ansprechpartner: v(w.ansprechpartner), telefon: v(w.telefon), email: v(w.email),
    adresse: v(w.adresse), plz: v(w.plz), ort: v(w.ort), branche: v(w.branche),
  };
  if (!werte.firma && !p.google_place_id) throw new Error("Bitte einen Firmennamen angeben.");
  werte.norm_telefon = normTelefon(werte.telefon);
  werte.norm_email = normEmail(werte.email);
  const { score, begruendung } = berechneScore({ ...p, ...werte } as Prospect, k);
  await updateProspect(p.id, { ...werte, score, score_begruendung: begruendung } as any);
}

/**
 * Holt Firmenname, Telefon, E-Mail und Adresse von der EIGENEN Website der Firma
 * (Impressum/Kontakt), nicht aus Google. Die Website-Adresse wird dafür live bei
 * Google abgefragt und nur für diesen Abruf verwendet.
 */
export async function datenVonWebsiteUebernehmen(p: Prospect, k: Campaign, userId?: string, vorab?: PlaceEintrag): Promise<{ hinweis: string | null; prospect: Prospect }> {
  if (!p.google_place_id) throw new Error("Nur für Google-Prospects.");
  const eintrag = vorab ?? await placeDetails(p.google_place_id);
  if (!eintrag.website) throw new Error("Zu diesem Google-Eintrag ist keine Website bekannt — bitte Firmendaten von Hand erfassen.");
  // Verweist der Google-Eintrag nur auf ein Verzeichnis oder Social-Media-Profil, gibt es keine eigene Firmenwebsite
  if (istVerzeichnisDomain(eintrag.website)) {
    throw new Error(`Der Google-Eintrag verweist nur auf ${normDomain(eintrag.website)} (Verzeichnis oder Social Media), nicht auf eine eigene Firmenwebsite. Bitte die Firmendaten von Hand erfassen.`);
  }
  const wc = await analysiere(eintrag.website);
  if ((typeof wc.notes === "string" && wc.notes.includes("Bot-Schutz")) || istBotSeitenTitel(wc.title)) {
    throw new Error(`Die Website ${normDomain(eintrag.website)} blockt automatische Abfragen (Bot-Schutz). Die Firmendaten bitte von Hand erfassen.`);
  }

  const werte: Partial<Prospect> & Record<string, any> = {
    firma: wc.title || p.firma || null,
    telefon: wc.phone || p.telefon || null,
    email: wc.email || p.email || null,
    adresse: wc.address || p.adresse || null,
    plz: wc.zip || p.plz || null,
    ort: wc.city || p.ort || null,
    domain: normDomain(wc.url) || normDomain(eintrag.website),
    quelle_notiz: "Google Places (place_id); Firmendaten von der Firmenwebsite",
  };
  werte.norm_domain = normDomain(werte.domain);
  werte.norm_telefon = normTelefon(werte.telefon);
  werte.norm_email = normEmail(werte.email);
  // Findet die Analyse keinen Firmennamen, dient die Domain als Anzeigename (lässt sich von Hand ändern)
  if (!werte.firma) werte.firma = werte.domain || null;
  if (!werte.firma) throw new Error("Auf der Website wurde kein Firmenname gefunden — bitte von Hand ergänzen.");

  // Mögliche Duplikate zu Leads und Kunden anzeigen (nicht blockieren)
  const hinweise: string[] = [];
  const [l, c] = await Promise.all([
    db.from("leads").select("company, website, phone, email"),
    db.from("customers").select("company_name, website, phone, email"),
  ]);
  for (const x of l.data || []) {
    if ((werte.norm_domain && normDomain(x.website) === werte.norm_domain) || (werte.norm_telefon && normTelefon(x.phone) === werte.norm_telefon) || (werte.norm_email && normEmail(x.email) === werte.norm_email)) {
      hinweise.push(`bereits Lead «${x.company || "?"}»`); break;
    }
  }
  for (const x of c.data || []) {
    if ((werte.norm_domain && normDomain(x.website) === werte.norm_domain) || (werte.norm_telefon && normTelefon(x.phone) === werte.norm_telefon) || (werte.norm_email && normEmail(x.email) === werte.norm_email)) {
      hinweise.push(`bereits Kunde «${x.company_name || "?"}»`); break;
    }
  }
  // Firmendaten UND Prüfergebnis in einem Zug speichern — die Analyse lief ja bereits
  const prospect = await webergebnisSpeichern(p, k, wc, eintrag.website, userId, werte as any);
  return { hinweis: hinweise.length ? "Mögliches Duplikat: " + hinweise.join(", ") : null, prospect };
}
