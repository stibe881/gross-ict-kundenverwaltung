import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { PKPass } from "npm:passkit-generator@3.x";
import { Buffer } from "node:buffer";
import * as crypto from "node:crypto";
import { certs } from "./certs.ts";
import { passImages } from "./images.ts";

// Polyfill randomBytes for node-forge which passkit-generator uses internally
if (typeof (globalThis as any).crypto === "undefined") {
  (globalThis as any).crypto = {};
}
(globalThis as any).crypto.randomBytes = crypto.randomBytes;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function generatePassBuffer(name: string, position: string, phone: string, email: string, website: string) {
  const img = (b64: string) => Buffer.from(b64, "base64");

  const vcardUrl = `https://bvluvvyvftygnxtmboxw.supabase.co/functions/v1/vcard?name=${encodeURIComponent(name || "")}&position=${encodeURIComponent(position || "")}&phone=${encodeURIComponent(phone || "")}&email=${encodeURIComponent(email || "")}&website=${encodeURIComponent(website || "")}`;

  const websiteDisplay = (website || "").replace(/^https?:\/\//, "").replace(/\/$/, "");

  const pass = new PKPass({
    "pass.json": Buffer.from(JSON.stringify({
      formatVersion: 1,
      passTypeIdentifier: "pass.ch.gross-ict.visitenkarte",
      teamIdentifier: "QF59FHQ44R",
      serialNumber: `pass-${Buffer.from(name + email).toString('base64').replace(/[^a-zA-Z0-9]/g, '')}`,
      organizationName: "Gross ICT",
      description: "Gross ICT Visitenkarte",
      // kein logoText – das Logo oben links ist das volle "Gross ICT"-Wordmark
      foregroundColor: "rgb(255, 255, 255)",
      backgroundColor: "rgb(17, 17, 17)",
      labelColor: "rgb(212, 164, 50)",
      generic: {
        ...(websiteDisplay ? { headerFields: [{ key: "website", value: websiteDisplay, label: "WEB" }] } : {}),
        primaryFields: [{ key: "name", value: name || "Mitarbeiter" }],
        secondaryFields: [{ key: "position", value: position || "-", label: "POSITION" }],
        auxiliaryFields: [
          { key: "phone", value: phone || "-", label: "TELEFON" },
          { key: "email", value: email || "-", label: "E-MAIL" }
        ],
        backFields: [
          { key: "b-name", value: name || "-", label: "Name" },
          ...(position ? [{ key: "b-position", value: position, label: "Position" }] : []),
          ...(phone ? [{ key: "b-phone", value: phone, label: "Telefon" }] : []),
          ...(email ? [{ key: "b-email", value: email, label: "E-Mail" }] : []),
          ...(website ? [{ key: "b-website", value: website, label: "Website" }] : []),
          { key: "b-info", value: "QR-Code auf der Vorderseite scannen, um den Kontakt direkt zu speichern.", label: "Kontakt teilen" }
        ]
      }
    })),
    // Icon: Symbol auf schwarzem Grund (erscheint z.B. in Mails/Share-Sheet)
    "icon.png": img(passImages.icon1x),
    "icon@2x.png": img(passImages.icon2x),
    "icon@3x.png": img(passImages.icon3x),
    // Logo oben links neben "Gross ICT"
    "logo.png": img(passImages.logo1x),
    "logo@2x.png": img(passImages.logo2x),
    // Thumbnail rechts neben dem Namen – füllt das Kartenlayout
    "thumbnail.png": img(passImages.thumb1x),
    "thumbnail@2x.png": img(passImages.thumb2x)
  }, {
    wwdr: certs.wwdr,
    signerCert: certs.signerCert,
    signerKey: certs.signerKey,
  });

  // Explizit setzen – passkit-generator übernimmt Barcodes aus pass.json nicht zuverlässig,
  // deshalb fehlte der QR-Code bisher auf der Karte
  pass.setBarcodes({
    format: "PKBarcodeFormatQR",
    message: vcardUrl,
    messageEncoding: "iso-8859-1",
    altText: "Kontakt speichern"
  });

  return pass.getAsBuffer();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    let name: string, position: string, phone: string, email: string, website: string;

    if (req.method === 'GET') {
      // GET: Query params -> direct .pkpass binary download (for iOS Wallet)
      const url = new URL(req.url);
      name = url.searchParams.get('name') || '';
      position = url.searchParams.get('position') || '';
      phone = url.searchParams.get('phone') || '';
      email = url.searchParams.get('email') || '';
      website = url.searchParams.get('website') || '';

      console.log("Generating pass (GET) for:", name);
      const buffer = await generatePassBuffer(name, position, phone, email, website);

      return new Response(buffer, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/vnd.apple.pkpass',
          'Content-Disposition': 'attachment; filename="visitenkarte.pkpass"',
        },
        status: 200,
      });
    }

    // POST: JSON body -> base64 response (for web/fallback)
    ({ name, position, phone, email, website } = await req.json());
    console.log("Generating pass (POST) for:", name);

    const buffer = await generatePassBuffer(name, position, phone, email, website);
    
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    const base64String = btoa(binary);

    return new Response(JSON.stringify({ 
        message: "Pass generated successfully",
        file: base64String 
    }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
    });

  } catch (error) {
    console.error("Pass generation error:", error);
    return new Response(JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200, 
    })
  }
})
