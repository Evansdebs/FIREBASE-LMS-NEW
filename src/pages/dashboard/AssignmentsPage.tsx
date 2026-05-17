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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import { Plus, Search, FileText, Upload, Download, Clock, CheckCircle, XCircle, MessageSquare, Loader2, Trash2, Edit } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Assignment {
  id: string;
  title: string;
  course: string;
  description: string;
  dueDate: string;
  status: 'pending' | 'submitted' | 'graded' | 'overdue';
  grade?: number;
  maxGrade: number;
  feedback?: string;
  submittedAt?: string;
  submissions?: number;
  totalStudents?: number;
}

const STUDENT_ASSIGNMENTS: Assignment[] = [
  { id: '1', title: 'Linear Equations Problem Set', course: 'Advanced Mathematics', description: 'Solve problems 1-20 from Chapter 3.', dueDate: '2026-04-02', status: 'pending', maxGrade: 100 },
  { id: '2', title: 'Newton\'s Laws Lab Report', course: 'Physics 101', description: 'Write a detailed lab report on the pendulum experiment.', dueDate: '2026-03-30', status: 'submitted', maxGrade: 100, submittedAt: '2026-03-28' },
  { id: '3', title: 'Poetry Analysis Essay', course: 'English Literature', description: 'Analyze the themes in "The Road Not Taken".', dueDate: '2026-03-25', status: 'graded', maxGrade: 100, grade: 88, feedback: 'Excellent analysis of metaphor. Could improve thesis statement.', submittedAt: '2026-03-24' },
  { id: '4', title: 'Chemical Bonding Worksheet', course: 'Chemistry Lab', description: 'Complete the ionic and covalent bonding exercises.', dueDate: '2026-03-20', status: 'overdue', maxGrade: 50 },
];

const TEACHER_ASSIGNMENTS: Assignment[] = [
  { id: '1', title: 'Linear Equations Problem Set', course: 'Advanced Mathematics', description: 'Solve problems 1-20 from Chapter 3.', dueDate: '2026-04-02', status: 'pending', maxGrade: 100, submissions: 18, totalStudents: 32 },
  { id: '2', title: 'Quadratic Functions Quiz', course: 'Advanced Mathematics', description: 'Quiz on quadratic equations and graphing.', dueDate: '2026-03-30', status: 'pending', maxGrade: 50, submissions: 30, totalStudents: 32 },
  { id: '3', title: 'Calculus Homework 1', course: 'Advanced Mathematics', description: 'Derivatives practice problems.', dueDate: '2026-03-25', status: 'graded', maxGrade: 100, submissions: 32, totalStudents: 32 },
];

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
  const [gradingPayload, setGradingPayload] = useState({ grade: '', feedback: '' });
  const [submitting, setSubmitting] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  // Create Assignment State
  const [courses, setCourses] = useState<any[]>([]);
  const [availableClasses, setAvailableClasses] = useState<any[]>([]);
  const [createPayload, setCreatePayload] = useState<{
    courseId: string;
    title: string;
    description: string;
    deadline: string;
    maxScore: string;
    classIds: string[];
  }>({
    courseId: '', title: '', description: '', deadline: '', maxScore: '100', classIds: []
  });
  const [editingAssignment, setEditingAssignment] = useState<any | null>(null);
  const [submitText, setSubmitText] = useState('');

  const isStudent = user?.role === 'student';
  const isAdmin = user?.role === 'super_admin';
  const isTeacher = user?.role === 'teacher';
  const canManage = isAdmin || isTeacher;

  useEffect(() => {
    fetchAssignments();
    if (canManage) fetchCourses();
  }, [user]);

  const fetchCourses = async () => {
    try {
      const res = await api.get(isAdmin ? '/api/admin/courses' : '/api/teacher/my-courses');
      const courseList = Array.isArray(res) ? res : res.courses || [];
      setCourses(courseList);
    } catch (err: any) {
      console.error('Failed to load courses:', err);
    }
  };

  const handleCourseChange = (courseId: string) => {
    const selectedCourse = courses.find(c => c.id.toString() === courseId);
    setCreatePayload(prev => ({ ...prev, courseId, classIds: [] }));
    if (selectedCourse) {
      // Assuming course has courseClasses or we can derive from subject
      const classes = selectedCourse.courseClasses?.map((cc: any) => cc.class) || [];
      setAvailableClasses(classes);
    } else {
      setAvailableClasses([]);
    }
  };

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      let endpoint = isStudent ? '/api/student/assignments' : 
                     isTeacher ? '/api/teacher/assignments' : 
                     '/api/admin/assignments';
      const res = await api.get(endpoint);
      setAssignments(Array.isArray(res) ? res : res.assignments || []);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filtered = assignments.filter(a => {
    const matchSearch = a.title.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || a.status === statusFilter;
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

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createPayload.courseId) return toast.error('Please select a course.');
    
    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append('courseId', createPayload.courseId);
      formData.append('title', createPayload.title);
      formData.append('description', createPayload.description);
      formData.append('deadline', createPayload.deadline);
      formData.append('maxScore', createPayload.maxScore);
      formData.append('classIds', JSON.stringify(createPayload.classIds));
      if (file) formData.append('file', file);

      if (editingAssignment) {
        await api.upload(`/api/teacher/assignments/${editingAssignment.id}`, formData, 'PUT');
        toast.success('Assignment updated successfully!');
      } else {
        await api.upload(isAdmin ? '/api/admin/assignments' : '/api/teacher/assignments', formData);
        toast.success('Assignment created successfully!');
      }
      
      setShowCreate(false);
      setEditingAssignment(null);
      setFile(null);
      setCreatePayload({ courseId: '', title: '', description: '', deadline: '', maxScore: '100', classIds: [] });
      setAvailableClasses([]);
      fetchAssignments();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showSubmit) return;
    if (!submitText && !file) return toast.error('Please provide either a text response or a file attachment.');

    try {
      setSubmitting(true);
      const formData = new FormData();
      if (file) formData.append('submission', file);
      formData.append('textContent', submitText);
      await api.upload(`/api/student/assignments/${showSubmit.id}/submit`, formData);
      toast.success('Assignment submitted successfully!');
      setShowSubmit(null);
      setFile(null);
      fetchAssignments();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewSubmissions = async (assignment: any) => {
    setShowSubmissionsFor(assignment);
    setLoadingSubmissions(true);
    try {
      const data = await api.get(`/api/teacher/assignments/${assignment.id}/submissions`);
      setSubmissionsData(data);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoadingSubmissions(false);
    }
  };

  const handleSubmitGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gradingSubmission) return;
    try {
      setSubmitting(true);
      await api.put(`/api/teacher/submissions/${gradingSubmission.id}/grade`, gradingPayload);
      toast.success('Grade submitted successfully');
      setGradingSubmission(null);
      handleViewSubmissions(showSubmissionsFor); // Refresh submissions
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAssignment = async (id: number) => {
    if (!confirm('Are you sure you want to delete this assignment? All submissions and grades will be lost.')) return;
    try {
      await api.delete(`/api/teacher/assignments/${id}`);
      toast.success('Assignment deleted');
      fetchAssignments();
    } catch (err: any) {
      toast.error(err.message);
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
      classIds: assignment.assignmentClasses?.map((ac: any) => ac.classId.toString()) || []
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
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="w-4 h-4" /> Create Assignment</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle className="font-heading">Create Assignment</DialogTitle></DialogHeader>
              <form onSubmit={handleCreateAssignment} className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input required value={createPayload.title} onChange={e => setCreatePayload(prev => ({ ...prev, title: e.target.value }))} />
                </div>
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
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea required value={createPayload.description} onChange={e => setCreatePayload(prev => ({ ...prev, description: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Due Date</Label>
                    <Input type="date" required value={createPayload.deadline} onChange={e => setCreatePayload(prev => ({ ...prev, deadline: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Grade</Label>
                    <Input type="number" required value={createPayload.maxScore} onChange={e => setCreatePayload(prev => ({ ...prev, maxScore: e.target.value }))} />
                  </div>
                </div>
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
                    Create
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

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
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="graded">Graded</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {loading ? (
          <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : filtered.map((a: any) => {
          const status = a.submissions?.length > 0 ? (a.submissions[0].grade ? 'graded' : 'submitted') : (new Date(a.dueDate) < new Date() ? 'overdue' : 'pending');
          return (
            <Card key={a.id} className="border-border hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-heading font-semibold text-card-foreground">{a.title}</h3>
                        {statusBadge(status)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{a.course?.title || 'Subject'}</p>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{a.description}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Due: {new Date(a.dueDate).toLocaleDateString()}</span>
                        {a.submissions?.[0]?.submittedAt && <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-success" /> Submitted: {new Date(a.submissions[0].submittedAt).toLocaleDateString()}</span>}
                        {canManage && (
                          <span className="flex items-center gap-1"><Upload className="w-3 h-3" /> {a._count?.submissions || 0} submitted</span>
                        )}
                      </div>
                      {a.filePath && (
                        <div className="mt-2">
                           <a href={`${import.meta.env.VITE_API_URL || ''}/${a.filePath}`.replace(/\\/g, '/')} target="_blank" rel="noopener noreferrer" className="text-xs text-primary font-medium hover:underline inline-flex items-center gap-1 font-semibold">
                             <FileText className="w-3 h-3" /> View Attachment
                           </a>
                        </div>
                      )}
                      {a.submissions?.[0]?.grade !== undefined && a.submissions?.[0]?.grade !== null && (
                        <div className="mt-2 p-2 bg-success/5 rounded-lg">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-success">{a.submissions[0].grade}/{a.maxGrade || 100}</span>
                            {a.submissions[0].feedback && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <MessageSquare className="w-3 h-3" /> {a.submissions[0].feedback}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0">
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
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleViewSubmissions(a)}>View Submissions</Button>
                        <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-primary hover:bg-primary/20 font-semibold" onClick={() => handleEditAssignment(a)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/20 font-semibold" onClick={() => handleDeleteAssignment(a.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
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

      {/* Submit Dialog */}
      <Dialog open={!!showSubmit} onOpenChange={() => setShowSubmit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-heading">{showSubmit?.submissions?.[0] ? 'Edit Submission' : 'Submit Assignment'}</DialogTitle></DialogHeader>
          {showSubmit && (
            <form onSubmit={handleSubmit} className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">{showSubmit.title}</p>
              <div className="space-y-2">
                <Label>Your Answer / Notes (Optional if attaching file)</Label>
                <Textarea 
                  rows={4} 
                  placeholder="Write your response..." 
                  value={submitText}
                  onChange={e => setSubmitText(e.target.value)}
                />
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

      {/* View Submissions Dialog */}
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
          <div className="space-y-4">
            {loadingSubmissions ? (
              <div className="py-10 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : submissionsData.length === 0 ? (
              <p className="text-center text-muted-foreground py-10">No submissions yet.</p>
            ) : (
              submissionsData.map((sub: any) => (
                <Card key={sub.id} className="border-border">
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div>
                      <h4 className="font-semibold text-foreground">{sub.student?.user?.name || 'Unknown Student'}</h4>
                      <p className="text-sm text-muted-foreground">{sub.student?.user?.email}</p>
                      <div className="flex items-center gap-2 mt-2">
                        {sub.grade !== null ? (
                          <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                            Graded: {sub.grade}/{showSubmissionsFor.maxScore || 100}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
                            Needs Grading
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground ml-2">
                          Submitted on {new Date(sub.submittedAt).toLocaleDateString()}
                        </span>
                      </div>
                      {sub.textContent && (
                        <div className="mt-3 p-3 bg-muted rounded-md text-sm border border-border">
                          {sub.textContent}
                        </div>
                      )}
                      {sub.filePath && (
                        <Button 
                          variant="link" 
                          className="px-0 mt-2 h-auto text-primary font-semibold hover:underline"
                          onClick={() => window.open(`${import.meta.env.VITE_API_URL || ''}/${sub.filePath}`.replace(/\\/g, '/'), '_blank')}
                        >
                          View Attachment
                        </Button>
                      )}
                      {sub.feedback && (
                        <p className="text-sm text-muted-foreground mt-2 italic flex items-center gap-2">
                          <MessageSquare className="w-4 h-4" /> {sub.feedback}
                        </p>
                      )}
                    </div>
                    <div>
                      <Button size="sm" onClick={() => {
                        setGradingSubmission(sub);
                        setGradingPayload({ grade: sub.grade?.toString() || '', feedback: sub.feedback || '' });
                      }}>
                        {sub.grade !== null ? 'Update Grade' : 'Grade'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Grade Dialog */}
      <Dialog open={!!gradingSubmission} onOpenChange={(open) => {
        if (!open) {
          setGradingSubmission(null);
          // Wait for transition before refreshing to avoid blank state
          setTimeout(() => handleViewSubmissions(showSubmissionsFor), 100);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-heading">Grade Submission</DialogTitle></DialogHeader>
          {gradingSubmission && (
            <form onSubmit={handleSubmitGrade} className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                Student: <span className="font-semibold">{gradingSubmission.student?.user?.name}</span>
              </p>
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
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
