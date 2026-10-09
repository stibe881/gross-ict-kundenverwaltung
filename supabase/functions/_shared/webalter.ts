// Einschätzung, ob eine Webseite veraltet wirkt — rein aus dem HTML und dem Last-Modified-Header.
// Keine Netzwerk- oder Deno-Zugriffe, damit sich die Regeln in Tests prüfen lassen.
// Es sind Hinweise, kein Beweis: eine Seite ohne Treffer kann trotzdem alt sein.

export interface AlterErgebnis {
  veraltet: boolean;
  hinweise: string[];
  /** Jüngstes Jahr im Copyright-Vermerk, falls gefunden */
  copyrightJahr?: number;
}

const SCHWELLE_JAHRE = 3; // Copyright / Last-Modified älter als 3 Jahre gilt als Hinweis

export function bewerteAlter(html: string, lastModified?: string, jetzt: Date = new Date()): AlterErgebnis {
  const hinweise: string[] = [];
  const jahr = jetzt.getFullYear();

  // Copyright-Vermerk: bei «2012–2019» zählt das letzte Jahr
  let copyrightJahr: number | undefined;
  for (const m of html.matchAll(/(?:©|&copy;|&#169;|copyright)\s*(?:\(c\)\s*)?(?:(?:19|20)\d{2}\s*(?:-|–|&ndash;|bis|to)\s*)?((?:19|20)\d{2})/gi)) {
    const j = Number(m[1]);
    if (j <= jahr + 1 && (copyrightJahr === undefined || j > copyrightJahr)) copyrightJahr = j;
  }
  if (copyrightJahr !== undefined && jahr - copyrightJahr >= SCHWELLE_JAHRE) {
    hinweise.push(`Copyright-Vermerk von ${copyrightJahr} (seit ${jahr - copyrightJahr} Jahren nicht angepasst)`);
  }

  if (lastModified) {
    const t = new Date(lastModified);
    if (!Number.isNaN(t.getTime()) && jahr - t.getFullYear() >= SCHWELLE_JAHRE) {
      hinweise.push(`Seite zuletzt geändert ${t.getFullYear()}`);
    }
  }

  // Technik aus einer anderen Zeit
  if (/<marquee\b|<blink\b/i.test(html)) hinweise.push("veraltete HTML-Elemente (marquee/blink)");
  if (/<frameset\b/i.test(html)) hinweise.push("Frames (Frameset)");
  if (/\.swf\b|swfobject|application\/x-shockwave-flash/i.test(html)) hinweise.push("Flash-Inhalte");
  if (/<font\b[^>]*>/i.test(html)) hinweise.push("Layout mit veralteten font-Tags");

  const jq = html.match(/jquery[-.\/]v?(\d+)\.(\d+)(?:\.\d+)?(?:\.min)?\.js/i);
  if (jq && Number(jq[1]) < 3) hinweise.push(`veraltetes jQuery ${jq[1]}.${jq[2]}`);

  const gen = html.match(/<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)["']/i)
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']generator["']/i);
  if (gen) {
    const g = gen[1];
    const wp = g.match(/wordpress\s+(\d+)\.(\d+)/i);
    if (wp && (Number(wp[1]) < 6)) hinweise.push(`veraltetes ${g}`);
    if (/joomla/i.test(g) && /\b[123]\.\d/.test(g)) hinweise.push(`veraltetes ${g}`);
    const drupal = g.match(/drupal\s+(\d+)/i);
    if (drupal && Number(drupal[1]) <= 7) hinweise.push(`veraltetes ${g}`);
  }

  return { veraltet: hinweise.length > 0, hinweise, copyrightJahr };
}
