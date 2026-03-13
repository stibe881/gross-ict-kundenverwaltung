fetch("https://bvluvvyvftygnxtmboxw.supabase.co/functions/v1/analyze-receipt", {
    method: "POST",
    headers: {
        "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2bHV2dnl2ZnR5Z254dG1ib3h3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMzU1NTQsImV4cCI6MjA4NTgxMTU1NH0.sw1wb1pLj9Ne-ZoGbQcR6mA5yDHe2PZbImEzt76lP-o",
        "Content-Type": "application/json"
    },
    body: JSON.stringify({
        fileBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        mimeType: "image/png"
    })
}).then(r => r.text()).then(t => console.log(t)).catch(console.error);
