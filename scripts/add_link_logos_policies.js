// Add RLS policies for link-logos bucket using Supabase Management API
const https = require('https');

const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2bHV2dnl2ZnR5Z254dG1ib3h3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDIzNTU1NCwiZXhwIjoyMDg1ODExNTU0fQ.YNNjhdRrdzU6mZWAGvIq0sYKsyPLNd4PXw_1S_mwSQM';
const projectRef = 'bvluvvyvftygnxtmboxw';

// Use the pg endpoint via PostgREST for SQL - won't work without pg access
// Alternative: use the storage API to create policies

const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(
  'https://' + projectRef + '.supabase.co',
  serviceKey,
  { db: { schema: 'storage' } }
);

async function insertPolicy(name, action, roles, check_expr, using_expr) {
  const { data, error } = await supabaseAdmin
    .from('policies')
    .insert({
      name,
      action,
      roles,
      check: check_expr,
      qual: using_expr,
      table: 'objects',
      schema: 'storage'
    })
    .select();
  return { data, error };
}

async function main() {
  // Try inserting policies directly into storage.policies table
  const policies = [
    {
      name: 'Allow authenticated uploads to link-logos',
      action: 'INSERT',
      roles: ['authenticated'],
      check_expr: "(bucket_id = 'link-logos')",
      using_expr: null
    },
    {
      name: 'Allow authenticated updates to link-logos',
      action: 'UPDATE',
      roles: ['authenticated'],
      check_expr: null,
      using_expr: "(bucket_id = 'link-logos')"
    },
    {
      name: 'Allow authenticated deletes from link-logos',
      action: 'DELETE',
      roles: ['authenticated'],
      check_expr: null,
      using_expr: "(bucket_id = 'link-logos')"
    },
    {
      name: 'Allow public reads from link-logos',
      action: 'SELECT',
      roles: ['public'],
      check_expr: null,
      using_expr: "(bucket_id = 'link-logos')"
    }
  ];

  for (const p of policies) {
    const result = await insertPolicy(p.name, p.action, p.roles, p.check_expr, p.using_expr);
    if (result.error) {
      console.log('Policy', p.name, ':', result.error.message);
    } else {
      console.log('Policy', p.name, ': created');
    }
  }
}

main().catch(console.error);
