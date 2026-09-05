/**
 * dashboardService.ts
 * Aggregated stats for Admin, Teacher, and Student dashboards.
 */
import { collection, getDocs, query, where, orderBy, limit, getDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/* ─── ADMIN DASHBOARD ─────────────────────────────────────── */
export async function getAdminDashboardStats() {
  const [usersSnap, classesSnap, quizzesSnap, assignmentsSnap, attemptsSnap, notifSnap] = await Promise.all([
    getDocs(collection(db, 'users')),
    getDocs(collection(db, 'classes')),
    getDocs(collection(db, 'quizzes')),
    getDocs(collection(db, 'assignments')),
    getDocs(collection(db, 'quiz_attempts')),
    getDocs(query(collection(db, 'notifications'), where('isGlobal', '==', false))),
  ]);

  const users = usersSnap.docs.map(d => d.data());
  const students = users.filter(u => u.role === 'STUDENT');
  const teachers = users.filter(u => u.role === 'TEACHER');

  // Top students by points
  const topStudents = users
    .filter(u => u.role === 'STUDENT')
    .sort((a, b) => (b.points || 0) - (a.points || 0))
    .slice(0, 10)
    .map((u, i) => ({ rank: i + 1, name: u.name || u.fullName, points: u.points || 0, className: u.className }));

  // Average quiz score
  const attempts = attemptsSnap.docs.map(d => d.data());
  const avgScore = attempts.length
    ? Math.round(attempts.reduce((sum, a) => sum + ((a.score / Math.max(a.total, 1)) * 100), 0) / attempts.length)
    : 0;

  // Gender distribution
  const male = users.filter(u => u.gender?.toUpperCase() === 'MALE').length;
  const female = users.filter(u => u.gender?.toUpperCase() === 'FEMALE').length;

  return {
    totalStudents: students.length,
    totalTeachers: teachers.length,
    totalClasses: classesSnap.size,
    totalQuizzes: quizzesSnap.size,
    totalAssignments: assignmentsSnap.size,
    avgQuizScore: avgScore,
    topStudents,
    genderStats: { male, female, other: users.length - male - female },
  };
}

/* ─── TEACHER DASHBOARD ───────────────────────────────────── */
export async function getTeacherDashboardStats(teacherId: string) {
  const coursesSnap = await getDocs(
    query(collection(db, 'courses'), where('teacherIds', 'array-contains', teacherId))
  );
  const courses = coursesSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

  const courseIds = courses.map(c => c.id);
  let totalQuizzes = 0;
  let totalAssignments = 0;
  let totalAttempts = 0;
  let totalSubmissions = 0;

  if (courseIds.length > 0) {
    const [qSnap, aSnap] = await Promise.all([
      getDocs(query(collection(db, 'quizzes'), where('createdBy', '==', teacherId))),
      getDocs(query(collection(db, 'assignments'), where('createdBy', '==', teacherId))),
    ]);
    totalQuizzes = qSnap.size;
    totalAssignments = aSnap.size;

    const quizIds = qSnap.docs.map(d => d.id);
    const [attSnap, subSnap] = await Promise.all([
      getDocs(query(collection(db, 'quiz_attempts'), where('quizId', 'in', quizIds.slice(0, 10)))),
      getDocs(query(collection(db, 'submissions'), where('assignmentId', 'in', aSnap.docs.slice(0, 10).map(d => d.id)))),
    ]);
    totalAttempts = attSnap.size;
    totalSubmissions = subSnap.size;
  }

  return {
    totalCourses: courses.length,
    totalQuizzes,
    totalAssignments,
    totalAttempts,
    totalSubmissions,
    courses,
  };
}

/* ─── STUDENT DASHBOARD ───────────────────────────────────── */
export async function getStudentDashboardStats(studentId: string, classId?: string) {
  const [attemptsSnap, submissionsSnap, notifSnap] = await Promise.all([
    getDocs(query(collection(db, 'quiz_attempts'), where('studentId', '==', studentId))),
    getDocs(query(collection(db, 'submissions'), where('studentId', '==', studentId))),
    getDocs(query(collection(db, 'notifications'), where('isGlobal', '==', true), orderBy('createdAt', 'desc'), limit(10))),
  ]);

  const attempts = attemptsSnap.docs.map(d => d.data());
  const submissions = submissionsSnap.docs.map(d => d.data());

  const avgQuizScore = attempts.length
    ? Math.round(attempts.reduce((sum, a) => sum + ((a.score / Math.max(a.total, 1)) * 100), 0) / attempts.length)
    : 0;

  const gradedSubmissions = submissions.filter(s => s.grade != null);
  const avgAssignmentScore = gradedSubmissions.length
    ? Math.round(gradedSubmissions.reduce((sum, s) => sum + s.grade, 0) / gradedSubmissions.length)
    : 0;

  // Upcoming assignments for the class
  let upcomingAssignments: any[] = [];
  if (classId) {
    const now = new Date().toISOString();
    const aSnap = await getDocs(
      query(collection(db, 'assignments'), where('classIds', 'array-contains', classId), where('isPublished', '==', true))
    );
    upcomingAssignments = aSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter((a: any) => a.deadline > now)
      .sort((a: any, b: any) => a.deadline.localeCompare(b.deadline))
      .slice(0, 5);
  }

  const announcements = notifSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  return {
    totalQuizAttempts: attempts.length,
    avgQuizScore,
    totalSubmissions: submissions.length,
    avgAssignmentScore,
    upcomingAssignments,
    recentAnnouncements: announcements,
  };
}

/* ─── ANALYTICS ───────────────────────────────────────────── */
export async function getAnalyticsStats() {
  const [
    usersSnap,
    coursesSnap,
    quizzesSnap,
    attemptsSnap,
    classesSnap,
    assignmentsSnap,
    submissionsSnap,
    materialsSnap
  ] = await Promise.all([
    getDocs(collection(db, 'users')),
    getDocs(collection(db, 'courses')),
    getDocs(collection(db, 'quizzes')),
    getDocs(collection(db, 'quiz_attempts')),
    getDocs(collection(db, 'classes')),
    getDocs(collection(db, 'assignments')),
    getDocs(collection(db, 'submissions')),
    getDocs(collection(db, 'materials')),
  ]);

  const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
  const students = users.filter(u => (u.role || '').toUpperCase().includes('STUDENT'));
  const teachers = users.filter(u => (u.role || '').toUpperCase().includes('TEACHER'));
  const courses = coursesSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
  const quizzes = quizzesSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
  const attempts = attemptsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
  const assignments = assignmentsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
  const submissions = submissionsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
  const materials = materialsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
  const classes = classesSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

  // Collect all percentage scores across quizzes and assignments
  const quizScores: number[] = attempts
    .filter(a => a.total > 0 && a.score != null)
    .map(a => Math.round(((a.score || 0) / Math.max(a.total, 1)) * 100));

  const gradedSubmissions = submissions.filter(s => s.grade != null && s.grade !== undefined);
  const assignmentScores: number[] = gradedSubmissions.map(s => {
    const asgn = assignments.find(a => a.id === s.assignmentId);
    const maxScore = asgn?.maxScore || 100;
    return Math.round(((s.grade || 0) / Math.max(maxScore, 1)) * 100);
  });

  const allScores = [...quizScores, ...assignmentScores];
  const avgScore = allScores.length
    ? Math.round(allScores.reduce((sum, s) => sum + s, 0) / allScores.length)
    : 0;

  // Real Grade distribution
  const grades = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  allScores.forEach(score => {
    if (score >= 90) grades.A++;
    else if (score >= 80) grades.B++;
    else if (score >= 70) grades.C++;
    else if (score >= 60) grades.D++;
    else grades.F++;
  });

  const gradeDistribution = [
    { name: 'Grade A (90-100%)', value: grades.A, color: '#10b981' },
    { name: 'Grade B (80-89%)', value: grades.B, color: '#3b82f6' },
    { name: 'Grade C (70-79%)', value: grades.C, color: '#f59e0b' },
    { name: 'Grade D (60-69%)', value: grades.D, color: '#f97316' },
    { name: 'Grade F (<60%)', value: grades.F, color: '#ef4444' },
  ];

  // Real Subject performance (real scores aggregated per course/subject)
  const studentPerformance = courses.slice(0, 8).map(c => {
    const courseQuizzes = quizzes.filter(q => q.courseId === c.id);
    const quizIds = new Set(courseQuizzes.map(q => q.id));
    const courseAttempts = attempts.filter(a => quizIds.has(a.quizId));

    const courseAssignments = assignments.filter(a => a.courseId === c.id);
    const asgnIds = new Set(courseAssignments.map(a => a.id));
    const courseSubmissions = submissions.filter(s => asgnIds.has(s.assignmentId) && s.grade != null);

    const scores: number[] = [
      ...courseAttempts.map(a => ((a.score || 0) / Math.max(a.total || 1, 1)) * 100),
      ...courseSubmissions.map(s => {
        const asgn = courseAssignments.find(a => a.id === s.assignmentId);
        return ((s.grade || 0) / Math.max(asgn?.maxScore || 100, 1)) * 100;
      })
    ];

    const courseAvg = scores.length
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0;

    return {
      subject: c.title || 'Subject',
      score: courseAvg,
      assessments: scores.length
    };
  });

  // Real Enrollment Trend based on student creation dates
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const now = new Date();
  const enrollmentTrend = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mName = months[d.getMonth()];
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59).toISOString();
    const count = students.filter(s => !s.createdAt || s.createdAt <= endOfMonth).length;
    enrollmentTrend.push({
      month: mName,
      students: count
    });
  }

  // Real Completion Rate (completed vs total student assessments)
  const totalTasks = assignments.length + quizzes.length;
  const activeStudentsCount = Math.max(students.length, 1);
  const totalExpected = totalTasks * activeStudentsCount;
  const totalCompleted = submissions.length + attempts.length;
  const completionRatePct = totalExpected > 0 
    ? Math.min(100, Math.round((totalCompleted / totalExpected) * 100))
    : 0;

  // Real Teacher activity
  const teacherActivity = teachers.map(t => {
    const tId = String(t.id);
    const teacherClasses = classes.filter(c => String(c.teacherId || '') === tId);
    const teacherQuizzes = quizzes.filter(q => String(q.createdBy || '') === tId);
    const teacherMaterials = materials.filter(m => String(m.uploadedBy || '') === tId);
    const teacherAssignments = assignments.filter(a => String(a.createdBy || '') === tId);

    return {
      name: t.name || t.fullName || 'Teacher',
      classes: teacherClasses.length || (classes.length > 0 ? 1 : 0),
      quizzes: teacherQuizzes.length,
      lessons: teacherMaterials.length + teacherAssignments.length,
    };
  });

  return {
    statCards: {
      totalEnrollments: students.length,
      coursesActive: courses.length,
      avgGrade: `${avgScore}%`,
      completionRate: `${completionRatePct}%`,
    },
    studentPerformance,
    enrollmentTrend,
    gradeDistribution,
    teacherActivity,
  };
}

