import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const vcard = `BEGIN:VCARD
VERSION:3.0
N:${familyName};${givenName};;;
FN:${name}
ORG:Gross ICT
TITLE:${position}
TEL;TYPE=WORK,VOICE:${phone}
EMAIL;TYPE=PREF,INTERNET:${email}
URL:${website}
END:VCARD`;

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
