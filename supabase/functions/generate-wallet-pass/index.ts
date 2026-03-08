import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { PKPass } from "https://esm.sh/passkit-generator@3.x";

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
    const { name, position, phone, email, website } = await req.json();

    // In a real scenario, you would securely load these from environment variables or a secure storage
    // using Deno.env.get('APPLE_WWDR_CERT'), etc.
    // For this demonstration, we are mocking the generation because we don't have the actual certificates.
    
    // We would do something like this if certificates were available:
    /*
    const pass = new PKPass({
      "pass.json": Object.entries({
        passTypeIdentifier: "pass.ch.gross-ict.visitenkarte",
        teamIdentifier: "YOUR_TEAM_ID",
        organizationName: "Gross ICT",
        description: "Gross ICT Visitenkarte",
        logoText: "Gross ICT",
        foregroundColor: "rgb(255, 255, 255)",
        backgroundColor: "rgb(0, 0, 0)",
        labelColor: "rgb(212, 164, 50)",
        barcode: {
          format: "PKBarcodeFormatQR",
          message: `https://bvluvvyvftygnxtmboxw.supabase.co/functions/v1/vcard?name=${encodeURIComponent(name)}&position=${encodeURIComponent(position)}&phone=${encodeURIComponent(phone)}&email=${encodeURIComponent(email)}&website=${encodeURIComponent(website)}`,
          messageEncoding: "iso-8859-1"
        },
        generic: {
          primaryFields: [
            {
              key: "name",
              value: name,
              label: "Mitarbeiter"
            }
          ],
          secondaryFields: [
             {
               key: "position",
               value: position,
               label: "Position"
             }
          ],
          auxiliaryFields: [
            {
              key: "phone",
              value: phone || "-",
              label: "Telefon"
            },
            {
              key: "email",
              value: email,
              label: "E-Mail"
            }
          ]
        }
      }),
      "icon.png": Deno.readFileSync("./assets/icon.png"),
      "logo.png": Deno.readFileSync("./assets/logo.png")
    }, {
      wwdr: Deno.env.get('APPLE_WWDR_CERT_PEM'),
      signerCert: Deno.env.get('APPLE_SIGNER_CERT_PEM'),
      signerKey: Deno.env.get('APPLE_SIGNER_KEY_PEM'),
      signerKeyPassphrase: Deno.env.get('APPLE_SIGNER_KEY_PASSPHRASE')
    });
    
    const buffer = await pass.getAsBuffer();
    // Convert buffer to base64
    const base64String = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    */

    // Since we don't have certificates, we return an error indicating they are missing.
    // If we wanted to just return a dummy string to test the app flow, we could:
    // const base64String = "dummy_base64_data_representing_a_pkpass";
    
    // In this specific implementation, we will simulate a success but return a dummy string if no certs are present, 
    // to allow the frontend to test the download flow (it will result in an invalid pass on iOS, but the download logic works).
    
    // To properly build it, we need Deno.env configured.
    if (!Deno.env.get('APPLE_WWDR_CERT_PEM')) {
        console.warn("Missing Apple Certificates. Returning dummy pass data for UI testing.");
        return new Response(JSON.stringify({ 
            message: "Missing Apple Certificates for signing. Dummy pass generated.",
            file: "UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA==" // Dummy valid ZIP base64 (empty) to avoid parse errors in some clients
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200, // Returning 200 so frontend doesn't crash during testing
        });
    }

    // Actual implementation when certificates exist...
    throw new Error("Not fully implemented: Requires Apple Developer Certificates");

  } catch (error) {
    console.error("Pass generation error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
