const https = require('https');

const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2bHV2dnl2ZnR5Z254dG1ib3h3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDIzNTU1NCwiZXhwIjoyMDg1ODExNTU0fQ.YNNjhdRrdzU6mZWAGvIq0sYKsyPLNd4PXw_1S_mwSQM';
const projectRef = 'bvluvvyvftygnxtmboxw';

// Apply policies one by one
const policies = [
  "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated uploads to link-logos' AND tablename = 'objects') THEN CREATE POLICY \"Allow authenticated uploads to link-logos\" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'link-logos'); END IF; END $$;",
  "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated updates to link-logos' AND tablename = 'objects') THEN CREATE POLICY \"Allow authenticated updates to link-logos\" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'link-logos'); END IF; END $$;",
  "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated deletes from link-logos' AND tablename = 'objects') THEN CREATE POLICY \"Allow authenticated deletes from link-logos\" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'link-logos'); END IF; END $$;",
  "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public reads from link-logos' AND tablename = 'objects') THEN CREATE POLICY \"Allow public reads from link-logos\" ON storage.objects FOR SELECT TO public USING (bucket_id = 'link-logos'); END IF; END $$;"
];

async function runQuery(sql) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query: sql });
    const options = {
      hostname: projectRef + '.supabase.co',
      path: '/rest/v1/rpc/query',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + serviceKey,
        'apikey': serviceKey,
        'Content-Length': Buffer.byteLength(body)
      }
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  for (const policy of policies) {
    const result = await runQuery(policy);
    console.log('Status:', result.status, result.body.substring(0, 100));
  }
}

main().catch(console.error);
