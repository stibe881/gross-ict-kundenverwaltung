import { PKPass } from "https://esm.sh/passkit-generator@3.x";

async function testPass() {
  try {
    const wwdr = await Deno.readFile(new URL("./supabase/functions/generate-wallet-pass/certs/wwdr.pem", import.meta.url));
    const signerCert = await Deno.readFile(new URL("./supabase/functions/generate-wallet-pass/certs/pass.pem", import.meta.url));
    const signerKey = await Deno.readFile(new URL("./supabase/functions/generate-wallet-pass/certs/privatekey.pem", import.meta.url));

    const transparentPng = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 10, 73, 68, 65, 84, 120, 156, 99, 96, 0, 0, 0, 2, 0, 1, 226, 38, 5, 155, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]);

    const pass = new PKPass({
      "pass.json": new TextEncoder().encode(JSON.stringify({
        passTypeIdentifier: "pass.ch.gross-ict.visitenkarte",
        teamIdentifier: "YOUR_TEAM_ID", // The library will extract this if possible
        organizationName: "Gross ICT",
        description: "Visitenkarte",
      })),
      "icon.png": transparentPng,
      "icon@2x.png": transparentPng,
      "logo.png": transparentPng,
      "logo@2x.png": transparentPng
    }, {
      wwdr,
      signerCert,
      signerKey,
    });
    
    console.log("Generating buffer...");
    const buffer = await pass.getAsBuffer();
    console.log("Buffer generated successfully, length:", buffer.byteLength);
  } catch(e) {
    console.error("FAILED:");
    console.error(e);
  }
}

testPass();
