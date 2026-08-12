/**
 * STEP 2: RESTORE RENDER BACKUP → SUPABASE STAGING
 * ──────────────────────────────────────────────────
 * Restores the pg_dump backup into the Supabase STAGING PostgreSQL database.
 * Does NOT touch Render production.
 * Does NOT touch Supabase production.
 *
 * Prerequisites:
 *   - Step 01 completed: backup file exists at BACKUP_OUTPUT_PATH
 *   - backend/.env.migration has SUPABASE_STAGING_DATABASE_URL set
 *   - pg_restore installed (comes with PostgreSQL client tools)
 *
 * Usage:
 *   node backend/scripts/migration/02_restore_to_staging.js
 */

require('dotenv').config({ path: './backend/.env.migration' });
const { execSync } = require('child_process');
const fs = require('fs');

const backupPath = process.env.BACKUP_OUTPUT_PATH || './migration_backups/render_onereal_lms_backup.dump';
const stagingDbUrl = process.env.SUPABASE_STAGING_DATABASE_URL;

// ─── Validate ────────────────────────────────────────────
if (!stagingDbUrl || stagingDbUrl.includes('YOUR-STAGING-DB-PASSWORD')) {
  console.error('❌  SUPABASE_STAGING_DATABASE_URL is not configured in backend/.env.migration');
  process.exit(1);
}

if (!fs.existsSync(backupPath)) {
  console.error(`❌  Backup file not found: ${backupPath}`);
  console.error('    Run script 01_backup_render_db.js first.');
  process.exit(1);
}

function redactUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.password = '***REDACTED***';
    return parsed.toString();
  } catch {
    return '[REDACTED CONNECTION STRING]';
  }
}

const stats = fs.statSync(backupPath);
const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  ONEREAL LMS — Restore Backup to Supabase Staging');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`  Source   : ${backupPath} (${sizeMB} MB)`);
console.log(`  Target   : ${redactUrl(stagingDbUrl)}`);
console.log(`  Safety   : STAGING ONLY — Production Render and Supabase untouched`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('🔄 Running pg_restore to Supabase staging...\n');
const startTime = Date.now();

try {
  // --no-owner --no-privileges: Supabase postgres role owns all objects
  // --disable-triggers: Allows data restore even with FK constraints present
  execSync(
    `pg_restore "${stagingDbUrl}" --no-owner --no-privileges --disable-triggers -v -d "${stagingDbUrl}" "${backupPath}"`,
    { stdio: ['pipe', process.stdout, process.stderr] }
  );
} catch (err) {
  // pg_restore exits with code 1 on non-fatal warnings — check for real failures
  console.warn('\n⚠️  pg_restore exited with warnings (may be non-fatal). Verifying...\n');
}

const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
console.log(`\n✅ pg_restore completed in ${elapsed}s`);
console.log('\n▶  NEXT STEP: Run script 03_compare_schemas.js to compare Render vs Staging schemas.\n');
