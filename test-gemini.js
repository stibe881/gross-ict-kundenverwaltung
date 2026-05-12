const apiKey = 'AIzaSyD_nW_dhdoFCTA5i6vMaM8CvGgqMeGPN1k';
const prompt = `
Du bist ein KI-Assistent zur Extraktion von Daten aus Webseiten.
Extrahiere folgende Daten und antworte AUSSCHLIESSLICH im gültigen JSON-Format:
{
  "email": "E-Mail (oder leerer String)",
  "phone": "Telefonnummer (oder leerer String)",
  "address": "Straße und Hausnummer (oder leerer String)",
  "zip": "Postleitzahl (oder leerer String)",
  "city": "Ort (oder leerer String)",
  "hasImpressum": true,
  "hasPrivacy": true
}
Webseiten-Text: impressum max@muster.ch
`;

fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=' + apiKey, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.1, responseMimeType: 'application/json' }
  })
}).then(r => r.json()).then(data => {
  console.log(JSON.stringify(data, null, 2));
});
