-- 1. contracts-Tabelle um m365_licenses erweitern
ALTER TABLE public.contracts
ADD COLUMN IF NOT EXISTS m365_licenses JSONB DEFAULT '[]'::jsonb;

-- 2. products-Tabelle um internal_cost erweitern
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS internal_cost NUMERIC(10,2) DEFAULT NULL;

-- 3. M365-Lizenzen als Produkte einfügen (falls noch nicht vorhanden)
-- Kategorie "Lizenz" wird einfach in der Textspalte 'category' gesetzt.
INSERT INTO public.products (id, name, description, price, internal_cost, vat_rate, type, unit, category, is_active, created_at, updated_at)
VALUES 
  (gen_random_uuid(), 'Microsoft 365 Business Premium (mit Teams)', 'M365 Business Premium inklusive MS Teams', 301.20, 231.60, 8.1, 'product', 'Jahr', 'Lizenz', true, now(), now()),
  (gen_random_uuid(), 'Microsoft 365 Business Premium (ohne Teams)', 'M365 Business Premium ohne MS Teams', 256.80, 198.00, 8.1, 'product', 'Jahr', 'Lizenz', true, now(), now()),
  
  (gen_random_uuid(), 'Microsoft 365 Business Standard (mit Teams)', 'M365 Business Standard inklusive MS Teams', 192.00, 147.60, 8.1, 'product', 'Jahr', 'Lizenz', true, now(), now()),
  (gen_random_uuid(), 'Microsoft 365 Business Standard (ohne Teams)', 'M365 Business Standard ohne MS Teams', 148.20, 114.00, 8.1, 'product', 'Jahr', 'Lizenz', true, now(), now()),
  
  (gen_random_uuid(), 'Microsoft 365 Business Basic (mit Teams)', 'M365 Business Basic inklusive MS Teams', 96.80, 74.40, 8.1, 'product', 'Jahr', 'Lizenz', true, now(), now()),
  (gen_random_uuid(), 'Microsoft 365 Business Basic (ohne Teams)', 'M365 Business Basic ohne MS Teams', 84.00, 57.60, 8.1, 'product', 'Jahr', 'Lizenz', true, now(), now()),
  
  (gen_random_uuid(), 'Microsoft 365 Apps for Business', 'M365 Apps for Business', 170.50, 131.10, 8.1, 'product', 'Jahr', 'Lizenz', true, now(), now())
ON CONFLICT DO NOTHING;
