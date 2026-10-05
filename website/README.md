# gross-ict.ch — Website

Statische Website (Astro). Lokal starten:

```
cd website
npm install      (nur beim ersten Mal)
npm run dev      → http://localhost:4321
```

Fertige Version prüfen: `npm run build && npm run preview`

Online stellen: GitHub → Actions → "Website deployen" → Run workflow.
Das lädt `dist/` auf den Hetzner-Webspace (public_html), lässt
`portal/` unangetastet. Die bestehende Seite bleibt bis dahin live.

Kontaktformular → Supabase Edge Function `contact-form` → Lead im CRM.
