// Sitemap für Suchmaschinen und KI-Crawler: alle öffentlichen Seiten,
// automatisch aus dem Ordner src/pages abgeleitet (neue Seiten erscheinen
// beim nächsten Build von selbst).
import type { APIRoute } from "astro";

const SITE = "https://gross-ict.ch";
const seiten = import.meta.glob("./*.astro");

export const GET: APIRoute = () => {
  const heute = new Date().toISOString().slice(0, 10);
  const urls = Object.keys(seiten)
    .map((p) => p.replace("./", "").replace(".astro", ""))
    .map((name) => (name === "index" ? "/" : `/${name}`))
    .sort()
    .map((pfad) => `  <url><loc>${SITE}${pfad}</loc><lastmod>${heute}</lastmod></url>`)
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
};
