if (!process.env.SUPABASE_SERVICE_ROLE_KEY) { console.error('SUPABASE_SERVICE_ROLE_KEY fehlt (Wert aus dem Supabase-Dashboard in die lokale .env eintragen; siehe .env.example).'); process.exit(1); }
// Apply storage policies using supabase-js admin client
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://bvluvvyvftygnxtmboxw.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  // Verify bucket exists and is public
  const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
  const linkLogosBucket = buckets?.find(b => b.id === 'link-logos');
  
  if (!linkLogosBucket) {
    console.error('Bucket link-logos not found!');
    return;
  }
  
  console.log('Bucket link-logos found:', JSON.stringify(linkLogosBucket, null, 2));
  
  // Test upload with a small test file to verify permissions work
  const testBlob = new Blob(['test'], { type: 'text/plain' });
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('link-logos')
    .upload('test/test.txt', testBlob, { upsert: true });
  
  if (uploadError) {
    console.error('Upload test FAILED:', uploadError.message);
    console.log('\nThe bucket exists but upload policies may be missing.');
    console.log('Please go to Supabase Dashboard > Storage > link-logos > Policies');
    console.log('And add the following policies manually:');
    console.log('1. INSERT for authenticated users: bucket_id = "link-logos"');
    console.log('2. UPDATE for authenticated users: bucket_id = "link-logos"');
    console.log('3. SELECT for public: bucket_id = "link-logos"');
    console.log('4. DELETE for authenticated users: bucket_id = "link-logos"');
  } else {
    console.log('Upload test PASSED:', uploadData);
    
    // Clean up test file
    await supabase.storage.from('link-logos').remove(['test/test.txt']);
    console.log('Test file cleaned up. Bucket is fully working!');
    
    // Get and show public URL
    const { data: urlData } = supabase.storage.from('link-logos').getPublicUrl('test/logo.jpg');
    console.log('Example public URL:', urlData.publicUrl);
  }
}

main().catch(console.error);
