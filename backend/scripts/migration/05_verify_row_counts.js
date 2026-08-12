/**
 * STEP 5: DATA INTEGRITY — Row Count & Relationship Verification
 * ──────────────────────────────────────────────────────────────
 * Compares row counts for all tables between Render Production and
 * Supabase Staging to verify data was correctly transferred.
 *
 * Usage:
 *   node backend/scripts/migration/05_verify_row_counts.js
 */

require('dotenv').config({ path: './backend/.env.migration' });
const { Client } = require('pg');
const fs = require('fs');

const renderDbUrl = process.env.RENDER_DATABASE_URL;
const stagingDbUrl = process.env.SUPABASE_STAGING_DATABASE_URL;

function redactUrl(url) {
  try { const p = new URL(url); p.password = '***'; return p.toString(); } catch { return '[REDACTED]'; }
}

const CORE_TABLES = [
  'users', 'students', 'teachers', 'classes', 'subjects', 'courses',
  'course_classes', 'course_teachers', 'topics', 'materials', 'simulations',
  'material_progress', 'notes', 'quizzes', 'quiz_questions', 'quiz_options',
  'quiz_attempts', 'quiz_answers', 'quiz_retake_grants', 'quiz_classes',
  'assignments', 'assignment_classes', 'submissions', 'rubric_criteria',
  'submission_rubric_scores', 'attendance', 'messages', 'notifications',
  'settings', 'achievements', 'live_classes', 'audit_logs', 'academic_sessions',
  'backup_logs', 'forum_categories', 'forum_threads', 'forum_posts',
  'shop_items', 'shop_interests', 'timetable_entries',
];

// Relationship integrity checks
const RELATIONSHIP_CHECKS = [
  { label: 'Students → Users', query: `SELECT COUNT(*) FROM students s LEFT JOIN users u ON s."userId"=u.id WHERE u.id IS NULL` },
  { label: 'Teachers → Users', query: `SELECT COUNT(*) FROM teachers t LEFT JOIN users u ON t."userId"=u.id WHERE u.id IS NULL` },
  { label: 'Courses → Subjects', query: `SELECT COUNT(*) FROM courses c LEFT JOIN subjects s ON c."subjectId"=s.id WHERE s.id IS NULL` },
  { label: 'Quiz Attempts → Students', query: `SELECT COUNT(*) FROM quiz_attempts qa LEFT JOIN students s ON qa."studentId"=s.id WHERE s.id IS NULL` },
  { label: 'Submissions → Students', query: `SELECT COUNT(*) FROM submissions sub LEFT JOIN students s ON sub."studentId"=s.id WHERE s.id IS NULL` },
  { label: 'Messages → Sender', query: `SELECT COUNT(*) FROM messages m LEFT JOIN users u ON m."senderId"=u.id WHERE u.id IS NULL` },
];

async function countAllTables(client) {
  const counts = {};
  for (const table of CORE_TABLES) {
    try {
      const res = await client.query(`SELECT COUNT(*) FROM "${table}"`);
      counts[table] = parseInt(res.rows[0].count);
    } catch (e) {
      counts[table] = `ERROR: ${e.message}`;
    }
  }
  return counts;
}

async function checkRelationships(client, label) {
  const results = [];
  for (const check of RELATIONSHIP_CHECKS) {
    try {
      const res = await client.query(check.query);
      const orphans = parseInt(res.rows[0].count);
      results.push({ label: check.label, orphans, ok: orphans === 0 });
    } catch (e) {
      results.push({ label: check.label, orphans: -1, ok: false, error: e.message });
    }
  }
  return results;
}

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  ONEREAL LMS — Row Count & Relationship Verification');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const renderClient = new Client({ connectionString: renderDbUrl, ssl: { rejectUnauthorized: false } });
  const stagingClient = new Client({ connectionString: stagingDbUrl, ssl: { rejectUnauthorized: false } });

  await renderClient.connect();
  await stagingClient.connect();

  try {
    console.log('📊 Counting rows across all 39 tables...\n');
    const [renderCounts, stagingCounts] = await Promise.all([
      countAllTables(renderClient),
      countAllTables(stagingClient),
    ]);

    const report = [];
    let mismatches = 0;
    let errors = 0;

    report.push('## ROW COUNT COMPARISON\n');
    report.push(`${'Table'.padEnd(35)} ${'Render'.padEnd(12)} ${'Staging'.padEnd(12)} Status`);
    report.push('-'.repeat(75));

    for (const table of CORE_TABLES) {
      const r = renderCounts[table];
      const s = stagingCounts[table];
      const isError = typeof r === 'string' || typeof s === 'string';
      const match = !isError && r === s;
      const status = isError ? '❌ ERROR' : match ? '✅ MATCH' : '⚠️  MISMATCH';

      if (isError) errors++;
      else if (!match) mismatches++;

      report.push(`${table.padEnd(35)} ${String(r).padEnd(12)} ${String(s).padEnd(12)} ${status}`);
    }

    console.log(report.join('\n'));

    // ─── Relationship integrity ──────────────────────────
    console.log('\n## RELATIONSHIP INTEGRITY (staging)\n');
    const relationships = await checkRelationships(stagingClient, 'Staging');
    let relFails = 0;
    for (const r of relationships) {
      console.log(`  ${r.ok ? '✅' : '❌'} ${r.label}: ${r.ok ? 'No orphans' : `${r.orphans} orphaned rows`}${r.error ? ` (${r.error})` : ''}`);
      if (!r.ok) relFails++;
    }

    const timestamp = new Date().toISOString();
    const summary = [
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '  VERIFICATION SUMMARY',
      `  Timestamp  : ${timestamp}`,
      `  Mismatches : ${mismatches}`,
      `  Errors     : ${errors}`,
      `  Rel. Fails : ${relFails}`,
      (mismatches === 0 && errors === 0 && relFails === 0)
        ? '  Status     : ✅ ALL CHECKS PASSED'
        : `  Status     : ⚠️  ISSUES DETECTED — DO NOT PROCEED TO PRODUCTION`,
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    ].join('\n');

    console.log(summary);

    const fullReport = report.join('\n') + summary;
    fs.mkdirSync('./migration_backups', { recursive: true });
    fs.writeFileSync('./migration_backups/row_count_verification.txt', fullReport);
    console.log('\n📄 Report saved to: migration_backups/row_count_verification.txt');

    if (mismatches > 0 || errors > 0 || relFails > 0) {
      process.exit(1);
    } else {
      console.log('\n▶  NEXT STEP: Run 06_test_rls_security.js for the RLS security test suite.\n');
    }
  } finally {
    await renderClient.end();
    await stagingClient.end();
  }
}

main().catch(err => {
  console.error('❌ Row count verification failed:', err.message);
  process.exit(1);
});
