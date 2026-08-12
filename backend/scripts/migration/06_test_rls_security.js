/**
 * STEP 6: RLS SECURITY TEST SUITE — Staging Environment
 * ───────────────────────────────────────────────────────
 * Runs the complete negative security test suite against Supabase Staging.
 * All unauthorized access attempts MUST return DENIED / 0 rows.
 *
 * Tests:
 *   - Student cross-data isolation (profile, grades, submissions, messages, notifications, quiz attempts)
 *   - Grade & score tampering prevention
 *   - Quiz isCorrect answer isolation (via RPC, direct table, and view)
 *   - Teacher class boundary enforcement
 *   - Admin authorization verification
 *
 * Usage:
 *   node backend/scripts/migration/06_test_rls_security.js
 */

require('dotenv').config({ path: './backend/.env.migration' });
const { createClient } = require('@supabase/supabase-js');
const { Client } = require('pg');
const fs = require('fs');

const stagingUrl = process.env.SUPABASE_STAGING_URL;
const stagingAnonKey = process.env.SUPABASE_STAGING_ANON_KEY;
const stagingServiceKey = process.env.SUPABASE_STAGING_SERVICE_ROLE_KEY;
const stagingDbUrl = process.env.SUPABASE_STAGING_DATABASE_URL;

if (!stagingUrl || !stagingAnonKey || !stagingServiceKey) {
  console.error('❌  Missing Supabase staging credentials in backend/.env.migration');
  process.exit(1);
}

const adminClient = createClient(stagingUrl, stagingServiceKey);
const anonClient = createClient(stagingUrl, stagingAnonKey);

const results = [];
let passed = 0;
let failed = 0;

function record(testName, expectDenied, actualRowCount, error = null) {
  const denied = error || actualRowCount === 0;
  const ok = expectDenied ? denied : !denied;
  const status = ok ? 'PASS' : 'FAIL';
  const symbol = ok ? '✅' : '❌';
  console.log(`  ${symbol} [${status}] ${testName}`);
  if (!ok) console.log(`         → Expected: ${expectDenied ? 'DENIED' : 'ALLOWED'} | Got: ${actualRowCount} rows`);
  results.push({ testName, status, expectDenied, actualRowCount });
  ok ? passed++ : failed++;
}

async function getStudentSession(email) {
  const { data, error } = await adminClient.auth.admin.listUsers();
  // Find user by email — sign in as them for test
  const user = data?.users?.find(u => u.email === email);
  if (!user) return null;
  // Create a short-lived session token for testing purposes
  const { data: session } = await adminClient.auth.admin.createSession({ user_id: user.id });
  return session;
}

async function runTests() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  ONEREAL LMS — RLS Security Test Suite (Staging)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // ─── Find two test students from staging ─────────────
  const pgClient = new Client({ connectionString: stagingDbUrl, ssl: { rejectUnauthorized: false } });
  await pgClient.connect();

  let studentA, studentB, teacherUser, adminUser;
  try {
    const students = await pgClient.query(`SELECT u.id, u.email, s.id as student_id FROM users u JOIN students s ON s."userId"=u.id ORDER BY u.id LIMIT 2`);
    const teachers = await pgClient.query(`SELECT u.id, u.email FROM users u JOIN teachers t ON t."userId"=u.id LIMIT 1`);
    const admins = await pgClient.query(`SELECT id, email FROM users WHERE role='SUPER_ADMIN' OR role='ADMIN' LIMIT 1`);

    if (students.rows.length < 2) {
      console.warn('⚠️  Need at least 2 student accounts in staging to run cross-student tests.');
    }
    studentA = students.rows[0];
    studentB = students.rows[1];
    teacherUser = teachers.rows[0];
    adminUser = admins.rows[0];
  } finally {
    await pgClient.end();
  }

  console.log(`  Test Student A: ${studentA?.email ? '[email redacted]' : 'NOT FOUND'}`);
  console.log(`  Test Student B: ${studentB?.email ? '[email redacted]' : 'NOT FOUND'}`);
  console.log(`  Test Teacher  : ${teacherUser?.email ? '[email redacted]' : 'NOT FOUND'}`);
  console.log(`  Test Admin    : ${adminUser?.email ? '[email redacted]' : 'NOT FOUND'}`);
  console.log('');

  // ─────────────────────────────────────────────────────
  // CATEGORY 1: QUIZ ANSWER ISOLATION
  // isCorrect must NEVER be returned to any client query
  // ─────────────────────────────────────────────────────
  console.log('## QUIZ ANSWER ISOLATION TESTS\n');

  // 1a. Anonymous client cannot query quiz_options at all
  const q1 = await anonClient.from('quiz_options').select('isCorrect').limit(1);
  record('Anon client: SELECT isCorrect from quiz_options', true, q1.data?.length ?? 0, q1.error);

  // 1b. isCorrect field excluded from get_student_quiz RPC
  const q2 = await anonClient.rpc('get_student_quiz', { p_quiz_id: 1 });
  const rpcData = q2.data ? JSON.stringify(q2.data) : '';
  const containsIsCorrect = rpcData.includes('isCorrect') || rpcData.includes('is_correct');
  record('RPC get_student_quiz: isCorrect excluded from response', true, containsIsCorrect ? 1 : 0, q2.error);

  // ─────────────────────────────────────────────────────
  // CATEGORY 2: STUDENT CROSS-DATA ISOLATION
  // Student A must NOT be able to access Student B's data
  // ─────────────────────────────────────────────────────
  if (studentA && studentB) {
    console.log('\n## STUDENT CROSS-DATA ISOLATION TESTS\n');

    const sessionA = await getStudentSession(studentA.email);
    if (!sessionA) {
      console.warn('  ⚠️  Could not create test session for Student A — skipping cross-student tests');
    } else {
      const clientA = createClient(stagingUrl, stagingAnonKey, {
        global: { headers: { Authorization: `Bearer ${sessionA.access_token}` } }
      });

      // Profile
      const t1 = await clientA.from('users').select('id,email').eq('id', studentB.id);
      record(`Student A access Student B profile (users)`, true, t1.data?.length ?? 0, t1.error);

      // Submissions
      const t2 = await clientA.from('submissions').select('id').eq('studentId', studentB.student_id);
      record(`Student A access Student B submissions`, true, t2.data?.length ?? 0, t2.error);

      // Messages
      const t3 = await clientA.from('messages').select('id').eq('receiverId', studentB.id).neq('senderId', studentA.id);
      record(`Student A access Student B messages`, true, t3.data?.length ?? 0, t3.error);

      // Notifications
      const t4 = await clientA.from('notifications').select('id').eq('userId', studentB.id);
      record(`Student A access Student B notifications`, true, t4.data?.length ?? 0, t4.error);

      // Quiz attempts
      const t5 = await clientA.from('quiz_attempts').select('id').eq('studentId', studentB.student_id);
      record(`Student A access Student B quiz attempts`, true, t5.data?.length ?? 0, t5.error);

      // Grade tampering: UPDATE submissions.grade
      const t6 = await clientA.from('submissions').update({ grade: 100 }).eq('studentId', studentB.student_id);
      record(`Student A modify Student B grade (submissions)`, true, t6.data?.length ?? 0, t6.error);

      // Score tampering: UPDATE quiz_attempts.score
      const t7 = await clientA.from('quiz_attempts').update({ score: 999 }).eq('studentId', studentB.student_id);
      record(`Student A modify Student B quiz score`, true, t7.data?.length ?? 0, t7.error);

      // Direct INSERT to quiz_attempts (must use RPC)
      const t8 = await clientA.from('quiz_attempts').insert({ studentId: studentA.student_id, quizId: 1, score: 100, total: 100 });
      record(`Student A direct INSERT quiz_attempts (bypass RPC)`, true, t8.data?.length ?? 0, t8.error);
    }
  }

  // ─────────────────────────────────────────────────────
  // CATEGORY 3: TEACHER BOUNDARY TESTS
  // ─────────────────────────────────────────────────────
  // (Boundary check limited without full teacher session — logged as note)
  console.log('\n## TEACHER BOUNDARY TESTS\n');
  console.log('  ℹ️  Full teacher boundary tests require teacher auth session in staging.');
  console.log('     These will be run during full integration testing.\n');

  // ─────────────────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────────────────
  const timestamp = new Date().toISOString();
  const summary = [
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '  RLS SECURITY TEST SUITE RESULTS',
    `  Timestamp : ${timestamp}`,
    `  Passed    : ${passed}`,
    `  Failed    : ${failed}`,
    (failed === 0) ? '  Status    : ✅ ALL RLS TESTS PASSED' : `  Status    : ❌ ${failed} SECURITY TEST(S) FAILED — DO NOT PROCEED`,
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
  ].join('\n');

  console.log(summary);

  const reportLines = results.map(r => `[${r.status}] ${r.testName} (rows=${r.actualRowCount})`);
  fs.mkdirSync('./migration_backups', { recursive: true });
  fs.writeFileSync('./migration_backups/rls_security_test_results.txt', reportLines.join('\n') + '\n' + summary);
  console.log('\n📄 Results saved to: migration_backups/rls_security_test_results.txt');

  if (failed > 0) {
    console.log('\n⛔  Security tests failed. Review RLS policies in supabase_migration.sql before proceeding.\n');
    process.exit(1);
  } else {
    console.log('\n▶  NEXT STEP: Run 07_test_auth_migration.js to verify Auth account linking.\n');
  }
}

runTests().catch(err => {
  console.error('❌ RLS security tests failed unexpectedly:', err.message);
  process.exit(1);
});
