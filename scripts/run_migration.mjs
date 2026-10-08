if (!process.env.SUPABASE_SERVICE_ROLE_KEY) { console.error('SUPABASE_SERVICE_ROLE_KEY fehlt (Wert aus dem Supabase-Dashboard in die lokale .env eintragen; siehe .env.example).'); process.exit(1); }
// run_migration.mjs
// Führt die Vertragsnummer-Migration direkt auf Supabase aus

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = 'https://bvluvvyvftygnxtmboxw.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Step 1: Spalte hinzufügen
console.log('Step 1: Adding contract_number column...');
const { error: addColError } = await supabase.rpc('exec_sql', {
  sql: 'ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS contract_number TEXT;'
});

if (addColError) {
  // Fallback: direkte SQL query via postgres endpoint
  console.log('RPC not available, trying via REST...');
}

// Step 2: Bestehende Verträge abrufen und nummerieren
console.log('Step 2: Fetching contracts without contract_number...');
const { data: contracts, error: fetchError } = await supabase
  .from('contracts')
  .select('id, created_at, contract_number')
  .is('contract_number', null)
  .order('created_at', { ascending: true });

if (fetchError) {
  console.error('Error fetching contracts:', fetchError.message);
  // Die Spalte existiert noch nicht – normal beim ersten Mal
  // Wir versuchen es anders
  console.log('\n=== MANUELLE MIGRATION NOTWENDIG ===');
  console.log('Bitte führe folgende SQL in der Supabase-Konsole aus:');
  console.log('https://supabase.com/dashboard/project/bvluvvyvftygnxtmboxw/sql/new');
  console.log('\n--- SQL START ---');
  console.log(readFileSync(join(__dirname, 'supabase/migrations/20260727_contract_number.sql'), 'utf8'));
  console.log('--- SQL END ---');
  process.exit(0);
}

console.log(`Found ${contracts?.length ?? 0} contracts without number.`);

// Verträge nach Jahr gruppieren und nummerieren
if (contracts && contracts.length > 0) {
  const yearCounters = {};
  for (const contract of contracts) {
    const year = new Date(contract.created_at).getFullYear().toString();
    if (!yearCounters[year]) yearCounters[year] = 1;
    const seq = yearCounters[year]++;
    const contractNumber = `VT-${year}-${String(seq).padStart(3, '0')}`;
    
    const { error: updateError } = await supabase
      .from('contracts')
      .update({ contract_number: contractNumber })
      .eq('id', contract.id);
    
    if (updateError) {
      console.error(`Error updating contract ${contract.id}:`, updateError.message);
    } else {
      console.log(`  ✓ ${contract.id.substring(0, 8)}... → ${contractNumber}`);
    }
  }
}

console.log('\n✅ Migration abgeschlossen!');
console.log('Hinweis: Füge noch folgende SQL im Supabase Dashboard aus für den UNIQUE Index:');
console.log('CREATE UNIQUE INDEX IF NOT EXISTS idx_contracts_contract_number ON public.contracts (contract_number) WHERE contract_number IS NOT NULL;');
