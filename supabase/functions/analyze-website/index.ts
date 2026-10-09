import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders, pruefeMitarbeiter, sichererAbruf } from "../_shared/sicherheit.ts";
import { bewerteAlter } from "../_shared/webalter.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Nur angemeldete Mitarbeiter mit Akquise-Rolle (Abruf fremder Webseiten + KI-Kosten)
  const { fehler: nichtBerechtigt } = await pruefeMitarbeiter(req);
  if (nichtBerechtigt) return nichtBerechtigt;

  try {
    const { url: originalUrl } = await req.json();
    if (!originalUrl) {
      return new Response(JSON.stringify({ error: "URL is required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const roh = String(originalUrl).trim().slice(0, 300);
    // Strip protocol to force https test first
    const domainPart = roh.replace(/^https?:\/\//i, "");
    const httpsUrl = "https://" + domainPart;
    const httpUrl = "http://" + domainPart;

    let sslValid = true;
    let html = "";
    let finalUrl = httpsUrl;
    let lastModified: string | undefined;

    const fetchHeaders = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "de-CH,de-DE;q=0.9,de;q=0.8,en-US;q=0.7,en;q=0.6",
      "Upgrade-Insecure-Requests": "1"
    };

    // Verbotene Ziele (interne Adressen, fremde Ports …) sofort ablehnen — kein http-Fallback
    const VERBOTEN = ["Adresse nicht erlaubt.", "Nur Standardports erlaubt.", "Nur http/https erlaubt."];
    const ungueltig = () => new Response(JSON.stringify({ error: "Diese Adresse kann nicht analysiert werden." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
    try { new URL(httpsUrl); } catch { return ungueltig(); }

    try {
      const r = await sichererAbruf(httpsUrl, fetchHeaders);
      html = r.text;
      finalUrl = r.finalUrl;
      lastModified = r.lastModified;
    } catch (err: any) {
      if (VERBOTEN.includes(err?.message)) return ungueltig();
      sslValid = false;
      try {
        const r = await sichererAbruf(httpUrl, fetchHeaders);
        html = r.text;
        finalUrl = r.finalUrl;
        lastModified = r.lastModified;
      } catch (e: any) {
        if (VERBOTEN.includes(e?.message)) return ungueltig();
        // Beide Abrufe fehlgeschlagen: ohne HTML weiter, wie bisher
      }
    }

    const lowerHtml = html.toLowerCase();
    const isResponsive = /<meta[^>]*name=["']viewport["']/i.test(html);

    // Barrierefreiheit (WCAG): einfache, serverseitig prüfbare Signale
    const hasLangAttr = /<html[^>]*\slang\s*=/i.test(html);
    const imgTags = html.match(/<img\b[^>]*>/gi) || [];
    const imgsWithoutAlt = imgTags.filter((t) => !/\salt\s*=/i.test(t)).length;
    
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
      privacyRequired: true,
      accessibilityIssues: [] as string[],
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
  "privacyRequired": true/false (Ist für diese Webseite rechtlich zwingend eine Datenschutzerklärung nötig? z.B. weil Kontaktformulare, Logins, Shops oder Newsletter-Anmeldungen im Text vorkommen?),
  "accessibilityIssues": ["Kurze Liste konkreter Barrierefreiheits-Probleme nach WCAG 2.1 AA, die sich aus dem Text ableiten lassen (z.B. nichtssagende Linktexte wie 'hier klicken', fehlende Formular-Beschriftungen, rein visuelle Hinweise). Leere Liste, wenn nichts erkennbar."],
  "salesPitch": "Schreibe einen massgeschneiderten, kurzen Sales-Tipp (2-3 Sätze) für unser Sales-Team. Hauptfokus: dem Kunden primär eine NEUE, moderne Website empfehlen; Anpassungen an der bestehenden nur als zweite Option. Ordne Mängel rechtlich für die Schweiz ein: Datenschutzerklärung ist Pflicht nach revDSG (Bussen bis CHF 250'000, bei EU-Kunden zusätzlich DSGVO), Impressum ist Pflicht nach UWG Art. 3, Barrierefreiheit nach WCAG 2.1 wird mit dem European Accessibility Act für EU-Geschäft zur Pflicht. Sachlich bleiben, keine Angstmacherei. (Beginne mit: 💡 Tipp für die Kontaktaufnahme: ...)"
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
    
    // WCAG-Hinweise: technische Signale + KI-Befunde
    const wcagHints: string[] = [];
    if (!hasLangAttr) wcagHints.push("fehlende Sprachangabe (lang-Attribut)");
    if (imgsWithoutAlt > 0) wcagHints.push(`${imgsWithoutAlt} Bild(er) ohne Alt-Text`);
    if (aiSuccess && Array.isArray(aiData.accessibilityIssues)) {
      wcagHints.push(...aiData.accessibilityIssues.filter(Boolean).map(String).slice(0, 4));
    }
    const wcagOk = wcagHints.length === 0;

    const fehlendeDinge = [];
    if (!sslValid) fehlendeDinge.push("kein gültiges SSL-Zertifikat (Browser-Warnung, Vertrauens- und SEO-Risiko)");
    if (!hasImpressum) fehlendeDinge.push("kein Impressum gefunden (Pflicht nach UWG Art. 3 — Abmahn- und Bussenrisiko)");

    // Only warn about missing privacy policy if it is legally required according to AI
    const requiresPrivacy = aiSuccess ? aiData.privacyRequired : true;
    if (!hasPrivacy && requiresPrivacy) {
      fehlendeDinge.push("keine Datenschutzerklärung gefunden (Pflicht nach revDSG seit 2023, Bussen bis CHF 250'000; bei EU-Kunden zusätzlich DSGVO)");
    }

    const alter = bewerteAlter(html, lastModified);
    if (alter.veraltet) {
      fehlendeDinge.push(`Website wirkt veraltet (${alter.hinweise.slice(0, 3).join("; ")})`);
    }

    if (!isResponsive) {
      fehlendeDinge.push("fehlendes Responsive Design (nicht mobil-optimiert — Ranking-Nachteil bei Google)");
    }

    if (fehlendeDinge.length > 0) {
      priority = fehlendeDinge.length > 1 || !sslValid || !hasImpressum ? "high" : "medium";
      notes = `Website weist folgende Mängel auf: ${fehlendeDinge.join(", ")}.`;
      if (!aiSuccess || !aiData.salesPitch) {
        notes += ` Empfehlung: primär eine neue, moderne Website anbieten (rechtssicher nach revDSG/UWG, barrierefrei nach WCAG, mobil-optimiert); Anpassungen an der bestehenden Website nur als zweite Option.\n\n💡 Tipp für die Kontaktaufnahme: Zeigen Sie sich als Problemlöser. Erwähnen Sie die Mängel nicht als Vorwurf, sondern als gut gemeinten Hinweis auf die Schweizer Rechtslage.`;
      }
    } else {
      notes = "Website sieht technisch und rechtlich solide aus. Argument: Neuaufbau für frischen, modernen Auftritt (inkl. Barrierefreiheit nach WCAG) oder Optimierung der Conversion-Rate.";
      if (!aiSuccess || !aiData.salesPitch) {
        notes += `\n\n💡 Tipp für die Kontaktaufnahme: Da die Basis bereits gut ist, loben Sie den Auftritt. Fokussieren Sie sich auf fortgeschrittene Themen wie Barrierefreiheit (WCAG/European Accessibility Act), Performance oder messbare Lead-Generierung.`;
      }
    }

    if (wcagHints.length > 0) {
      notes += `\n\nBarrierefreiheit (WCAG 2.1): ${wcagHints.join(", ")}. Einordnung: Mit dem European Accessibility Act ist Barrierefreiheit für Firmen mit EU-Kundschaft Pflicht; in der Schweiz ist sie für Private (noch) nicht generell vorgeschrieben, aber klarer Qualitäts- und SEO-Faktor — und ein starkes Argument für einen Neuaufbau.`;
    }

    if (aiSuccess && aiData.salesPitch) {
      notes += `\n\n${aiData.salesPitch}`;
    }

    // Check for duplicates in the database
    let duplicateWarning = "";
    try {
      const authHeader = req.headers.get('Authorization');
      if (authHeader) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: authHeader } }
        });

        // Extract core domain for search (e.g., auto-amrein.ch)
        let domainForSearch = "";
        try {
          domainForSearch = new URL(finalUrl).hostname.replace(/^www\./i, "");
        } catch(e) {
          domainForSearch = finalUrl.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split('/')[0];
        }

        if (domainForSearch) {
          const { data: existingCustomers } = await supabase
            .from('customers')
            .select('company_name')
            .ilike('website', `%${domainForSearch}%`)
            .limit(1);

          if (existingCustomers && existingCustomers.length > 0) {
            duplicateWarning = `Diese Firma existiert bereits als aktiver Kunde (${existingCustomers[0].company_name})!`;
          } else {
            const { data: existingLeads } = await supabase
              .from('leads')
              .select('company, status')
              .ilike('website', `%${domainForSearch}%`)
              .limit(1);
            
            if (existingLeads && existingLeads.length > 0) {
              const statusMap: Record<string, string> = {
                new: "Neu",
                contacted: "Kontaktiert",
                qualified: "Qualifiziert",
                proposal: "Angebot gesendet",
                won: "Gewonnen",
                lost: "Verloren",
                "follow-up": "Follow-Up"
              };
              const leadStatus = statusMap[existingLeads[0].status] || existingLeads[0].status;
              duplicateWarning = `Diese Firma existiert bereits als Lead (Status: ${leadStatus}).`;
            }
          }
        }
      }
    } catch (e) {
      console.error("Duplicate check error:", e);
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
        duplicateWarning,
        sslValid,
        hasImpressum,
        hasPrivacy,
        isResponsive,
        wcagOk,
        wcagHints,
        outdated: alter.veraltet,
        outdatedHints: alter.hinweise,
        copyrightYear: alter.copyrightJahr ?? null,
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
