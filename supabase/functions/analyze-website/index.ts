import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { url: originalUrl } = await req.json();
    if (!originalUrl) {
      return new Response(JSON.stringify({ error: "URL is required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    let url = originalUrl.trim();
    // Strip protocol to force https test first
    const domainPart = url.replace(/^https?:\/\//i, "");
    const httpsUrl = "https://" + domainPart;
    const httpUrl = "http://" + domainPart;

    let sslValid = true;
    let html = "";
    let finalUrl = httpsUrl;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(httpsUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      html = await response.text();
    } catch (err: any) {
      // HTTPS failed, meaning SSL is not valid or domain doesn't support HTTPS
      sslValid = false;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(httpUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        html = await response.text();
        finalUrl = httpUrl;
      } catch (e) {
        // Both failed
      }
    }

    const lowerHtml = html.toLowerCase();
    const hasImpressum = lowerHtml.includes("impressum") || /<a[^>]*>(?:[^<]*\s)?impressum(?:[^<]*)?<\/a>/i.test(html);
    const hasPrivacy = lowerHtml.includes("datenschutz") || /<a[^>]*>(?:[^<]*\s)?datenschutz(?:[^<]*)?<\/a>/i.test(html);
    const isResponsive = /<meta[^>]*name=["']viewport["']/i.test(html);
    
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
    let title = titleMatch ? titleMatch[1].trim() : "";

    // Convert HTML to plain text for easier extraction
    const plainText = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

    // Email extraction
    const emailMatch = plainText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    let email = emailMatch ? emailMatch[0] : "";
    // Ignore common image/font extensions masquerading as emails
    if (email && /\.(png|jpg|jpeg|gif|svg|woff|woff2)$/i.test(email)) email = "";

    // Phone extraction (Swiss format)
    const phoneMatch = plainText.match(/(?:\+41|0041|0)\s?[1-9][0-9]?\s?[0-9]{3}\s?[0-9]{2}\s?[0-9]{2}/);
    let phone = phoneMatch ? phoneMatch[0].trim() : "";

    // Address, Zip, City extraction
    let address = "";
    let zip = "";
    let city = "";
    // Matches patterns like "Musterstrasse 12, 8000 Zürich"
    const addressMatch = plainText.match(/([A-ZÄÖÜ][a-zA-ZäöüÄÖÜéèàß]+\s*(?:strasse|weg|gasse|platz|ring|allee)\s*\d+[a-zA-Z]?)[,.\s]*(?:CH-)?([1-9][0-9]{3})\s+([A-ZÄÖÜ][a-zA-ZäöüÄÖÜéèàß]+(?:[- ][A-ZÄÖÜ][a-zA-ZäöüÄÖÜéèàß]+)*)/i);
    if (addressMatch) {
      address = addressMatch[1].trim();
      zip = addressMatch[2].trim();
      city = addressMatch[3].trim();
    } else {
      const plzMatch = plainText.match(/(?:CH-)?([1-9][0-9]{3})\s+([A-ZÄÖÜ][a-zA-ZäöüÄÖÜéèàß]+(?:[- ][A-ZÄÖÜ][a-zA-ZäöüÄÖÜéèàß]+)*)/);
      if (plzMatch) {
        zip = plzMatch[1].trim();
        city = plzMatch[2].trim();
      }
    }
    
    let priority = "low";
    let notes = "";
    
    const fehlendeDinge = [];
    if (!sslValid) fehlendeDinge.push("kein gültiges SSL-Zertifikat");
    if (!hasImpressum) fehlendeDinge.push("kein Impressum gefunden");
    if (!hasPrivacy) fehlendeDinge.push("keine Datenschutzerklärung gefunden");
    
    if (fehlendeDinge.length > 0) {
      priority = "high";
      notes = `Website weist rechtliche/sicherheitstechnische Mängel auf: ${fehlendeDinge.join(", ")}. Gutes Verkaufsargument: Abmahnrisiko minimieren, rechtliche Sicherheit herstellen und Vertrauen bei Kunden durch einen professionellen, geschützten Auftritt gewinnen.\n\n💡 Tipp für die Kontaktaufnahme: Zeigen Sie sich als Problemlöser. Erwähnen Sie die Mängel nicht als Vorwurf, sondern als gut gemeinten Hinweis, um sie vor teuren Abmahnungen zu schützen. Bieten Sie an, dies unkompliziert für sie zu beheben.`;
    } else if (!isResponsive) {
      priority = "medium";
      notes = "Die Website ist veraltet und nicht für Smartphones optimiert (Responsive Design fehlt). Gutes Verkaufsargument: Über 60% der Nutzer surfen mobil. Eine moderne, mobil-optimierte Seite bringt bessere Google-Rankings und deutlich mehr Kundenanfragen.\n\n💡 Tipp für die Kontaktaufnahme: Sprechen Sie den potenziellen Kundenverlust an. Fragen Sie, ob sie wissen, wie die Seite auf dem Smartphone aussieht. Bieten Sie eventuell einen schnellen Mockup an, der zeigt, wie modern sie wirken könnten.";
    } else {
      notes = "Website sieht technisch solide aus. Argument: Optimierung der Conversion-Rate oder Redesign für frischen Look.\n\n💡 Tipp für die Kontaktaufnahme: Da die Basis bereits gut ist, loben Sie ihren Auftritt. Fokussieren Sie sich im Gespräch auf fortgeschrittene Themen wie Performance-Optimierung, messbare Lead-Generierung oder gezieltes Online-Marketing.";
    }

    return new Response(
      JSON.stringify({
        url: finalUrl,
        title,
        email,
        phone,
        address,
        zip,
        city,
        priority,
        notes,
        sslValid,
        hasImpressum,
        hasPrivacy,
        isResponsive,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
