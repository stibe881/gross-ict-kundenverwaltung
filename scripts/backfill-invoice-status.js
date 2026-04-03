const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY 
  || process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Missing SUPABASE_URL or key. Check .env.local');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false }
});

async function run() {
  // 1. Find all invoice IDs with a 'viewed' activity
  const { data: viewed, error: viewedErr } = await supabase
    .from('invoice_activities')
    .select('invoice_id')
    .eq('type', 'viewed');

  if (viewedErr) { console.error('Error fetching activities:', viewedErr.message); process.exit(1); }

  if (!viewed || viewed.length === 0) {
    console.log('No viewed activities found — nothing to backfill.');
    return;
  }

  const ids = [...new Set(viewed.map(v => v.invoice_id))];
  console.log(`Found ${ids.length} invoice(s) with viewed activities.`);

  // 2. Update status to 'sent' where still 'open'
  const { data: updated, error: updateErr } = await supabase
    .from('invoices')
    .update({ status: 'sent' })
    .in('id', ids)
    .eq('status', 'open')
    .select('id, invoice_number, status');

  if (updateErr) { console.error('Error updating invoices:', updateErr.message); process.exit(1); }

  console.log(`Updated ${updated ? updated.length : 0} invoice(s) to status 'sent'.`);
  if (updated && updated.length > 0) {
    updated.forEach(inv => console.log(` - ${inv.invoice_number} → ${inv.status}`));
  }
}

run().catch(e => { console.error(e); process.exit(1); });
