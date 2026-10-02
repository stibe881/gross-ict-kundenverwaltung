import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { contactPhotoB64 } from "./photo.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Sonderzeichen in vCard-Werten escapen (RFC 2426)
function esc(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

// Lange Zeilen (z.B. PHOTO-Base64) gemäss Spec auf 75 Zeichen falten,
// Folgezeilen beginnen mit einem Leerzeichen
function fold(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [line.slice(0, 75)];
  for (let i = 75; i < line.length; i += 74) {
    chunks.push(" " + line.slice(i, i + 74));
  }
  return chunks.join("\r\n");
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url);
    const name = url.searchParams.get("name") || "Mustermann";
    const position = url.searchParams.get("position") || "";
    const phone = url.searchParams.get("phone") || "";
    const email = url.searchParams.get("email") || "";
    const website = url.searchParams.get("website") || "";

    // Split name to N property (FamilyName;GivenName;;;)
    const parts = name.split(" ");
    let givenName = "";
    let familyName = "";
    if (parts.length > 1) {
        familyName = parts.pop() || "";
        givenName = parts.join(" ");
    } else {
        givenName = name;
    }

    const lines = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      `N:${esc(familyName)};${esc(givenName)};;;`,
      `FN:${esc(name)}`,
      "ORG:Gross ICT",
      ...(position ? [`TITLE:${esc(position)}`] : []),
      ...(phone ? [`TEL;TYPE=WORK,VOICE:${esc(phone)}`] : []),
      ...(email ? [`EMAIL;TYPE=PREF,INTERNET:${esc(email)}`] : []),
      ...(website ? [`URL:${esc(website)}`] : []),
      // Kontaktfoto (Gross-ICT-Logo) – sonst zeigt iOS nur die Initialen
      fold(`PHOTO;ENCODING=b;TYPE=JPEG:${contactPhotoB64}`),
      "END:VCARD",
    ];
    // vCard-Spec verlangt CRLF-Zeilenenden
    const vcard = lines.join("\r\n") + "\r\n";

    return new Response(vcard, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/vcard; charset=utf-8',
        'Content-Disposition': `attachment; filename="Visitenkarte_${familyName}.vcf"`
      },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
