import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('--- Supabase Migration Squash ---');
console.log('This script will:');
console.log('1. Dump the remote database schema into a new baseline migration.');
console.log('2. Delete all old local migrations.');
console.log('3. Repair the local and remote migration history to mark the baseline as applied.');
console.log('Make sure you have linked your project: npx supabase link');
console.log('---------------------------------');

const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
if (fs.existsSync(migrationsDir)) {
  const files = fs.readdirSync(migrationsDir);
  console.log(`Found ${files.length} old migrations. Backing them up to temp_migrations...`);
  const tempDir = path.join(process.cwd(), 'temp_migrations');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
  for (const file of files) {
    fs.renameSync(path.join(migrationsDir, file), path.join(tempDir, file));
  }
} else {
  fs.mkdirSync(migrationsDir, { recursive: true });
}

console.log('Dumping remote schema to 00000000000000_baseline.sql...');
try {
  execSync('npx supabase db dump -f supabase/migrations/00000000000000_baseline.sql --linked', { stdio: 'inherit' });
} catch (e) {
  console.error('Failed to dump remote schema. Make sure you are logged in and linked.');
  process.exit(1);
}

console.log('Repairing local and remote migration history...');
try {
  execSync('npx supabase migration repair --status applied 00000000000000 --local', { stdio: 'inherit' });
  execSync('npx supabase migration repair --status applied 00000000000000 --linked', { stdio: 'inherit' });
  console.log('Successfully squashed migrations! You can now use `npx supabase db push` normally.');
} catch (e) {
  console.error('Failed to repair migration history:', e.message);
}
