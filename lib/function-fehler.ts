/**
 * Liest die eigentliche Fehlermeldung einer fehlgeschlagenen Edge Function.
 * supabase-js liefert bei HTTP-Fehlern nur «Edge Function returned a non-2xx status code»;
 * der Grund steht im Antworttext der Function ({ error: "…" }).
 */
export async function funktionsFehlerText(error: any, fallback: string): Promise<string> {
  try {
    const antwort = error?.context;
    if (antwort && typeof antwort.json === "function") {
      const j = await antwort.json();
      if (j?.error) return String(j.error);
      if (j?.message) return String(j.message);
    }
  } catch { /* Antwort war kein JSON — Standardtext verwenden */ }
  const msg = String(error?.message || "");
  return msg && !/non-2xx/i.test(msg) ? msg : fallback;
}
