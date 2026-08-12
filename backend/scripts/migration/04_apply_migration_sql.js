/**
 * STEP 4: APPLY SUPABASE MIGRATION SQL TO STAGING
 * ────────────────────────────────────────────────
 * Applies backend/prisma/supabase_migration.sql against the Supabase
 * STAGING database only. Never touches Render or Supabase production.
 *
 * Usage:
 *   node backend/scripts/migration/04_apply_migration_sql.js
 */

require('dotenv').config({ path: './backend/.env.migration' });
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const stagingDbUrl = process.env.SUPABASE_STAGING_DATABASE_URL;
const sqlPath = path.resolve('./backend/prisma/supabase_migration.sql');

if (!stagingDbUrl || stagingDbUrl.includes('YOUR-STAGING-DB-PASSWORD')) {
  console.error('❌  SUPABASE_STAGING_DATABASE_URL not configured.');
  process.exit(1);
}

if (!fs.existsSync(sqlPath)) {
  console.error(`❌  Migration SQL not found: ${sqlPath}`);
  process.exit(1);
}

async function main() {
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const client = new Client({ connectionString: stagingDbUrl, ssl: { rejectUnauthorized: false } });

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  ONEREAL LMS — Apply Migration SQL to Staging');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  SQL File : ${sqlPath}`);
  console.log(`  Target   : SUPABASE STAGING (not production)`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await client.connect();
  try {
    console.log('🔄 Executing supabase_migration.sql...');
    await client.query(sql);
    console.log('✅ Migration SQL applied successfully.\n');

    // ─── Verify key objects were created ────────────────────────
    console.log('🔍 Verifying migration objects...\n');

    const checks = [
      { label: 'auth_id column on users', query: `SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name='auth_id'` },
      { label: 'RPC: get_current_user_id()', query: `SELECT proname FROM pg_proc WHERE proname='get_current_user_id'` },
      { label: 'RPC: get_student_quiz()', query: `SELECT proname FROM pg_proc WHERE proname='get_student_quiz'` },
      { label: 'RPC: submit_quiz_attempt()', query: `SELECT proname FROM pg_proc WHERE proname='submit_quiz_attempt'` },
      { label: 'RPC: calculate_bece_aggregate()', query: `SELECT proname FROM pg_proc WHERE proname='calculate_bece_aggregate'` },
      { label: 'RLS enabled on users', query: `SELECT relrowsecurity FROM pg_class WHERE relname='users' AND relrowsecurity=true` },
      { label: 'RLS enabled on quiz_attempts', query: `SELECT relrowsecurity FROM pg_class WHERE relname='quiz_attempts' AND relrowsecurity=true` },
      { label: 'RLS enabled on submissions', query: `SELECT relrowsecurity FROM pg_class WHERE relname='submissions' AND relrowsecurity=true` },
      { label: 'RLS enabled on messages', query: `SELECT relrowsecurity FROM pg_class WHERE relname='messages' AND relrowsecurity=true` },
    ];

    let passed = 0;
    let failed = 0;
    for (const check of checks) {
      const result = await client.query(check.query);
      const ok = result.rowCount > 0;
      console.log(`  ${ok ? '✅' : '❌'} ${check.label}`);
      ok ? passed++ : failed++;
    }

    console.log(`\n  Results: ${passed} PASS / ${failed} FAIL`);

    if (failed > 0) {
      console.log('\n⛔  Some migration objects were not created. Review supabase_migration.sql.\n');
      process.exit(1);
    } else {
      console.log('\n✅ All migration objects verified.\n');
      console.log('▶  NEXT STEP: Run 05_verify_row_counts.js to validate data integrity.\n');
    }
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error('❌ Migration SQL application failed:', err.message);
  process.exit(1);
});
