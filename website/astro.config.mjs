import { defineConfig } from "astro/config";

// Statische Website für gross-ict.ch — kein Server nötig,
// das Build-Ergebnis (dist/) wird per rsync auf den Webspace geladen.
export default defineConfig({
  site: "https://gross-ict.ch",
  trailingSlash: "never",
  // Bereichsseiten werden beim Darüberfahren vorgeladen (data-astro-prefetch),
  // damit der Berg-Morph beim Klick ohne Ladepause startet.
  prefetch: true,
  build: {
    format: "file",
  },
});
