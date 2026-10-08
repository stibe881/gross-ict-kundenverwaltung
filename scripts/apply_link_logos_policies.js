if (!process.env.SUPABASE_SERVICE_ROLE_KEY) { console.error('SUPABASE_SERVICE_ROLE_KEY fehlt (Wert aus dem Supabase-Dashboard in die lokale .env eintragen; siehe .env.example).'); process.exit(1); }
const https = require('https');

const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
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
