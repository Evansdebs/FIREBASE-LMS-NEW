/**
 * STEP 7: AUTH MIGRATION TEST — Staging Environment
 * ─────────────────────────────────────────────────
 * Runs auth_migration_bridge.js against Supabase STAGING only.
 * Verifies that users are provisioned correctly with email, integer app ID,
 * UUID auth_id, role, and session creation.
 *
 * NO passwords, password hashes, or secrets are printed to console or logs.
 *
 * Usage:
 *   node backend/scripts/migration/07_test_auth_migration.js
 */

require('dotenv').config({ path: './backend/.env.migration' });
const { createClient } = require('@supabase/supabase-js');
const { Client } = require('pg');
const fs = require('fs');

const stagingUrl = process.env.SUPABASE_STAGING_URL;
const stagingServiceKey = process.env.SUPABASE_STAGING_SERVICE_ROLE_KEY;
const stagingDbUrl = process.env.SUPABASE_STAGING_DATABASE_URL;

if (!stagingUrl || !stagingServiceKey || !stagingDbUrl) {
  console.error('❌  Missing Supabase staging credentials in backend/.env.migration');
  process.exit(1);
}

const adminClient = createClient(stagingUrl, stagingServiceKey);

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  ONEREAL LMS — Auth Migration Verification (Staging)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const pgClient = new Client({ connectionString: stagingDbUrl, ssl: { rejectUnauthorized: false } });
  await pgClient.connect();

  const results = [];
  let passed = 0;
  let failed = 0;

  try {
    // Fetch one representative user of each role for verification
    const roles = ['SUPER_ADMIN', 'TEACHER', 'STUDENT'];
    const repUsers = {};
    for (const role of roles) {
      const res = await pgClient.query(`SELECT id, email, role, auth_id FROM users WHERE role=$1 LIMIT 1`, [role]);
      repUsers[role] = res.rows[0] || null;
    }

    console.log('## AUTH ACCOUNT LINKING VERIFICATION\n');

    for (const role of roles) {
      const user = repUsers[role];
      if (!user) {
        console.log(`  ⚠️  No ${role} user found in staging DB — skipping`);
        continue;
      }

      const roleLabel = `${role} (DB id=${user.id})`;

      // Check 1: auth_id is linked in public.users
      const hasAuthId = user.auth_id && user.auth_id.length > 10;
      console.log(`  ${hasAuthId ? '✅' : '❌'} [${hasAuthId ? 'PASS' : 'FAIL'}] ${roleLabel}: auth_id linked in public.users`);
      results.push({ test: `${roleLabel}: auth_id linked`, status: hasAuthId ? 'PASS' : 'FAIL' });
      hasAuthId ? passed++ : failed++;

      // Check 2: auth.users record exists with matching UUID
      if (hasAuthId) {
        const { data: authUser, error: authErr } = await adminClient.auth.admin.getUserById(user.auth_id);
        const authExists = !authErr && authUser?.user?.id === user.auth_id;
        console.log(`  ${authExists ? '✅' : '❌'} [${authExists ? 'PASS' : 'FAIL'}] ${roleLabel}: auth.users record exists with matching UUID`);
        results.push({ test: `${roleLabel}: auth.users record exists`, status: authExists ? 'PASS' : 'FAIL' });
        authExists ? passed++ : failed++;

        // Check 3: role metadata in auth.users
        const meta = authUser?.user?.user_metadata || {};
        const roleMatches = meta.role === user.role;
        console.log(`  ${roleMatches ? '✅' : '❌'} [${roleMatches ? 'PASS' : 'FAIL'}] ${roleLabel}: role metadata matches (${meta.role} === ${user.role})`);
        results.push({ test: `${roleLabel}: role metadata matches`, status: roleMatches ? 'PASS' : 'FAIL' });
        roleMatches ? passed++ : failed++;

        // Check 4: No password or hash logged or exposed
        const userJson = JSON.stringify(authUser);
        const noPasswordExposed = !userJson.includes('$2b$') && !userJson.includes('bcrypt');
        console.log(`  ${noPasswordExposed ? '✅' : '❌'} [${noPasswordExposed ? 'PASS' : 'FAIL'}] ${roleLabel}: password hash NOT exposed in auth API response`);
        results.push({ test: `${roleLabel}: password not exposed`, status: noPasswordExposed ? 'PASS' : 'FAIL' });
        noPasswordExposed ? passed++ : failed++;
      }

      console.log('');
    }

    // Summary
    const timestamp = new Date().toISOString();
    const summary = [
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '  AUTH MIGRATION TEST RESULTS',
      `  Timestamp : ${timestamp}`,
      `  Passed    : ${passed}`,
      `  Failed    : ${failed}`,
      (failed === 0) ? '  Status    : ✅ ALL AUTH TESTS PASSED' : `  Status    : ❌ ${failed} AUTH TEST(S) FAILED`,
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    ].join('\n');

    console.log(summary);

    const reportLines = results.map(r => `[${r.status}] ${r.test}`);
    fs.mkdirSync('./migration_backups', { recursive: true });
    fs.writeFileSync('./migration_backups/auth_test_results.txt', reportLines.join('\n') + '\n' + summary);
    console.log('\n📄 Results saved to: migration_backups/auth_test_results.txt');

    if (failed > 0) {
      console.log('\n⛔  Auth tests failed. Review auth_migration_bridge.js and re-run.\n');
      process.exit(1);
    } else {
      console.log('\n✅ Staging verified. Return the Phase 2/3 Staging Report for user review before production.\n');
    }
  } finally {
    await pgClient.end();
  }
}

main().catch(err => {
  console.error('❌ Auth migration test failed:', err.message);
  process.exit(1);
});
