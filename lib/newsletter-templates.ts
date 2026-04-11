import { generateNewsletterHtml, NewsletterBlock } from "@/components/newsletter-builder";

export const NEWSLETTER_TEMPLATES_DATA: { label: string, icon: string, data: { title: string, subject: string, bgColor: string, blocks: NewsletterBlock[] } }[] = [
  {
    label: "FitLife", icon: "bolt.fill",
    data: {
      title: "Hero Kampagne (Dunkel)", subject: "Starkes Update für Ihr Business", bgColor: "#121619",
      blocks: [
        { id: "1", type: "image", src: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=600&h=300&q=80" },
        { id: "2", type: "title", titleLevel: 1, text: "NEXT LEVEL IT" },
        { id: "3", type: "text", text: "Schützen Sie Ihre Daten mit den neuesten Sicherheitslösungen. Kompromissloser Schutz für Ihr Business, jeden Tag." },
        { id: "4", type: "button", text: "JETZT AUFRÜSTEN", url: "#" }
      ]
    }
  },
  {
    label: "Naturals", icon: "leaf.fill",
    data: {
      title: "Cloud & Storage", subject: "Entdecken Sie neue Möglichkeiten", bgColor: "#fbf8f6",
      blocks: [
        { id: "1", type: "title", titleLevel: 1, text: "Reise in die Cloud" },
        { id: "2", type: "image", src: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=600&h=300&q=80" },
        { id: "3", type: "text", text: "Nahtlose Migration, unbegrenzte Skalierbarkeit. Entdecken Sie unsere neuen Cloud-Pakete für KMU." },
        { id: "4", type: "button", text: "Pakete ansehen", url: "#" }
      ]
    }
  },
  {
    label: "ConT", icon: "square.grid.2x2.fill",
    data: {
      title: "Event RSVP", subject: "Let's meet once again - Das IT Event", bgColor: "#f2e9e1",
      blocks: [
        { id: "1", type: "title", titleLevel: 1, text: "Let's meet once again" },
        { id: "2", type: "image", src: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=600&h=300&q=80" },
        { id: "3", type: "text", text: "Das grösste Networking Event der Region. Seien Sie dabei, wenn wir die Trends von morgen besprechen." },
        { id: "4", type: "button", text: "RSVP NOW ->", url: "#" }
      ]
    }
  },
  {
    label: "Cyclo", icon: "camera.fill",
    data: {
      title: "Hardware Update", subject: "Unverwechselbare Qualität", bgColor: "#fbf8f6",
      blocks: [
        { id: "1", type: "image", src: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=600&h=400&q=80" },
        { id: "2", type: "title", titleLevel: 2, text: "UNFORGETTABLE PERFORMANCE" },
        { id: "3", type: "text", text: "Entdecken Sie die Schönheit von makellosen Setups. Mit der neuesten Ausrüstung sind Sie für jede Herausforderung bereit." },
        { id: "4", type: "button", text: "Workstations", url: "#" },
        { id: "5", type: "button", text: "Laptops", url: "#" }
      ]
    }
  },
  {
    label: "Vivid", icon: "paintbrush.fill",
    data: {
      title: "Produkt News", subject: "Frische Ideen für Ihre IT", bgColor: "#f2e9e1",
      blocks: [
        { id: "1", type: "title", titleLevel: 1, text: "LATEST UPDATES" },
        { id: "2", type: "text", text: "Wir haben brandneue Lösungen entwickelt, die Ihr Unternehmen noch agiler machen." },
        { id: "3", type: "image", src: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=600&h=300&q=80" },
        { id: "4", type: "button", text: "Alle Neuheiten", url: "#" }
      ]
    }
  },
  {
    label: "Foodly", icon: "flame.fill",
    data: {
      title: "High Contrast", subject: "Die Features dieser Woche", bgColor: "#fbf8f6",
      blocks: [
        { id: "1", type: "title", titleLevel: 1, text: "Neue Tools verfügbar!" },
        { id: "2", type: "text", text: "Profitieren Sie von exklusiven Angeboten. Sparen Sie diese Woche bei unseren Cloud-Abos." },
        { id: "3", type: "button", text: "Zum Angebot", url: "#" },
        { id: "4", type: "divider" },
        { id: "5", type: "title", titleLevel: 2, text: "Besuchen Sie das neue Portal" },
        { id: "6", type: "image", src: "https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=600&h=200&q=80" }
      ]
    }
  },
  {
    label: "Soft", icon: "heart.fill",
    data: {
      title: "Ratgeber & Tipps", subject: "Tipps für Ihren gesunden IT-Alltag", bgColor: "#f2e9e1",
      blocks: [
        { id: "1", type: "title", titleLevel: 1, text: "Guide for a Secure IT" },
        { id: "2", type: "image", src: "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&w=600&h=300&q=80" },
        { id: "3", type: "text", text: "In stressigen Zeiten ist eine funktionierende Basis Gold wert. Vertrauen Sie auf Systeme, die einfach laufen." },
        { id: "4", type: "button", text: "Ratgeber lesen", url: "#" }
      ]
    }
  },
  {
    label: "Cardio", icon: "list.bullet.rectangle",
    data: {
      title: "Server & Checks", subject: "Ihre wöchentlichen Updates", bgColor: "#fbf8f6",
      blocks: [
        { id: "1", type: "title", titleLevel: 1, text: "Weekly IT Routines" },
        { id: "2", type: "text", text: "Regelmässige Wartung schützt vor Totalausfall. Sehen Sie sich unsere Checks an." },
        { id: "3", type: "divider" },
        { id: "4", type: "title", titleLevel: 2, text: "Server Checks" },
        { id: "5", type: "text", text: "Kontrolle von Backups, Event-Logs und Speicherkapazitäten. Essenziell für einen reibungslosen Start in die Woche." },
        { id: "6", type: "button", text: "Mehr dazu", url: "#" }
      ]
    }
  },
  {
    label: "Book", icon: "book.fill",
    data: {
      title: "Neuheit Publikation", subject: "Frisch publiziert: Das neue Handbuch", bgColor: "#fbf8f6",
      blocks: [
        { id: "1", type: "image", src: "https://images.unsplash.com/photo-1589829085413-56de8ae18c73?auto=format&fit=crop&w=600&h=300&q=80" },
        { id: "2", type: "title", titleLevel: 1, text: "Neue Dokumentation" },
        { id: "3", type: "text", text: "Lernen Sie alles über die neuesten IT-Standards in unserem frisch publizierten Handbuch. Über 50 Seiten geballtes Wissen." },
        { id: "4", type: "button", text: "Jetzt gratis anfordern", url: "#" }
      ]
    }
  },
  {
    label: "Mountain", icon: "mountain.fill",
    data: {
      title: "Immersive Zukunft", subject: "Erreichen Sie neue Gipfel", bgColor: "#121619",
      blocks: [
        { id: "1", type: "image", src: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=600&h=400&q=80" },
        { id: "2", type: "title", titleLevel: 1, text: "Erreichen Sie neue Gipfel" },
        { id: "3", type: "text", text: "Lassen Sie alte Systeme hinter sich. Wir begleiten Sie beim Aufstieg in die sichere IT von morgen." },
        { id: "4", type: "button", text: "Gipfelstürmer werden", url: "#" }
      ]
    }
  }
];

export const NEWSLETTER_TEMPLATES = NEWSLETTER_TEMPLATES_DATA.map(t => ({
  label: t.label,
  icon: t.icon,
  data: {
    title: t.data.title,
    subject: t.data.subject,
    content: generateNewsletterHtml(t.data.blocks, t.data.bgColor)
  }
}));
