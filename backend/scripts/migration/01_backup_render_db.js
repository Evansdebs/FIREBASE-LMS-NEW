/**
 * STEP 1: RENDER POSTGRESQL — Read-Only Backup via pg_dump
 * ─────────────────────────────────────────────────────────
 * Performs a read-only binary dump of the Render PostgreSQL production database.
 * NO writes, NO modifications to Render.
 *
 * Prerequisites:
 *   - pg_dump installed locally (comes with PostgreSQL client tools)
 *   - backend/.env.migration populated with RENDER_DATABASE_URL and BACKUP_OUTPUT_PATH
 *
 * Usage:
 *   node backend/scripts/migration/01_backup_render_db.js
 */

require('dotenv').config({ path: './backend/.env.migration' });
if (!process.env.RENDER_DATABASE_URL) {
  require('dotenv').config({ path: './backend/env.migration' });
}
const { execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const renderDbUrl = process.env.RENDER_DATABASE_URL;
const backupPath = process.env.BACKUP_OUTPUT_PATH || './migration_backups/render_onereal_lms_backup.dump';

// ─── Validate env ────────────────────────────────────────
if (!renderDbUrl || renderDbUrl.includes('RENDER_USER')) {
  console.error('❌  RENDER_DATABASE_URL is not configured in backend/.env.migration');
  console.error('    Copy backend/.env.migration.example → backend/.env.migration and fill in credentials.');
  process.exit(1);
}

// ─── Ensure backup output directory exists ───────────────
const backupDir = path.dirname(backupPath);
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
  console.log(`📁 Created backup directory: ${backupDir}`);
}

// ─── Redact password from logs ───────────────────────────
function redactUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.password = '***REDACTED***';
    return parsed.toString();
  } catch {
    return '[REDACTED CONNECTION STRING]';
  }
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  ONEREAL LMS — Render PostgreSQL Backup (Phase 2)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`  Source : ${redactUrl(renderDbUrl)}`);
console.log(`  Output : ${backupPath}`);
console.log(`  Format : Custom binary (-Fc) — supports selective restore`);
console.log(`  Mode   : READ-ONLY — zero writes to Render`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// ─── Check pg_dump is available ──────────────────────────
try {
  const pgVersion = execSync('pg_dump --version', { stdio: 'pipe' }).toString().trim();
  console.log(`✅ pg_dump available: ${pgVersion}`);
} catch (e) {
  console.error('❌  pg_dump not found on PATH.');
  console.error('    Install PostgreSQL client tools: https://www.postgresql.org/download/');
  process.exit(1);
}

// ─── Run pg_dump ─────────────────────────────────────────
console.log('\n🔄 Starting read-only pg_dump...\n');
const startTime = Date.now();

const pgDumpCmd = `pg_dump "${renderDbUrl}" -F c -b -v --no-owner --no-privileges -f "${backupPath}"`;

try {
  execSync(pgDumpCmd, { stdio: ['pipe', 'pipe', process.stderr] });
} catch (err) {
  console.error('\n❌ pg_dump failed. Check your RENDER_DATABASE_URL and network access.');
  process.exit(1);
}

const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

// ─── Verify backup ───────────────────────────────────────
if (!fs.existsSync(backupPath)) {
  console.error('❌  Backup file was not created.');
  process.exit(1);
}

const stats = fs.statSync(backupPath);
const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
const timestamp = stats.mtime.toISOString();

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  BACKUP VERIFICATION REPORT');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`  File     : ${backupPath}`);
console.log(`  Size     : ${sizeMB} MB (${stats.size} bytes)`);
console.log(`  Timestamp: ${timestamp}`);
console.log(`  Duration : ${elapsed}s`);
console.log(`  Format   : PostgreSQL custom binary (-Fc)`);

// ─── Run pg_restore --list to verify contents ────────────
try {
  const listOutput = execSync(`pg_restore --list "${backupPath}"`, { stdio: 'pipe' }).toString();
  const tableMatches = [...listOutput.matchAll(/TABLE DATA public (\S+)/g)];
  const schemaItems = listOutput.split('\n').filter(l => l.trim() && !l.startsWith(';'));
  console.log(`  Tables   : ${tableMatches.length} data tables detected`);
  console.log(`  Objects  : ${schemaItems.length} total schema/data objects`);
  console.log(`  Integrity: ✅ pg_restore --list succeeded — dump is structurally valid`);

  // Save object list to file (no secrets, safe to write)
  const listPath = backupPath.replace('.dump', '_object_list.txt');
  fs.writeFileSync(listPath, listOutput);
  console.log(`  Manifest : Saved to ${listPath}`);
} catch (e) {
  console.error('  ⚠️  pg_restore --list failed — backup may be corrupt:', e.message);
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('\n✅ Backup complete. Render PostgreSQL remains unmodified.');
console.log('\n▶  NEXT STEP: Run script 02_restore_to_staging.js to restore into the Supabase staging DB.\n');
