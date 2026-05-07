import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://bvluvvyvftygnxtmboxw.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2bHV2dnl2ZnR5Z254dG1ib3h3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDIzNTU1NCwiZXhwIjoyMDg1ODExNTU0fQ.YNNjhdRrdzU6mZWAGvIq0sYKsyPLNd4PXw_1S_mwSQM'
);

async function check() {
  const { data, error } = await supabase.from('monitoring_urls').select('name, url, last_status, last_error, last_checked_at, expected_keyword');
  console.log(JSON.stringify(data, null, 2));
}

check();
