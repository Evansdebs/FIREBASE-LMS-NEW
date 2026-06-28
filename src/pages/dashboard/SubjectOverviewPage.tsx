// src/pages/dashboard/SubjectOverviewPage.tsx
import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "@/lib/api"; // helper to call API with auth token

/**
 * SubjectOverviewPage – a premium hub that lets a teacher see **everything** related to a
 * selected subject (course) in a single view. It pulls:
 *   • Course metadata (subject, description)
 *   • Modules & materials
 *   • Assignments, quizzes, live‑classes
 *   • Attendance records
 *   • Gradebook summary per‑student
 *   • Analytics snapshot
 * All data is fetched via the new backend endpoint
 *   GET /api/teacher/courses/:id/overview
 * which returns a single JSON payload covering all the tabs described in the feature spec.
 *
 * The UI displays a list of the teacher's courses. Clicking a course expands an accordion
 * showing each tab's content. The design follows the app's premium visual language –
 * glass‑morphism cards, subtle hover lifts, and smooth transitions – using only vanilla CSS.
 */
const SubjectOverviewPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);

  // Fetch the teacher's courses – this endpoint already exists as getMyCourses.
  const { data: courses, isLoading: coursesLoading, error: coursesError } = useQuery({
    queryKey: ["teacherCourses"],
    queryFn: () => api.get("/api/teacher/my-courses")
  });

  // When a course is selected, fetch its full overview.
  const {
    data: overview,
    isLoading: overviewLoading,
    error: overviewError,
    refetch: refetchOverview,
  } = useQuery({
    queryKey: ["courseOverview", selectedCourseId],
    queryFn: () => api.get(`/api/teacher/courses/${selectedCourseId}/overview`),
    enabled: !!selectedCourseId,
    staleTime: 5 * 60 * 1000, // keep fresh for 5 minutes
  });

  const handleSelect = (id: number) => {
    setSelectedCourseId(id);
    // Invalidate any stale overview data to guarantee ACID‑consistent view.
    queryClient.invalidateQueries(["courseOverview", id]);
  };

  if (coursesLoading) return <div className="loader">Loading courses…</div>;
  if (coursesError) return <div className="error">Failed to load courses.</div>;

  return (
    <div className="subject-overview-page">
      <h1 className="page-title">Subject Hub – All‑In‑One Teacher Dashboard</h1>

      {/* ---------- Course selector ---------- */}
      <section className="course-list">
        <h2>Your Courses</h2>
        <ul className="course-cards">
          {courses?.map((c: any) => (
            <li key={c.id} className={`course-card ${selectedCourseId === c.id ? "selected" : ""}`} onClick={() => handleSelect(c.id)}>
              <span className="course-name">{c.title}</span>
              <span className="subject-name">{c.subject?.name || "—"}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* ---------- Overview content (shown after a course is selected) ---------- */}
      {selectedCourseId && (
        <section className="course-overview">
          <h2>Course Overview</h2>
          {overviewLoading && <div className="loader">Loading overview…</div>}
          {overviewError && <div className="error">Failed to load overview.</div>}
          {overview && (
            <div className="tabs-container">
              {/* ---- Overview tab – basic stats ---- */}
              <details open className="tab">
                <summary>📊 Overview &amp; Stats</summary>
                <div className="tab-content">
                  <p><strong>Subject:</strong> {overview.course?.subject?.name}</p>
                  <p><strong>Description:</strong> {overview.course?.description || "—"}</p>
                  <p><strong>Total Students:</strong> {overview.meta?.totalStudents}</p>
                  <p><strong>Total Materials:</strong> {overview.meta?.totalMaterials}</p>
                  <p><strong>Pending Grading:</strong> {overview.meta?.pendingGrading}</p>
                </div>
              </details>

              {/* ---- Modules & Materials ---- */}
              <details className="tab">
                <summary>📁 Modules &amp; Materials</summary>
                <div className="tab-content">
                  {overview.course?.topics?.map((t: any) => (
                    <section key={t.id} className="module">
                      <h4>{t.title}</h4>
                      <p>{t.description}</p>
                      <ul className="materials">
                        {t.materials?.map((m: any) => (
                          <li key={m.id}>
                            <a href={m.filePath} target="_blank" rel="noopener noreferrer">{m.fileName}</a>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              </details>

              {/* ---- Assignments ---- */}
              <details className="tab">
                <summary>📝 Assignments</summary>
                <div className="tab-content">
                  {overview.assignments?.map((a: any) => (
                    <article key={a.id} className="assignment-card">
                      <h4>{a.title}</h4>
                      <p>{a.description}</p>
                      <p>Deadline: {new Date(a.deadline).toLocaleString()}</p>
                      <p>Submissions: {a._count?.submissions || 0}</p>
                    </article>
                  ))}
                </div>
              </details>

              {/* ---- Quizzes ---- */}
              <details className="tab">
                <summary>❓ Quizzes</summary>
                <div className="tab-content">
                  {overview.quizzes?.map((q: any) => (
                    <article key={q.id} className="quiz-card">
                      <h4>{q.title}</h4>
                      <p>Attempts: {q._count?.quizAttempts || 0}</p>
                      <p>Questions: {q._count?.quizQuestions || 0}</p>
                    </article>
                  ))}
                </div>
              </details>

              {/* ---- Live Classes ---- */}
              <details className="tab">
                <summary>📺 Live Classes</summary>
                <div className="tab-content">
                  {overview.liveClasses?.map((lc: any) => (
                    <article key={lc.id} className="liveclass-card">
                      <h4>{lc.title}</h4>
                      <p>Date: {new Date(lc.scheduleDate).toLocaleDateString()}</p>
                      <p>Link: <a href={lc.googleMeetLink} target="_blank" rel="noopener noreferrer">Join</a></p>
                    </article>
                  ))}
                </div>
              </details>

              {/* ---- Attendance ---- */}
              <details className="tab">
                <summary>📅 Attendance</summary>
                <div className="tab-content">
                  <table className="attendance-table">
                    <thead>
                      <tr><th>Student</th><th>Date</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      {overview.attendanceRecords?.slice(0, 20).map((r: any) => (
                        <tr key={`${r.studentId}-${r.date}`}> 
                          <td>{r.student?.user?.name}</td>
                          <td>{new Date(r.date).toLocaleDateString()}</td>
                          <td>{r.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>

              {/* ---- Gradebook ---- */}
              <details className="tab">
                <summary>📈 Gradebook</summary>
                <div className="tab-content">
                  <table className="gradebook-table">
                    <thead>
                      <tr><th>Student</th><th>Avg %</th><th>Letter</th></tr>
                    </thead>
                    <tbody>
                      {overview.gradebookRows?.map((s: any) => (
                        <tr key={s.id}>
                          <td>{s.name}</td>
                          <td>{s.quizAvg !== null ? `${s.quizAvg}%` : "N/A"}</td>
                          <td>{s.letterGrade}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>

              {/* ---- Analytics ---- */}
              <details className="tab">
                <summary>📊 Analytics</summary>
                <div className="tab-content">
                  {/* Placeholder – the actual chart components can be added later. */}
                  <pre>{JSON.stringify(overview.analytics || {}, null, 2)}</pre>
                </div>
              </details>
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default SubjectOverviewPage;

/*
  CSS (vanilla) – placed in src/pages/dashboard/SubjectOverviewPage.css (imported implicitly via
  a global stylesheet). The design follows the premium aesthetic guidelines: glass‑morphism cards,
  subtle shadows, smooth transitions, and accent colours drawn from the theme.
*/
