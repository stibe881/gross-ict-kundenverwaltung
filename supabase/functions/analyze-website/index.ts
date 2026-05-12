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

    const fetchHeaders = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "de-CH,de-DE;q=0.9,de;q=0.8,en-US;q=0.7,en;q=0.6",
      "Upgrade-Insecure-Requests": "1"
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(httpsUrl, {
        headers: fetchHeaders,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      html = await response.text();
    } catch (err: any) {
      sslValid = false;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        const response = await fetch(httpUrl, {
          headers: fetchHeaders,
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
    const isResponsive = /<meta[^>]*name=["']viewport["']/i.test(html);
    
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
    let title = titleMatch ? titleMatch[1].trim() : "";

    // Cloudflare / Bot Protection Check
    if (title.includes("Just a moment...") || lowerHtml.includes("cf-browser-verification") || lowerHtml.includes("ray id")) {
      return new Response(
        JSON.stringify({
          url: finalUrl,
          title: "", // Prevent "Just a moment..." as company name
          email: "",
          phone: "",
          address: "",
          zip: "",
          city: "",
          priority: "high",
          notes: "⚠️ Die Website verwendet einen strikten Bot-Schutz (z.B. Cloudflare). Eine automatische Analyse der Inhalte war daher nicht möglich. Bitte manuell prüfen.",
          sslValid,
          hasImpressum: false,
          hasPrivacy: false,
          isResponsive,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clean HTML to save tokens
    let cleanHtml = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
    cleanHtml = cleanHtml.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");
    const plainText = cleanHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 60000);

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    let aiData = {
      companyName: "",
      email: "",
      phone: "",
      address: "",
      zip: "",
      city: "",
      hasImpressum: false,
      hasPrivacy: false,
      salesPitch: ""
    };
    let aiSuccess = false;

    if (GEMINI_API_KEY && plainText.length > 0) {
      const prompt = `
Du bist ein KI-Assistent zur Extraktion von Daten aus Webseiten für eine Webagentur (Gross ICT).
Hier ist der Text einer Firmenwebseite.

Wir haben die Website bereits technisch geprüft:
- SSL-Zertifikat vorhanden: ${sslValid ? 'Ja' : 'Nein'}
- Responsive Design (Mobil-optimiert): ${isResponsive ? 'Ja' : 'Nein'}

Extrahiere folgende Daten und antworte AUSSCHLIESSLICH im gültigen JSON-Format:
{
  "companyName": "Der Name der Firma (oder leerer String)",
  "email": "E-Mail (oder leerer String)",
  "phone": "Telefonnummer (oder leerer String)",
  "address": "Straße und Hausnummer (oder leerer String)",
  "zip": "Postleitzahl (oder leerer String)",
  "city": "Ort (oder leerer String)",
  "hasImpressum": true/false (Gibt es einen ECHTEN Link oder Menüpunkt zu einem Impressum?),
  "hasPrivacy": true/false (Gibt es einen ECHTEN Link oder Menüpunkt zu einer Datenschutzerklärung?),
  "salesPitch": "Schreibe einen maßgeschneiderten, kurzen Sales-Tipp (1-2 Sätze) für unser Sales-Team. Berücksichtige die Branche des Kunden und technische Mängel (SSL, Responsive, Impressum, Datenschutz), um einen guten Aufhänger für das Verkaufsgespräch zu liefern. (Beginne mit: 💡 Tipp für die Kontaktaufnahme: ...)"
}

Webseiten-Text:
${plainText}`;

      try {
        const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: "application/json"
            }
          })
        });

        if (geminiRes.ok) {
          const geminiJson = await geminiRes.json();
          let responseText = geminiJson.candidates?.[0]?.content?.parts?.[0]?.text;
          if (responseText) {
            // Remove markdown code blocks if Gemini accidentally includes them
            responseText = responseText.replace(/^```json\s*/, '').replace(/```$/, '').trim();
            aiData = { ...aiData, ...JSON.parse(responseText) };
            aiSuccess = true;
          }
        } else {
          console.error("Gemini API Error:", await geminiRes.text());
        }
      } catch (e) {
        console.error("Gemini Parsing Error:", e);
      }
    }

    // Use AI detected values if AI succeeded, otherwise fallback to simple regex
    const hasImpressum = aiSuccess ? aiData.hasImpressum : (lowerHtml.includes("impressum") || /<a[^>]*>(?:[^<]*\s)?impressum(?:[^<]*)?<\/a>/i.test(html));
    const hasPrivacy = aiSuccess ? aiData.hasPrivacy : (lowerHtml.includes("datenschutz") || /<a[^>]*>(?:[^<]*\s)?datenschutz(?:[^<]*)?<\/a>/i.test(html));
    
    let email = aiData.email;
    let phone = aiData.phone;
    let address = aiData.address;
    let zip = aiData.zip;
    let city = aiData.city;
    let priority = "low";
    let notes = "";
    
    const fehlendeDinge = [];
    if (!sslValid) fehlendeDinge.push("kein gültiges SSL-Zertifikat");
    if (!hasImpressum) fehlendeDinge.push("kein Impressum gefunden");
    if (!hasPrivacy) fehlendeDinge.push("keine Datenschutzerklärung gefunden");
    
    if (fehlendeDinge.length > 0) {
      priority = "high";
      notes = `Website weist rechtliche/sicherheitstechnische Mängel auf: ${fehlendeDinge.join(", ")}.`;
      if (!aiSuccess || !aiData.salesPitch) {
        notes += ` Gutes Verkaufsargument: Abmahnrisiko minimieren, rechtliche Sicherheit herstellen und Vertrauen bei Kunden durch einen professionellen, geschützten Auftritt gewinnen.\n\n💡 Tipp für die Kontaktaufnahme: Zeigen Sie sich als Problemlöser. Erwähnen Sie die Mängel nicht als Vorwurf, sondern als gut gemeinten Hinweis, um sie vor teuren Abmahnungen zu schützen. Bieten Sie an, dies unkompliziert für sie zu beheben.`;
      }
    } else if (!isResponsive) {
      priority = "medium";
      notes = "Die Website ist veraltet und nicht für Smartphones optimiert (Responsive Design fehlt).";
      if (!aiSuccess || !aiData.salesPitch) {
        notes += ` Gutes Verkaufsargument: Über 60% der Nutzer surfen mobil. Eine moderne, mobil-optimierte Seite bringt bessere Google-Rankings und deutlich mehr Kundenanfragen.\n\n💡 Tipp für die Kontaktaufnahme: Sprechen Sie den potenziellen Kundenverlust an. Fragen Sie, ob sie wissen, wie die Seite auf dem Smartphone aussieht. Bieten Sie eventuell einen schnellen Mockup an, der zeigt, wie modern sie wirken könnten.`;
      }
    } else {
      notes = "Website sieht technisch solide aus. Argument: Optimierung der Conversion-Rate oder Redesign für frischen Look.";
      if (!aiSuccess || !aiData.salesPitch) {
        notes += `\n\n💡 Tipp für die Kontaktaufnahme: Da die Basis bereits gut ist, loben Sie ihren Auftritt. Fokussieren Sie sich im Gespräch auf fortgeschrittene Themen wie Performance-Optimierung, messbare Lead-Generierung oder gezieltes Online-Marketing.`;
      }
    }

    if (aiSuccess && aiData.salesPitch) {
      notes += `\n\n${aiData.salesPitch}`;
    }

    return new Response(
      JSON.stringify({
        url: finalUrl,
        title: aiData.companyName || title,
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
