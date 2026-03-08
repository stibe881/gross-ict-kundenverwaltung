const { PKPass } = require('passkit-generator');
const fs = require('fs');
const path = require('path');

async function testPass() {
    try {
        const certDir = path.join(__dirname, 'supabase', 'functions', 'generate-wallet-pass', 'certs');
        const wwdrStr = fs.readFileSync(path.join(certDir, 'wwdr.pem'), 'utf8');
        const signerCertStr = fs.readFileSync(path.join(certDir, 'pass.pem'), 'utf8');
        const signerKeyStr = fs.readFileSync(path.join(certDir, 'privatekey.pem'), 'utf8');

        const encoder = new TextEncoder();
        const wwdr = encoder.encode(wwdrStr);
        const signerCert = encoder.encode(signerCertStr);
        const signerKey = encoder.encode(signerKeyStr);

        const transparentPng = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 10, 73, 68, 65, 84, 120, 156, 99, 96, 0, 0, 0, 2, 0, 1, 226, 38, 5, 155, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]);

        const pass = new PKPass({
            "pass.json": encoder.encode(JSON.stringify({
                passTypeIdentifier: "pass.ch.gross-ict.visitenkarte",
                teamIdentifier: "ABCDE12345", // Mock since we just want to test generation
                organizationName: "Gross ICT",
                description: "Visitenkarte",
                generic: {
                    primaryFields: [{ "key": "name", "value": "Name" }]
                }
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
    } catch (e) {
        console.error("FAILED:");
        console.error(e);
    }
}

testPass();
