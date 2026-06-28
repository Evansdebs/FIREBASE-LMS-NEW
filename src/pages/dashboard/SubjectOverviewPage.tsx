// src/pages/dashboard/SubjectOverviewPage.tsx
import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  BookOpen, ClipboardList, HelpCircle, Video,
  CalendarDays, BarChart3, FolderOpen, Users,
  ChevronRight, ExternalLink, Loader2, AlertCircle,
  TrendingUp, Award, Clock
} from "lucide-react";
import { cn } from "@/lib/utils";

/** ─── Tab definitions ─────────────────────────────────────────────────── */
const TABS = [
  { id: "overview",    label: "Overview",   icon: BarChart3      },
  { id: "modules",     label: "Modules",    icon: FolderOpen     },
  { id: "assignments", label: "Assignments",icon: ClipboardList  },
  { id: "quizzes",     label: "Quizzes",    icon: HelpCircle     },
  { id: "live",        label: "Live Classes",icon: Video         },
  { id: "attendance",  label: "Attendance", icon: CalendarDays   },
  { id: "gradebook",   label: "Gradebook",  icon: Award          },
  { id: "analytics",   label: "Analytics",  icon: TrendingUp     },
] as const;

type TabId = typeof TABS[number]["id"];

/** ─── Small reusable card ─────────────────────────────────────────────── */
const InfoCard = ({ label, value, accent = false }: { label: string; value: React.ReactNode; accent?: boolean }) => (
  <div className={cn(
    "flex flex-col gap-1 p-4 rounded-xl border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
    accent
      ? "bg-primary/10 border-primary/20 text-primary"
      : "bg-card border-border"
  )}>
    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
    <span className={cn("text-2xl font-bold", accent && "text-primary")}>{value}</span>
  </div>
);

/** ─── Status badge ────────────────────────────────────────────────────── */
const Badge = ({ status }: { status: string }) => {
  const map: Record<string, string> = {
    PRESENT: "bg-emerald-100 text-emerald-700 border-emerald-200",
    ABSENT:  "bg-red-100 text-red-700 border-red-200",
    LATE:    "bg-amber-100 text-amber-700 border-amber-200",
  };
  return (
    <span className={cn("px-2.5 py-0.5 rounded-full text-[11px] font-semibold border", map[status] ?? "bg-muted text-muted-foreground border-border")}>
      {status}
    </span>
  );
};

/** ─── Main component ──────────────────────────────────────────────────── */
const SubjectOverviewPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  /* ---- Courses ---- */
  const { data: courses, isLoading: coursesLoading, error: coursesError } = useQuery({
    queryKey: ["teacherCourses"],
    queryFn: () => api.get("/api/teacher/my-courses"),
  });

  /* ---- Course overview ---- */
  const { data: overview, isLoading: overviewLoading, error: overviewError } = useQuery({
    queryKey: ["courseOverview", selectedCourseId],
    queryFn: () => api.get(`/api/teacher/courses/${selectedCourseId}/overview`),
    enabled: !!selectedCourseId,
    staleTime: 5 * 60 * 1000,
  });

  const handleSelect = (id: number) => {
    setSelectedCourseId(id);
    setActiveTab("overview");
    queryClient.invalidateQueries({ queryKey: ["courseOverview", id] });
  };

  /* ── Loading / error states ── */
  if (coursesLoading) return (
    <div className="flex items-center justify-center h-64 gap-3 text-muted-foreground">
      <Loader2 className="w-5 h-5 animate-spin" /> Loading courses…
    </div>
  );
  if (coursesError) return (
    <div className="flex items-center justify-center h-64 gap-3 text-destructive">
      <AlertCircle className="w-5 h-5" /> Failed to load courses.
    </div>
  );

  const selectedCourse = (courses as any[])?.find((c: any) => c.id === selectedCourseId);

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 space-y-6">

      {/* ── Page Header ─────────────────────────────────────── */}
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
          <BookOpen className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-heading text-foreground">Subject Hub</h1>
          <p className="text-sm text-muted-foreground mt-0.5">All-in-one teacher dashboard — select a course to begin</p>
        </div>
      </div>

      {/* ── Course Selector Grid ─────────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
          <Users className="w-3.5 h-3.5" /> Your Courses
        </h2>
        {!courses?.length ? (
          <p className="text-sm text-muted-foreground py-8 text-center border border-dashed border-border rounded-xl">
            No courses assigned yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {(courses as any[]).map((c: any) => {
              const isSelected = selectedCourseId === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => handleSelect(c.id)}
                  className={cn(
                    "group relative text-left p-4 rounded-xl border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg",
                    isSelected
                      ? "bg-primary/10 border-primary/40 shadow-md shadow-primary/10"
                      : "bg-card border-border hover:border-primary/30"
                  )}
                >
                  {isSelected && (
                    <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-primary animate-pulse" />
                  )}
                  <p className={cn("font-semibold text-sm leading-snug", isSelected ? "text-primary" : "text-foreground")}>
                    {c.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 truncate">{c.subject?.name || "—"}</p>
                  <ChevronRight className={cn(
                    "w-3.5 h-3.5 mt-2 transition-all duration-200",
                    isSelected ? "text-primary translate-x-0.5" : "text-muted-foreground/50"
                  )} />
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Overview Panel ──────────────────────────────────── */}
      {selectedCourseId && (
        <section className="space-y-4">

          {/* Course header banner */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/80 via-primary to-violet-600 p-5 text-white shadow-lg shadow-primary/20">
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 80% 50%, white 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
            <p className="text-xs font-semibold uppercase tracking-widest opacity-75 mb-1">Course Overview</p>
            <h2 className="text-xl font-bold font-heading">{selectedCourse?.title}</h2>
            <p className="text-sm opacity-80 mt-0.5">{selectedCourse?.subject?.name}</p>
          </div>

          {/* Loading / error for overview */}
          {overviewLoading && (
            <div className="flex items-center justify-center h-40 gap-3 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" /> Loading overview…
            </div>
          )}
          {overviewError && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              <AlertCircle className="w-5 h-5 shrink-0" /> Failed to load course overview.
            </div>
          )}

          {overview && (
            <>
              {/* ── Tab Bar ── */}
              <div className="flex overflow-x-auto gap-1 p-1 bg-muted/50 rounded-xl border border-border no-scrollbar">
                {TABS.map(tab => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-200 shrink-0",
                        isActive
                          ? "bg-background text-primary shadow-sm border border-border"
                          : "text-muted-foreground hover:text-foreground hover:bg-background/60"
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* ── Tab Panels ── */}
              <div className="min-h-[300px]">

                {/* OVERVIEW */}
                {activeTab === "overview" && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <InfoCard label="Total Students"  value={overview.meta?.totalStudents  ?? "—"} accent />
                      <InfoCard label="Total Materials" value={overview.meta?.totalMaterials ?? "—"} />
                      <InfoCard label="Pending Grading" value={overview.meta?.pendingGrading ?? "—"} />
                      <InfoCard label="Subject"         value={overview.course?.subject?.name ?? "—"} />
                    </div>
                    {overview.course?.description && (
                      <div className="p-4 rounded-xl bg-card border border-border text-sm text-muted-foreground leading-relaxed">
                        <span className="font-semibold text-foreground block mb-1">Description</span>
                        {overview.course.description}
                      </div>
                    )}
                  </div>
                )}

                {/* MODULES */}
                {activeTab === "modules" && (
                  <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {!overview.course?.topics?.length && (
                      <p className="text-sm text-muted-foreground py-10 text-center border border-dashed border-border rounded-xl">No modules yet.</p>
                    )}
                    {overview.course?.topics?.map((t: any) => (
                      <div key={t.id} className="p-4 rounded-xl bg-card border border-border space-y-3">
                        <div>
                          <h4 className="font-semibold text-foreground">{t.title}</h4>
                          {t.description && <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>}
                        </div>
                        {t.materials?.length > 0 && (
                          <ul className="space-y-1.5">
                            {t.materials.map((m: any) => (
                              <li key={m.id}>
                                <a
                                  href={m.filePath}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 text-xs text-primary hover:underline"
                                >
                                  <ExternalLink className="w-3 h-3 shrink-0" /> {m.fileName}
                                </a>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* ASSIGNMENTS */}
                {activeTab === "assignments" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {!overview.assignments?.length && (
                      <p className="col-span-2 text-sm text-muted-foreground py-10 text-center border border-dashed border-border rounded-xl">No assignments yet.</p>
                    )}
                    {overview.assignments?.map((a: any) => (
                      <div key={a.id} className="p-4 rounded-xl bg-card border border-border hover:border-primary/30 hover:shadow-md transition-all duration-200 space-y-2">
                        <h4 className="font-semibold text-foreground text-sm">{a.title}</h4>
                        {a.description && <p className="text-xs text-muted-foreground line-clamp-2">{a.description}</p>}
                        <div className="flex items-center gap-3 pt-1">
                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Clock className="w-3 h-3" /> {new Date(a.deadline).toLocaleDateString()}
                          </span>
                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Users className="w-3 h-3" /> {a._count?.submissions || 0} submissions
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* QUIZZES */}
                {activeTab === "quizzes" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {!overview.quizzes?.length && (
                      <p className="col-span-2 text-sm text-muted-foreground py-10 text-center border border-dashed border-border rounded-xl">No quizzes yet.</p>
                    )}
                    {overview.quizzes?.map((q: any) => (
                      <div key={q.id} className="p-4 rounded-xl bg-card border border-border hover:border-primary/30 hover:shadow-md transition-all duration-200 space-y-2">
                        <h4 className="font-semibold text-foreground text-sm">{q.title}</h4>
                        <div className="flex items-center gap-4 pt-1">
                          <span className="text-[11px] text-muted-foreground">{q._count?.quizQuestions || 0} questions</span>
                          <span className="text-[11px] text-muted-foreground">{q._count?.quizAttempts || 0} attempts</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* LIVE CLASSES */}
                {activeTab === "live" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {!overview.liveClasses?.length && (
                      <p className="col-span-2 text-sm text-muted-foreground py-10 text-center border border-dashed border-border rounded-xl">No live classes scheduled.</p>
                    )}
                    {overview.liveClasses?.map((lc: any) => (
                      <div key={lc.id} className="p-4 rounded-xl bg-card border border-border hover:border-primary/30 hover:shadow-md transition-all duration-200 space-y-2">
                        <h4 className="font-semibold text-foreground text-sm">{lc.title}</h4>
                        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <CalendarDays className="w-3.5 h-3.5" /> {new Date(lc.scheduleDate).toLocaleDateString()}
                        </p>
                        {lc.googleMeetLink && (
                          <a
                            href={lc.googleMeetLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                          >
                            <ExternalLink className="w-3 h-3" /> Join Meeting
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* ATTENDANCE */}
                {activeTab === "attendance" && (
                  <div className="rounded-xl border border-border overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/60 border-b border-border">
                          <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Student</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {!overview.attendanceRecords?.length && (
                          <tr><td colSpan={3} className="text-center py-10 text-muted-foreground text-xs">No attendance records.</td></tr>
                        )}
                        {overview.attendanceRecords?.slice(0, 20).map((r: any) => (
                          <tr key={`${r.studentId}-${r.date}`} className="bg-card hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3 font-medium text-foreground">{r.student?.user?.name || "—"}</td>
                            <td className="px-4 py-3 text-muted-foreground">{new Date(r.date).toLocaleDateString()}</td>
                            <td className="px-4 py-3"><Badge status={r.status} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* GRADEBOOK */}
                {activeTab === "gradebook" && (
                  <div className="rounded-xl border border-border overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/60 border-b border-border">
                          <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Student</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Avg %</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Grade</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {!overview.gradebookRows?.length && (
                          <tr><td colSpan={3} className="text-center py-10 text-muted-foreground text-xs">No gradebook data yet.</td></tr>
                        )}
                        {overview.gradebookRows?.map((s: any) => (
                          <tr key={s.id} className="bg-card hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3 font-medium text-foreground">{s.name}</td>
                            <td className="px-4 py-3 text-muted-foreground">{s.quizAvg !== null ? `${s.quizAvg}%` : "N/A"}</td>
                            <td className="px-4 py-3">
                              <span className={cn(
                                "px-2.5 py-0.5 rounded-full text-[11px] font-bold border",
                                s.letterGrade === "A" ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                                s.letterGrade === "B" ? "bg-blue-100 text-blue-700 border-blue-200" :
                                s.letterGrade === "C" ? "bg-amber-100 text-amber-700 border-amber-200" :
                                "bg-red-100 text-red-700 border-red-200"
                              )}>
                                {s.letterGrade || "—"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* ANALYTICS */}
                {activeTab === "analytics" && (
                  <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-3">
                    <p className="text-xs text-muted-foreground">Raw analytics snapshot — charts coming soon.</p>
                    <pre className="p-4 rounded-xl bg-muted/50 border border-border text-xs text-foreground overflow-x-auto leading-relaxed">
                      {JSON.stringify(overview.analytics || {}, null, 2)}
                    </pre>
                  </div>
                )}

              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
};

export default SubjectOverviewPage;
