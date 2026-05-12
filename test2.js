const apiKey = 'AIzaSyD_nW_dhdoFCTA5i6vMaM8CvGgqMeGPN1k';
const prompt = `
Du bist ein KI-Assistent zur Extraktion von Daten aus Webseiten.
Extrahiere folgende Daten und antworte AUSSCHLIESSLICH im gültigen JSON-Format:
{
  "email": "E-Mail (oder leerer String)"
}
Webseiten-Text: impressum max@muster.ch
`;
fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + apiKey, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.1, responseMimeType: 'application/json' }
  })
}).then(r => r.text()).then(console.log);
