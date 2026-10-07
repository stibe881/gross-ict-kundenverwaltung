// Bilder aus dem CRM-Speicher (Supabase Storage) werden beim Bauen der Seite
// heruntergeladen, auf eine sinnvolle Grösse gebracht und als WebP
// komprimiert — Uploads direkt vom Handy sind oft mehrere MB gross.
// Lokale Bilder (/img/…) und alles, was nicht klappt, bleiben unverändert.
import { getImage } from "astro:assets";

export async function optimiertesBild(src: string | null | undefined, breite = 1100): Promise<string | null> {
  if (!src) return null;
  if (!/^https?:\/\//i.test(src)) return src;
  try {
    const bild = await getImage({ src, width: breite, inferSize: true, format: "webp", quality: 76 });
    return bild.src;
  } catch (e) {
    console.warn("[Bild] Optimierung fehlgeschlagen, Original wird verwendet:", src, (e as Error).message);
    return src;
  }
}
