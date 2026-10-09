// Gemeinsame Sicherheitsbausteine für Akquise-Functions:
//  1. pruefeMitarbeiter(): erzwingt Anmeldung UND eine Akquise-berechtigte Rolle
//  2. sichererAbruf(): lädt eine fremde Webseite SSRF-sicher (nur http/https auf
//     Standardports, keine privaten/reservierten Adressen, Redirects werden
//     Schritt für Schritt geprüft, Grössen- und Typlimit)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function antwort(status: number, fehler: string): Response {
  return new Response(JSON.stringify({ error: fehler }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const ERLAUBTE_ROLLEN = ["admin", "administration", "akquise"];

/** Gibt eine Fehlerantwort zurück, wenn der Aufrufer nicht berechtigt ist; sonst null. */
export async function pruefeMitarbeiter(req: Request): Promise<{ fehler: Response | null; userId?: string }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return { fehler: antwort(401, "Anmeldung erforderlich.") };

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // In einer Edge Function gibt es keine gespeicherte Sitzung: getUser() ohne Token
  // würde scheitern. Das JWT des Aufrufers wird deshalb ausdrücklich übergeben.
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { fehler: antwort(401, "Anmeldung erforderlich.") };
  const benutzerClient = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authHeader } },
  });
  const { data: u, error } = await benutzerClient.auth.getUser(token);
  if (error || !u?.user) return { fehler: antwort(401, "Anmeldung ungültig oder abgelaufen.") };

  const admin = createClient(url, service);
  // Portal-Kunden sind keine Mitarbeiter
  const { data: portal } = await admin.from("customer_portal_users").select("id").eq("id", u.user.id).maybeSingle();
  if (portal) return { fehler: antwort(403, "Keine Berechtigung.") };

  const { data: profil } = await admin.from("users").select("roles, is_active").eq("id", u.user.id).maybeSingle();
  const rollen: string[] = profil?.roles ?? [];
  if (!profil || profil.is_active === false || !rollen.some((r) => ERLAUBTE_ROLLEN.includes(r))) {
    return { fehler: antwort(403, "Keine Berechtigung für Akquise-Funktionen.") };
  }
  return { fehler: null, userId: u.user.id };
}

// ── SSRF-Schutz ──────────────────────────────────────────────────────────

function ipv4Privat(ip: string): boolean {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
  const [a, b] = p;
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) ||           // Link-Local / Cloud-Metadaten
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224                               // Multicast / reserviert
  );
}

function ipv6Privat(ip: string): boolean {
  const s = ip.toLowerCase();
  if (s === "::" || s === "::1") return true;
  if (s.startsWith("fc") || s.startsWith("fd")) return true;       // Unique Local
  if (s.startsWith("fe8") || s.startsWith("fe9") || s.startsWith("fea") || s.startsWith("feb")) return true; // Link-Local
  const m = s.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);               // IPv4-mapped
  if (m) return ipv4Privat(m[1]);
  return false;
}

function istIpLiteral(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":");
}

async function pruefeHost(host: string): Promise<void> {
  const h = host.toLowerCase().replace(/\.$/, "");
  if (!h || h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".lan")) {
    throw new Error("Adresse nicht erlaubt.");
  }
  if (istIpLiteral(h)) {
    const roh = h.replace(/^\[|\]$/g, "");
    if (roh.includes(":") ? ipv6Privat(roh) : ipv4Privat(roh)) throw new Error("Adresse nicht erlaubt.");
    return;
  }
  if (!h.includes(".")) throw new Error("Adresse nicht erlaubt.");
  // DNS auflösen und jedes Ergebnis prüfen (schützt vor Domains, die auf interne IPs zeigen)
  try {
    const [v4, v6] = await Promise.all([
      Deno.resolveDns(h, "A").catch(() => [] as string[]),
      Deno.resolveDns(h, "AAAA").catch(() => [] as string[]),
    ]);
    if (v4.some(ipv4Privat) || v6.some(ipv6Privat)) throw new Error("Adresse nicht erlaubt.");
  } catch (e) {
    if ((e as Error).message === "Adresse nicht erlaubt.") throw e;
    // DNS-Prüfung in dieser Umgebung nicht verfügbar: Hostname-Prüfung oben bleibt aktiv
  }
}

export interface AbrufErgebnis { text: string; finalUrl: string; lastModified?: string }

/** Lädt eine HTML-Seite sicher. Wirft bei verbotenen Zielen, falschem Typ oder Übergrösse. */
export async function sichererAbruf(
  startUrl: string,
  headers: Record<string, string>,
  opts: { timeoutMs?: number; maxBytes?: number; maxRedirects?: number } = {},
): Promise<AbrufErgebnis> {
  const { timeoutMs = 8000, maxBytes = 1_500_000, maxRedirects = 5 } = opts;
  let aktuell = startUrl;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const u = new URL(aktuell);
    if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("Nur http/https erlaubt.");
    if (u.username || u.password) throw new Error("Adresse nicht erlaubt.");
    if (u.port && u.port !== "80" && u.port !== "443") throw new Error("Nur Standardports erlaubt.");
    await pruefeHost(u.hostname);

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(aktuell, { headers, signal: ctrl.signal, redirect: "manual" });
    } finally {
      clearTimeout(timer);
    }

    if (res.status >= 300 && res.status < 400) {
      const ziel = res.headers.get("location");
      if (!ziel) throw new Error("Ungültige Weiterleitung.");
      aktuell = new URL(ziel, aktuell).toString();
      continue;
    }

    const typ = (res.headers.get("content-type") || "").toLowerCase();
    if (typ && !typ.includes("text/html") && !typ.includes("application/xhtml")) throw new Error("Kein HTML-Inhalt.");
    const laenge = Number(res.headers.get("content-length") || 0);
    if (laenge > maxBytes) throw new Error("Seite zu gross.");

    // Streaming mit hartem Limit
    const reader = res.body?.getReader();
    const lastModified = res.headers.get("last-modified") ?? undefined;
    if (!reader) return { text: "", finalUrl: aktuell, lastModified };
    const teile: Uint8Array[] = [];
    let summe = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      summe += value.byteLength;
      if (summe > maxBytes) { await reader.cancel(); break; }
      teile.push(value);
    }
    const alle = new Uint8Array(summe > maxBytes ? maxBytes : summe);
    let pos = 0;
    for (const t of teile) { if (pos + t.byteLength > alle.length) break; alle.set(t, pos); pos += t.byteLength; }
    return { text: new TextDecoder().decode(alle), finalUrl: aktuell, lastModified };
  }
  throw new Error("Zu viele Weiterleitungen.");
}
