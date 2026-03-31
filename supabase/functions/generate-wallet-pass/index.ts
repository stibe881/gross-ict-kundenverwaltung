import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { PKPass } from "npm:passkit-generator@3.x";
import { Buffer } from "node:buffer";
import * as crypto from "node:crypto";
import { certs } from "./certs.ts";

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
  const transparentPng = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 10, 73, 68, 65, 84, 120, 156, 99, 96, 0, 0, 0, 2, 0, 1, 226, 38, 5, 155, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]);

  const vcardUrl = `https://bvluvvyvftygnxtmboxw.supabase.co/functions/v1/vcard?name=${encodeURIComponent(name || "")}&position=${encodeURIComponent(position || "")}&phone=${encodeURIComponent(phone || "")}&email=${encodeURIComponent(email || "")}&website=${encodeURIComponent(website || "")}`;

  const pass = new PKPass({
    "pass.json": Buffer.from(JSON.stringify({
      formatVersion: 1,
      passTypeIdentifier: "pass.ch.gross-ict.visitenkarte",
      teamIdentifier: "QF59FHQ44R",
      serialNumber: `pass-${Buffer.from(name + email).toString('base64').replace(/[^a-zA-Z0-9]/g, '')}`,
      organizationName: "Gross ICT",
      description: "Gross ICT Visitenkarte",
      logoText: "Gross ICT",
      foregroundColor: "rgb(255, 255, 255)",
      backgroundColor: "rgb(0, 0, 0)",
      labelColor: "rgb(212, 164, 50)",
      barcodes: [{
        format: "PKBarcodeFormatQR",
        message: vcardUrl,
        messageEncoding: "iso-8859-1"
      }],
      generic: {
        primaryFields: [{ key: "name", value: name || "Mitarbeiter" }],
        secondaryFields: [{ key: "position", value: position || "-", label: "POSITION" }],
        auxiliaryFields: [
          { key: "phone", value: phone || "-", label: "TELEFON" },
          { key: "email", value: email || "-", label: "E-MAIL" }
        ]
      }
    })),
    "icon.png": transparentPng,
    "icon@2x.png": transparentPng,
    "logo.png": transparentPng,
    "logo@2x.png": transparentPng
  }, {
    wwdr: certs.wwdr,
    signerCert: certs.signerCert,
    signerKey: certs.signerKey,
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
