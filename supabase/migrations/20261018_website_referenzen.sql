-- Referenzen für die Website gross-ict.ch: im CRM gepflegt,
-- von der Website über die Edge Function website-referenzen geladen.
create table if not exists public.website_references (
  id uuid primary key default gen_random_uuid(),
  name text not null,                 -- Kundenname, z.B. "GJONI WORK"
  titel text not null,                -- Projekttitel, z.B. "Reinigungs- & Hauswartungsdienste"
  beschreibung text,
  url text,                           -- Link zur Kundenwebseite
  url_label text,                     -- Anzeigetext, z.B. "gjoni-work.ch"
  tags text[] not null default '{}',
  bild_url text,                      -- Screenshot der Kundenseite (im Monitor)
  umgebung_bild_url text,             -- Umgebungsfoto; leer = Screenshot unscharf als Hintergrund
  sort_order integer not null default 0,
  active boolean not null default true,
  customer_id uuid references public.customers(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.website_references enable row level security;

drop policy if exists "website_references_authenticated_all" on public.website_references;
create policy "website_references_authenticated_all"
  on public.website_references for all
  to authenticated
  using (true)
  with check (true);

-- Bestehende Referenzen der Website als Startdaten
insert into public.website_references (name, titel, beschreibung, url, url_label, tags, bild_url, umgebung_bild_url, sort_order)
select * from (values
  ('GJONI WORK', 'Reinigungs- & Hauswartungsdienste',
   'Webauftritt für das Reinigungsunternehmen aus Emmenbrücke — klar strukturiert und auf Kundengewinnung ausgelegt.',
   'https://gjoni-work.ch', 'gjoni-work.ch',
   array['Webdesign','Frontend','MS365 Tenant'],
   '/img/referenzen/gjoni.webp', '/img/umgebung/office.webp', 10),
  ('STEINMANN MELKTECHNIK GMBH', 'Unternehmenswebseite',
   'Webpräsenz für Melktechnik und Stalleinrichtungen — mit Produkten, Projekten und Referenzen direkt vom Hof.',
   'https://steinmannhoftech.ch', 'steinmannhoftech.ch',
   array['Webdesign','Frontend','Dienstleistungen'],
   '/img/referenzen/steinmann.webp', '/img/umgebung/barn.webp', 20),
  ('VIER KORKEN', 'Premium-Weinshop',
   'Onlineshop für erlesene Weine aus aller Welt — elegant, schnell und mit klarem Bestellprozess.',
   'https://vierkorken.ch', 'vierkorken.ch',
   array['Webdesign','Webshop','Backend'],
   '/img/referenzen/vierkorken.webp', '/img/umgebung/cellar.webp', 30),
  ('ACKERT GARTEN GMBH', 'Digitale Präsenz',
   'Webauftritt für den Gartenbaubetrieb — mit SEO-Basis und Inhalten, die das Team selbst pflegt.',
   'https://ackert.ch', 'ackert.ch',
   array['Webdesign','Frontend','Dienstleistungen'],
   '/img/referenzen/ackert.webp', '/img/umgebung/garden.webp', 40),
  ('DIE ROLLENDE PIZZERIA', 'Webseite & digitale Speisekarte',
   'Mobil-optimierte Website mit digitaler Speisekarte und klarer Bestellführung — fürs Geschäft auf vier Rädern.',
   'https://rollendepizzeria.ch', 'rollendepizzeria.ch',
   array['Webdesign','Frontend','MS365 Tenant'],
   '/img/referenzen/pizzeria.webp', '/img/umgebung/pizza.webp', 50),
  ('FC ZELL', 'Vereinswebseite',
   'Webpräsenz für den Fussballclub Zell — mit Mannschaften, News, Spielplan und aktivem Vereinsleben.',
   'https://fczell.ch', 'fczell.ch',
   array['Webdesign','Frontend'],
   '/img/referenzen/fczell.webp', null, 60)
) as v(name, titel, beschreibung, url, url_label, tags, bild_url, umgebung_bild_url, sort_order)
where not exists (select 1 from public.website_references);
