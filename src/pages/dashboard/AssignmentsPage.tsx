import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import {
  getAssignments, getAssignmentById, createAssignment,
  updateAssignment, deleteAssignment, getSubmissions,
  createSubmission, gradeSubmission, AssignmentDoc, SubmissionDoc
} from '@/lib/services/assignmentService';
import { getCourses, getClasses, CourseDoc } from '@/lib/services/academicService';
import {
  Plus, Search, FileText, Upload, Download, Clock, CheckCircle, XCircle,
  MessageSquare, Loader2, Trash2, Edit, ListChecks, GripVertical, Globe, EyeOff
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface RubricCriterion {
  id?: number;
  name: string;
  maxPoints: number;
}

interface RubricScore {
  criterionId: number;
  points: number;
  criterion?: { name: string; maxPoints: number };
}

export default function AssignmentsPage() {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [showSubmit, setShowSubmit] = useState<any | null>(null);
  const [showSubmissionsFor, setShowSubmissionsFor] = useState<any | null>(null);
  const [submissionsData, setSubmissionsData] = useState<any[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [gradingSubmission, setGradingSubmission] = useState<any | null>(null);
  const [gradingPayload, setGradingPayload] = useState<{ grade: string; feedback: string; rubricScores: RubricScore[] }>({
    grade: '', feedback: '', rubricScores: []
  });
  const [submitting, setSubmitting] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  // Create / Edit State
  const [courses, setCourses] = useState<any[]>([]);
  const [availableClasses, setAvailableClasses] = useState<any[]>([]);
  const [createPayload, setCreatePayload] = useState<{
    courseId: string;
    title: string;
    description: string;
    deadline: string;
    maxScore: string;
    classIds: string[];
    rubric: RubricCriterion[];
  }>({
    courseId: '', title: '', description: '', deadline: '', maxScore: '100', classIds: [], rubric: []
  });
  const [editingAssignment, setEditingAssignment] = useState<any | null>(null);
  const [submitText, setSubmitText] = useState('');

  const isStudent = user?.role === 'student';
  const isAdmin = user?.role === 'super_admin';
  const isTeacher = user?.role === 'teacher';
  const canManage = isAdmin || isTeacher;

  // ─── Rubric helpers ───────────────────────────────────
  const rubricTotal = createPayload.rubric.reduce((s, c) => s + (parseInt(String(c.maxPoints)) || 0), 0);
  const hasRubric = createPayload.rubric.length > 0;

  const addCriterion = () => {
    setCreatePayload(prev => ({ ...prev, rubric: [...prev.rubric, { name: '', maxPoints: 10 }] }));
  };

  const removeCriterion = (idx: number) => {
    setCreatePayload(prev => ({ ...prev, rubric: prev.rubric.filter((_, i) => i !== idx) }));
  };

  const updateCriterion = (idx: number, field: keyof RubricCriterion, value: string | number) => {
    setCreatePayload(prev => {
      const rubric = [...prev.rubric];
      rubric[idx] = { ...rubric[idx], [field]: field === 'maxPoints' ? parseInt(String(value)) || 0 : value };
      return { ...prev, rubric };
    });
  };

  // ─── Data Fetching ───────────────────────────────────
  useEffect(() => {
    fetchAssignments();
    if (canManage) fetchCourses();
  }, [user]);

  const fetchCourses = async () => {
    try {
      const [courseList, classList] = await Promise.all([getCourses(), getClasses()]);
      setCourses(courseList);
      setAvailableClasses(classList);
    } catch (err: any) {
      console.error('Failed to load courses:', err);
    }
  };

  const handleCourseChange = (courseId: string) => {
    setCreatePayload(prev => ({ ...prev, courseId }));
  };

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const res = await getAssignments();
      setAssignments(res || []);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filtered = assignments.filter(a => {
    const matchSearch = a.title.toLowerCase().includes(search.toLowerCase());
    const status = a.submissions?.length > 0 ? (a.submissions[0].grade != null ? 'graded' : 'submitted') : (new Date(a.deadline) < new Date() ? 'overdue' : 'pending');
    if (statusFilter === 'draft') return matchSearch && !a.isPublished;
    if (statusFilter === 'published') return matchSearch && a.isPublished;
    const matchStatus = statusFilter === 'all' || status === statusFilter;
    return matchSearch && matchStatus;
  });

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-warning/10 text-warning border-warning/20',
      submitted: 'bg-info/10 text-info border-info/20',
      graded: 'bg-success/10 text-success border-success/20',
      overdue: 'bg-destructive/10 text-destructive border-destructive/20',
    };
    return <Badge variant="outline" className={cn('font-medium capitalize', styles[status])}>{status}</Badge>;
  };

  // ─── Create / Edit Assignment ─────────────────────────
  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createPayload.courseId) return toast.error('Please select a course.');
    if (!user) return;

    try {
      setSubmitting(true);
      const course = courses.find((c: any) => c.id === createPayload.courseId);
      const payload: any = {
        title: createPayload.title,
        description: createPayload.description,
        courseId: createPayload.courseId,
        courseTitle: course?.title || '',
        deadline: createPayload.deadline,
        maxScore: parseInt(createPayload.maxScore) || 100,
        classIds: createPayload.classIds,
        createdBy: user.id as string,
        createdByName: user.fullName || user.name || 'Teacher',
        isPublished: true,
      };

      if (editingAssignment) {
        await updateAssignment(editingAssignment.id, payload);
        toast.success('Assignment updated successfully!');
      } else {
        await createAssignment(payload);
        toast.success('Assignment created successfully!');
      }

      setShowCreate(false);
      setEditingAssignment(null);
      setFile(null);
      setCreatePayload({ courseId: '', title: '', description: '', deadline: '', maxScore: '100', classIds: [], rubric: [] });
      fetchAssignments();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Student Submission ───────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showSubmit || !user) return;
    if (!submitText.trim()) return toast.error('Please provide a text response or description.');
    try {
      setSubmitting(true);
      await createSubmission({
        assignmentId: showSubmit.id,
        assignmentTitle: showSubmit.title,
        studentId: user.id as string,
        studentName: user.fullName || user.name || 'Student',
        content: submitText,
      });
      toast.success('Assignment submitted successfully!');
      setShowSubmit(null);
      setSubmitText('');
      fetchAssignments();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Teacher Submissions View ─────────────────────────
  const handleViewSubmissions = async (assignment: any) => {
    setShowSubmissionsFor(assignment);
    setLoadingSubmissions(true);
    try {
      const data = await getSubmissions(assignment.id);
      setSubmissionsData(data);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoadingSubmissions(false);
    }
  };

  const openGradeDialog = (sub: any) => {
    setGradingSubmission(sub);
    setGradingPayload({ grade: sub.grade?.toString() || '', feedback: sub.feedback || '', rubricScores: [] });
  };

  const handleSubmitGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gradingSubmission) return;

    try {
      setSubmitting(true);
      await gradeSubmission(
        gradingSubmission.id,
        parseInt(gradingPayload.grade) || 0,
        gradingPayload.feedback
      );
      toast.success('Grade submitted successfully');
      setGradingSubmission(null);
      handleViewSubmissions(showSubmissionsFor);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAssignment = async (id: string) => {
    if (!confirm('Are you sure you want to delete this assignment? All submissions and grades will be lost.')) return;
    try {
      await deleteAssignment(id);
      toast.success('Assignment deleted');
      fetchAssignments();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleTogglePublish = async (assignment: any) => {
    try {
      const prefix = isAdmin ? '/api/admin' : '/api/teacher';
      const res = await api.patch(`${prefix}/assignments/${assignment.id}/publish`, {});
      const action = res.isPublished ? 'Published' : 'Unpublished';
      toast.success(`${action} "${assignment.title}" successfully`);
      fetchAssignments();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update publish status.');
    }
  };

  const handleDownloadGrades = async (assignmentId: number) => {
    try {
      const token = localStorage.getItem('onereal_token');
      const API_URL = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${API_URL}/api/teacher/assignments/${assignmentId}/export-grades`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to download grades');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `assignment_${assignmentId}_grades.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err: any) {
      toast.error('Failed to download grades. Please try again.');
    }
  };

  const handleEditAssignment = (assignment: any) => {
    setEditingAssignment(assignment);
    const selectedCourse = courses.find(c => c.id === assignment.courseId);
    if (selectedCourse) {
      setAvailableClasses(selectedCourse.courseClasses?.map((cc: any) => cc.class) || []);
    }
    setCreatePayload({
      courseId: assignment.courseId.toString(),
      title: assignment.title,
      description: assignment.description || '',
      deadline: assignment.deadline ? new Date(assignment.deadline).toISOString().split('T')[0] : '',
      maxScore: assignment.maxScore.toString(),
      classIds: assignment.assignmentClasses?.map((ac: any) => ac.classId.toString()) || [],
      rubric: assignment.rubricCriteria?.map((c: any) => ({ id: c.id, name: c.name, maxPoints: c.maxPoints })) || [],
    });
    setShowCreate(true);
  };

  const handleOpenSubmit = (assignment: any) => {
    setShowSubmit(assignment);
    const existingSubmission = assignment.submissions?.[0];
    setSubmitText(existingSubmission?.textContent || '');
    setFile(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Assignments</h1>
          <p className="text-muted-foreground mt-1">
            {isStudent ? 'View and submit your assignments' : `${assignments.length} assignments created`}
          </p>
        </div>
        {!isStudent && (
          <Dialog open={showCreate} onOpenChange={(open) => {
            setShowCreate(open);
            if (!open) {
              setEditingAssignment(null);
              setCreatePayload({ courseId: '', title: '', description: '', deadline: '', maxScore: '100', classIds: [], rubric: [] });
              setAvailableClasses([]);
              setFile(null);
            }
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="w-4 h-4" /> Create Assignment</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-heading">{editingAssignment ? 'Edit Assignment' : 'Create Assignment'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateAssignment} className="space-y-4 py-2">
                {/* Title */}
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input required value={createPayload.title} onChange={e => setCreatePayload(prev => ({ ...prev, title: e.target.value }))} />
                </div>

                {/* Course */}
                <div className="space-y-2">
                  <Label>Course / Subject</Label>
                  <Select value={createPayload.courseId} onValueChange={handleCourseChange}>
                    <SelectTrigger><SelectValue placeholder="Select a course"/></SelectTrigger>
                    <SelectContent>
                      {courses.map(course => (
                        <SelectItem key={course.id} value={course.id.toString()}>{course.title} ({course.subject?.name})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Classes */}
                {availableClasses.length > 0 && (
                  <div className="space-y-2">
                    <Label>Assign to Classes</Label>
                    <div className="grid grid-cols-2 gap-2 p-3 border rounded-xl bg-muted/30">
                      {availableClasses.map(cls => (
                        <div key={cls.id} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`cls-${cls.id}`}
                            checked={createPayload.classIds.includes(cls.id.toString())}
                            onChange={(e) => {
                              const ids = e.target.checked
                                ? [...createPayload.classIds, cls.id.toString()]
                                : createPayload.classIds.filter(id => id !== cls.id.toString());
                              setCreatePayload(prev => ({ ...prev, classIds: ids }));
                            }}
                            className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                          />
                          <Label htmlFor={`cls-${cls.id}`} className="text-sm font-normal cursor-pointer">{cls.name}</Label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Description */}
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea required value={createPayload.description} onChange={e => setCreatePayload(prev => ({ ...prev, description: e.target.value }))} />
                </div>

                {/* Due Date & Max Grade row */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Due Date</Label>
                    <Input type="date" required value={createPayload.deadline} onChange={e => setCreatePayload(prev => ({ ...prev, deadline: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Grade {hasRubric && <span className="text-muted-foreground text-xs">(auto from rubric)</span>}</Label>
                    <Input
                      type="number"
                      required={!hasRubric}
                      value={hasRubric ? rubricTotal.toString() : createPayload.maxScore}
                      readOnly={hasRubric}
                      className={cn(hasRubric && 'bg-muted text-muted-foreground cursor-not-allowed')}
                      onChange={e => !hasRubric && setCreatePayload(prev => ({ ...prev, maxScore: e.target.value }))}
                    />
                  </div>
                </div>

                {/* ── Rubric Criteria Section ── */}
                <div className="space-y-3 border border-border rounded-xl p-4 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ListChecks className="w-4 h-4 text-primary" />
                      <Label className="text-sm font-semibold">Rubric Criteria</Label>
                      <Badge variant="outline" className="text-xs">Optional</Badge>
                    </div>
                    <Button type="button" size="sm" variant="outline" onClick={addCriterion} className="gap-1.5 h-7 text-xs">
                      <Plus className="w-3 h-3" /> Add Criterion
                    </Button>
                  </div>

                  {createPayload.rubric.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      No rubric defined — assignment will use a single flat grade.
                      <br />Click "Add Criterion" to define rubric-based grading.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {createPayload.rubric.map((criterion, idx) => (
                        <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-background border border-border">
                          <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
                          <Input
                            placeholder="Criterion name (e.g. Content)"
                            value={criterion.name}
                            onChange={e => updateCriterion(idx, 'name', e.target.value)}
                            className="flex-1 h-8 text-sm"
                          />
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Input
                              type="number"
                              min={1}
                              max={500}
                              value={criterion.maxPoints}
                              onChange={e => updateCriterion(idx, 'maxPoints', e.target.value)}
                              className="w-20 h-8 text-sm text-center"
                            />
                            <span className="text-xs text-muted-foreground">pts</span>
                          </div>
                          <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10" onClick={() => removeCriterion(idx)}>
                            <XCircle className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                      <div className="flex justify-between items-center text-xs text-muted-foreground pt-1 px-1">
                        <span>{createPayload.rubric.length} criteria</span>
                        <span className="font-semibold text-primary">Total: {rubricTotal} pts</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* File Upload */}
                <div className="space-y-2">
                  <Label>Attachments</Label>
                  <div className={cn("border-2 border-dashed border-border rounded-xl p-4 text-center cursor-pointer hover:border-primary/50 transition-colors", file && "border-primary bg-primary/5")} onClick={() => document.getElementById('assignment-file-upload')?.click()}>
                    <Upload className={cn("w-6 h-6 mx-auto mb-1", file ? "text-primary" : "text-muted-foreground")} />
                    <p className="text-xs text-muted-foreground">{file ? file.name : 'Drop files here or click to browse'}</p>
                    <input type="file" id="assignment-file-upload" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {editingAssignment ? 'Update' : 'Create'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Filters */}
      <Card className="border-border">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search assignments..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {canManage && <SelectItem value="draft">Draft</SelectItem>}
                {canManage && <SelectItem value="published">Published</SelectItem>}
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="graded">Graded</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Assignment List */}
      <div className="space-y-3">
        {loading ? (
          <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : filtered.map((a: any) => {
          const status = a.submissions?.length > 0 ? (a.submissions[0].grade != null ? 'graded' : 'submitted') : (new Date(a.dueDate) < new Date() ? 'overdue' : 'pending');
          const sub = a.submissions?.[0];
          const hasRubricCriteria = (a.rubricCriteria?.length ?? 0) > 0;
          return (
            <Card key={a.id} className="border-border hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    {/* Title + badges row */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-heading font-semibold text-card-foreground">{a.title}</h3>
                      {statusBadge(status)}
                      {canManage && (
                        a.isPublished ? (
                          <Badge variant="outline" className="border-emerald-500/30 text-emerald-500 bg-emerald-500/5 text-xs gap-1">
                            <Globe className="w-3 h-3" /> Published
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-amber-500/30 text-amber-500 bg-amber-500/5 text-xs gap-1">
                            <EyeOff className="w-3 h-3" /> Draft
                          </Badge>
                        )
                      )}
                      {hasRubricCriteria && (
                        <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 text-xs gap-1">
                          <ListChecks className="w-3 h-3" /> Rubric
                        </Badge>
                      )}
                    </div>

                    {/* Course & description */}
                    <p className="text-xs text-muted-foreground mt-1">{a.course?.title || 'Subject'}</p>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{a.description}</p>

                    {/* Due date row */}
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Due: {new Date(a.deadline || a.dueDate).toLocaleDateString()}</span>
                      {sub?.submittedAt && <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-success" /> Submitted: {new Date(sub.submittedAt).toLocaleDateString()}</span>}
                      {canManage && <span className="flex items-center gap-1"><Upload className="w-3 h-3" /> {a._count?.submissions || 0} submitted</span>}
                    </div>

                    {/* Attachment link */}
                    {a.filePath && (
                      <div className="mt-2">
                        <a href={`${import.meta.env.VITE_API_URL || ''}/${a.filePath}`.replace(/\\/g, '/')} target="_blank" rel="noopener noreferrer" className="text-xs text-primary font-medium hover:underline inline-flex items-center gap-1 font-semibold">
                          <FileText className="w-3 h-3" /> View Attachment
                        </a>
                      </div>
                    )}

                    {/* Student grade display — rubric breakdown or flat */}
                    {isStudent && sub?.grade != null && (
                      <div className="mt-3 p-3 bg-success/5 rounded-xl border border-success/20">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-success">{sub.grade}/{a.maxScore || 100}</span>
                          {sub.feedback && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <MessageSquare className="w-3 h-3" /> {sub.feedback}
                            </span>
                          )}
                        </div>
                        {sub.rubricScores?.length > 0 && (
                          <div className="space-y-1.5 mt-2 pt-2 border-t border-success/15">
                            {sub.rubricScores.map((rs: RubricScore) => (
                              <div key={rs.criterionId} className="flex items-center gap-2 text-xs">
                                <span className="text-muted-foreground flex-1 truncate">{rs.criterion?.name}</span>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <Progress value={rs.criterion?.maxPoints ? (rs.points / rs.criterion.maxPoints) * 100 : 0} className="w-20 h-1.5" />
                                  <span className="font-medium text-foreground w-12 text-right">{rs.points}/{rs.criterion?.maxPoints}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── Action buttons row (below content, mobile-friendly) ── */}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {isStudent && (status === 'pending' || status === 'overdue' || status === 'submitted') && (
                        <Button
                          size="sm"
                          variant={status === 'submitted' ? "outline" : (status === 'overdue' ? "destructive" : "default")}
                          onClick={() => handleOpenSubmit(a)}
                          disabled={status === 'overdue'}
                          className={cn(status === 'overdue' && "opacity-50 cursor-not-allowed")}
                        >
                          {status === 'submitted' ? 'Edit Submission' : (status === 'overdue' ? 'Closed' : 'Submit')}
                        </Button>
                      )}
                      {canManage && (
                        <>
                          <Button
                            size="sm"
                            variant={a.isPublished ? 'outline' : 'default'}
                            className={cn(
                              'gap-1.5',
                              a.isPublished
                                ? 'border-amber-500/40 text-amber-500 hover:bg-amber-500/10'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            )}
                            onClick={() => handleTogglePublish(a)}
                          >
                            {a.isPublished ? (
                              <><EyeOff className="w-3.5 h-3.5" /> Unpublish</>
                            ) : (
                              <><Globe className="w-3.5 h-3.5" /> Publish</>
                            )}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleViewSubmissions(a)}>View Submissions</Button>
                          <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-primary hover:bg-primary/20" onClick={() => handleEditAssignment(a)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/20" onClick={() => handleDeleteAssignment(a.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );

        })}
        {filtered.length === 0 && (
          <Card className="border-border"><CardContent className="p-8 text-center text-muted-foreground">No assignments found</CardContent></Card>
        )}
      </div>

      {/* ── Student Submit Dialog ── */}
      <Dialog open={!!showSubmit} onOpenChange={() => setShowSubmit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-heading">{showSubmit?.submissions?.[0] ? 'Edit Submission' : 'Submit Assignment'}</DialogTitle></DialogHeader>
          {showSubmit && (
            <form onSubmit={handleSubmit} className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">{showSubmit.title}</p>
              {/* Show rubric criteria to student for reference */}
              {showSubmit.rubricCriteria?.length > 0 && (
                <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 space-y-1.5">
                  <p className="text-xs font-semibold text-primary flex items-center gap-1.5 mb-2">
                    <ListChecks className="w-3.5 h-3.5" /> Grading Rubric
                  </p>
                  {showSubmit.rubricCriteria.map((c: any) => (
                    <div key={c.id} className="flex justify-between text-xs text-muted-foreground">
                      <span>{c.name}</span>
                      <span className="font-medium">{c.maxPoints} pts</span>
                    </div>
                  ))}
                  <div className="border-t border-primary/15 pt-1 mt-1 flex justify-between text-xs font-semibold">
                    <span>Total</span><span>{showSubmit.maxScore} pts</span>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label>Your Answer / Notes (Optional if attaching file)</Label>
                <Textarea rows={4} placeholder="Write your response..." value={submitText} onChange={e => setSubmitText(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Attach Files (Optional if providing text)</Label>
                <div className={cn("border-2 border-dashed border-border rounded-xl p-4 text-center cursor-pointer hover:border-primary/50 transition-colors", file && "border-primary bg-primary/5")} onClick={() => document.getElementById('file-upload')?.click()}>
                  <Upload className={cn("w-6 h-6 mx-auto mb-1", file ? "text-primary" : "text-muted-foreground")} />
                  <p className="text-xs text-muted-foreground">{file ? file.name : 'Drop files or click to browse'}</p>
                  <input type="file" id="file-upload" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => { setShowSubmit(null); setSubmitText(''); }}>Cancel</Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {showSubmit?.submissions?.[0] ? 'Update Submission' : 'Submit Assignment'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ── View Submissions Dialog ── */}
      <Dialog open={!!showSubmissionsFor} onOpenChange={(open) => !open && setShowSubmissionsFor(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <DialogTitle className="font-heading">Submissions for {showSubmissionsFor?.title}</DialogTitle>
            {submissionsData.length > 0 && (
              <Button size="sm" variant="outline" className="gap-2" onClick={() => handleDownloadGrades(showSubmissionsFor.id)}>
                <Download className="w-4 h-4" /> Download Grades
              </Button>
            )}
          </DialogHeader>

          {/* Show rubric summary if available */}
          {showSubmissionsFor?.rubricCriteria?.length > 0 && (
            <div className="flex flex-wrap gap-2 p-3 rounded-xl bg-primary/5 border border-primary/20 mb-2">
              <span className="text-xs font-semibold text-primary flex items-center gap-1 w-full"><ListChecks className="w-3.5 h-3.5" /> Rubric</span>
              {showSubmissionsFor.rubricCriteria.map((c: any) => (
                <Badge key={c.id} variant="outline" className="text-xs border-primary/30 text-primary">
                  {c.name}: {c.maxPoints}pts
                </Badge>
              ))}
            </div>
          )}

          <div className="space-y-4">
            {loadingSubmissions ? (
              <div className="py-10 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : submissionsData.length === 0 ? (
              <p className="text-center text-muted-foreground py-10">No submissions yet.</p>
            ) : (
              submissionsData.map((sub: any) => (
                <Card key={sub.id} className="border-border">
                  <CardContent className="p-4 flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-foreground">{sub.student?.user?.name || 'Unknown Student'}</h4>
                      <p className="text-sm text-muted-foreground">{sub.student?.user?.email}</p>
                      <div className="flex items-center gap-2 mt-2">
                        {sub.grade !== null && sub.grade !== undefined ? (
                          <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                            Graded: {sub.grade}/{showSubmissionsFor.maxScore || 100}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
                            Needs Grading
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">Submitted on {new Date(sub.submittedAt).toLocaleDateString()}</span>
                      </div>
                      {sub.textContent && (
                        <div className="mt-3 p-3 bg-muted rounded-md text-sm border border-border">{sub.textContent}</div>
                      )}
                      {sub.filePath && (
                        <Button variant="link" className="px-0 mt-2 h-auto text-primary font-semibold hover:underline" onClick={() => window.open(`${import.meta.env.VITE_API_URL || ''}/${sub.filePath}`.replace(/\\/g, '/'), '_blank')}>
                          View Attachment
                        </Button>
                      )}
                      {sub.feedback && (
                        <p className="text-sm text-muted-foreground mt-2 italic flex items-center gap-2">
                          <MessageSquare className="w-4 h-4" /> {sub.feedback}
                        </p>
                      )}
                      {/* Rubric score breakdown in submission card */}
                      {sub.rubricScores?.length > 0 && (
                        <div className="mt-3 space-y-1.5 p-3 bg-muted/30 rounded-lg border border-border">
                          <p className="text-xs font-semibold text-muted-foreground mb-2">Score Breakdown</p>
                          {sub.rubricScores.map((rs: RubricScore) => (
                            <div key={rs.criterionId} className="flex items-center gap-2 text-xs">
                              <span className="text-muted-foreground w-28 truncate shrink-0">{rs.criterion?.name}</span>
                              <Progress value={rs.criterion?.maxPoints ? (rs.points / rs.criterion.maxPoints) * 100 : 0} className="flex-1 h-1.5" />
                              <span className="font-medium text-foreground w-14 text-right shrink-0">{rs.points}/{rs.criterion?.maxPoints}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0">
                      <Button size="sm" onClick={() => openGradeDialog(sub)}>
                        {sub.grade !== null && sub.grade !== undefined ? 'Update Grade' : 'Grade'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Grade Dialog (with Rubric Sliders) ── */}
      <Dialog open={!!gradingSubmission} onOpenChange={(open) => {
        if (!open) {
          setGradingSubmission(null);
          setTimeout(() => handleViewSubmissions(showSubmissionsFor), 100);
        }
      }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">
              Grade Submission
              {showSubmissionsFor?.rubricCriteria?.length > 0 && (
                <Badge variant="outline" className="ml-2 text-xs border-primary/30 text-primary">Rubric</Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {gradingSubmission && (() => {
            const criteria: any[] = showSubmissionsFor?.rubricCriteria || [];
            const useRubric = criteria.length > 0;
            const rubricTotal = gradingPayload.rubricScores.reduce((s, rs) => s + rs.points, 0);
            const rubricMax = showSubmissionsFor?.maxScore || 100;

            return (
              <form onSubmit={handleSubmitGrade} className="space-y-5 py-2">
                <p className="text-sm text-muted-foreground">
                  Student: <span className="font-semibold text-foreground">{gradingSubmission.student?.user?.name}</span>
                </p>

                {useRubric ? (
                  /* ── Per-criterion sliders ── */
                  <div className="space-y-5">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                        <ListChecks className="w-4 h-4 text-primary" /> Rubric Scoring
                      </p>
                      <div className="text-right">
                        <span className={cn(
                          'text-xl font-bold font-heading',
                          rubricTotal >= rubricMax * 0.7 ? 'text-success' :
                          rubricTotal >= rubricMax * 0.5 ? 'text-warning' : 'text-destructive'
                        )}>
                          {rubricTotal}
                        </span>
                        <span className="text-sm text-muted-foreground">/{rubricMax}</span>
                      </div>
                    </div>

                    {/* Overall progress bar */}
                    <Progress value={(rubricTotal / rubricMax) * 100} className="h-2" />

                    {/* Per-criterion sliders */}
                    {criteria.map((criterion: any) => {
                      const scoreEntry = gradingPayload.rubricScores.find(rs => rs.criterionId === criterion.id);
                      const currentPoints = scoreEntry?.points ?? 0;
                      const pct = criterion.maxPoints > 0 ? Math.round((currentPoints / criterion.maxPoints) * 100) : 0;

                      return (
                        <div key={criterion.id} className="space-y-2 p-4 rounded-xl bg-muted/30 border border-border">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium">{criterion.name}</Label>
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                'text-lg font-bold font-heading',
                                pct >= 70 ? 'text-success' : pct >= 50 ? 'text-warning' : 'text-destructive'
                              )}>
                                {currentPoints}
                              </span>
                              <span className="text-sm text-muted-foreground">/ {criterion.maxPoints}</span>
                            </div>
                          </div>
                          <Slider
                            min={0}
                            max={criterion.maxPoints}
                            step={1}
                            value={[currentPoints]}
                            onValueChange={([val]) => {
                              setGradingPayload(prev => ({
                                ...prev,
                                rubricScores: prev.rubricScores.map(rs =>
                                  rs.criterionId === criterion.id ? { ...rs, points: val } : rs
                                )
                              }));
                            }}
                            className="w-full"
                          />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>0</span>
                            <span>{Math.round(criterion.maxPoints / 2)}</span>
                            <span>{criterion.maxPoints}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* ── Flat grade input ── */
                  <div className="space-y-2">
                    <Label>Score (out of {showSubmissionsFor?.maxScore || 100})</Label>
                    <Input
                      type="number"
                      max={showSubmissionsFor?.maxScore || 100}
                      required
                      value={gradingPayload.grade}
                      onChange={(e) => setGradingPayload(prev => ({ ...prev, grade: e.target.value }))}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Feedback (Optional)</Label>
                  <Textarea
                    rows={3}
                    value={gradingPayload.feedback}
                    onChange={(e) => setGradingPayload(prev => ({ ...prev, feedback: e.target.value }))}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setGradingSubmission(null)}>Cancel</Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Save Grade
                  </Button>
                </div>
              </form>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
