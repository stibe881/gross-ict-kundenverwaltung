// Öffentliche Hilfe-Seite: zeigt KB-Artikel mit visibility='public' und
// status='published' als einfache, schnelle HTML-Seite.
// Aufruf: .../help-page            → Artikelliste
//         .../help-page?id=<uuid>  → einzelner Artikel
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function esc(s: string): string {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function page(title: string, body: string): Response {
  const html = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} – Gross ICT Hilfe</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: -apple-system, system-ui, Segoe UI, Roboto, sans-serif; margin: 0; background: #FDFCFA; color: #3D3A42; }
  @media (prefers-color-scheme: dark) { body { background: #1C1D27; color: #EDE8DF; } .card { background: #252636 !important; border-color: #3A3748 !important; } header { background: #252636 !important; } }
  header { background: #F5F2EE; padding: 20px 16px; border-bottom: 2px solid #C19A6B; }
  header h1 { margin: 0; font-size: 20px; } header a { color: inherit; text-decoration: none; }
  header .sub { color: #8A8490; font-size: 13px; margin-top: 2px; }
  main { max-width: 760px; margin: 0 auto; padding: 20px 16px 60px; }
  .card { display: block; background: #fff; border: 1px solid #D6D2CE; border-radius: 12px; padding: 14px 16px; margin-bottom: 12px; text-decoration: none; color: inherit; }
  .card h2 { margin: 0 0 4px; font-size: 16px; }
  .card p { margin: 0; font-size: 13px; color: #8A8490; }
  article h1 { font-size: 24px; } article { line-height: 1.6; white-space: pre-wrap; }
  .back { display: inline-block; margin-bottom: 14px; color: #C19A6B; text-decoration: none; font-weight: 600; }
  .footer { margin-top: 40px; font-size: 12px; color: #8A8490; }
</style>
</head>
<body>
<header><h1><a href="?">() Gross ICT – Hilfe & Anleitungen</a></h1><div class="sub">gross-ict.ch · support@gross-ict.ch</div></header>
<main>${body}<div class="footer">© Gross ICT, Zell LU</div></main>
</body>
</html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300" } });
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (id) {
      const { data: a } = await supabase
        .from("kb_articles")
        .select("id, title, content, updated_at")
        .eq("id", id)
        .eq("visibility", "public")
        .eq("status", "published")
        .maybeSingle();
      if (!a) return page("Nicht gefunden", `<a class="back" href="?">← Zur Übersicht</a><p>Dieser Artikel ist nicht (mehr) öffentlich.</p>`);
      const updated = a.updated_at ? new Date(a.updated_at).toLocaleDateString("de-CH") : "";
      return page(a.title, `<a class="back" href="?">← Zur Übersicht</a><article><h1>${esc(a.title)}</h1>${esc(a.content)}</article><p class="footer">Zuletzt aktualisiert: ${updated}</p>`);
    }

    const { data: articles } = await supabase
      .from("kb_articles")
      .select("id, title, content, updated_at")
      .eq("visibility", "public")
      .eq("status", "published")
      .order("updated_at", { ascending: false })
      .limit(100);

    if (!articles || articles.length === 0) {
      return page("Hilfe", "<p>Zurzeit sind keine Hilfe-Artikel veröffentlicht.</p>");
    }
    const list = articles.map((a: any) => {
      const teaser = (a.content || "").replace(/\s+/g, " ").substring(0, 140);
      return `<a class="card" href="?id=${a.id}"><h2>${esc(a.title)}</h2><p>${esc(teaser)}…</p></a>`;
    }).join("");
    return page("Hilfe", list);
  } catch (e) {
    console.error("[help-page]", e);
    return page("Fehler", "<p>Die Hilfe-Seite ist vorübergehend nicht verfügbar.</p>");
  }
});
