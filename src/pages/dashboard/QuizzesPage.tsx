import { useState, useEffect, useCallback, useRef } from 'react';
import { jsPDF } from 'jspdf';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import {
  Plus, Search, Clock, CheckCircle, XCircle, PlayCircle, Trophy,
  AlertTriangle, Trash2, Edit, Loader2, Download, Upload, FileSpreadsheet, FileText, Calendar, Timer, ClipboardList, RefreshCw, UserCheck, Users, X
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const LABELS = ['A', 'B', 'C', 'D'];

// ─── COUNTDOWN HOOK ─────────────────────────────────────
function useCountdown(dueDate: string | null | undefined) {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!dueDate) return;
    const target = new Date(dueDate).getTime();
    const tick = () => setTimeLeft(Math.max(0, target - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [dueDate]);
  return timeLeft;
}

function formatCountdown(ms: number) {
  if (ms <= 0) return null;
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h left`;
  if (h > 0) return `${h}h ${m % 60}m left`;
  if (m > 0) return `${m}m ${s % 60}s left`;
  return `${s}s left`;
}

function QuizDueBadge({ dueDate }: { dueDate: string }) {
  const timeLeft = useCountdown(dueDate);

  if (timeLeft === null) return null;

  if (timeLeft <= 0) {
    return (
      <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 font-medium mb-3">
        Closed
      </Badge>
    );
  }

  const formatted = formatCountdown(timeLeft);
  if (!formatted) {
    return (
      <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 font-medium mb-3">
        Closed
      </Badge>
    );
  }

  // Determine colors based on urgency
  let colorClass = "bg-success/10 text-success border-success/20";
  if (timeLeft <= 3600 * 1000) { // < 1 hour
    colorClass = "bg-destructive/10 text-destructive border-destructive/20 animate-pulse font-bold";
  } else if (timeLeft <= 24 * 3600 * 1000) { // < 24 hours
    colorClass = "bg-warning/10 text-warning border-warning/20 font-semibold";
  }

  return (
    <Badge variant="outline" className={cn("font-medium mb-3 gap-1 flex items-center w-fit", colorClass)}>
      <Clock className="w-3.5 h-3.5" />
      {formatted}
    </Badge>
  );
}

const downloadCSVTemplate = () => {
  const headers = [
    'Question Text',
    'Points',
    'Option A',
    'A Correct',
    'Option B',
    'B Correct',
    'Option C',
    'C Correct',
    'Option D',
    'D Correct'
  ];
  const sampleRow = [
    'What is the capital of France?',
    '1',
    'Paris',
    'YES',
    'London',
    'NO',
    'Berlin',
    'NO',
    'Rome',
    'NO'
  ];
  const csvContent = [
    headers.join(','),
    sampleRow.map(val => `"${val.replace(/"/g, '""')}"`).join(',')
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'quiz_import_template.csv');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  toast.success('Template downloaded successfully!');
};

export default function QuizzesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'super_admin';
  const isTeacher = user?.role === 'teacher';
  const isStudent = user?.role === 'student';
  const canManage = isAdmin || isTeacher;

  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [quizToEdit, setQuizToEdit] = useState<any>(null);
  const [activeAttempt, setActiveAttempt] = useState<any | null>(null);
  const [activeQuiz, setActiveQuiz] = useState<any | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [instructionsQuiz, setInstructionsQuiz] = useState<any | null>(null);
  const [agreedToInstructions, setAgreedToInstructions] = useState(false);
  const [grantRetakeQuiz, setGrantRetakeQuiz] = useState<any | null>(null);
  const [existingGrants, setExistingGrants] = useState<any[]>([]);
  const [grantTarget, setGrantTarget] = useState<'student' | 'class'>('student');
  const [grantStudentId, setGrantStudentId] = useState('');
  const [grantClassId, setGrantClassId] = useState('');
  const [grantStudents, setGrantStudents] = useState<any[]>([]);
  const [grantClasses, setGrantClasses] = useState<any[]>([]);
  const [grantLoading, setGrantLoading] = useState(false);

  const openGrantRetake = async (quiz: any) => {
    try {
      setGrantRetakeQuiz(quiz);
      setGrantStudentId('');
      setGrantClassId('');
      
      // Fetch existing grants
      const grantsRes = await api.get(`/api/teacher/quizzes/${quiz.id}/grants`);
      setExistingGrants(grantsRes);

      // Fetch course classes & students
      const courseRes = await api.get(`/api/teacher/courses/${quiz.courseId}`);
      const classes = courseRes.courseClasses?.map((cc: any) => cc.class) || [];
      const students = classes.flatMap((c: any) => c.students || []);
      const uniqueStudents = Array.from(new Map(students.map((s: any) => [s.id, s])).values());
      
      setGrantClasses(classes);
      setGrantStudents(uniqueStudents);
    } catch (err: any) {
      toast.error('Failed to load grant details');
    }
  };

  const submitGrant = async () => {
    if (!grantRetakeQuiz) return;
    try {
      setGrantLoading(true);
      const payload = grantTarget === 'student' 
        ? { studentId: parseInt(grantStudentId) } 
        : { classId: parseInt(grantClassId) };
        
      await api.post(`/api/teacher/quizzes/${grantRetakeQuiz.id}/grants`, payload);
      toast.success('Retake permission granted successfully!');
      
      // Refresh grants list
      const grantsRes = await api.get(`/api/teacher/quizzes/${grantRetakeQuiz.id}/grants`);
      setExistingGrants(grantsRes);
      
      setGrantStudentId('');
      setGrantClassId('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to grant retake');
    } finally {
      setGrantLoading(false);
    }
  };

  const revokeGrant = async (quizId: number, grantId: number) => {
    if (!confirm('Revoke this retake permission?')) return;
    try {
      await api.delete(`/api/teacher/quizzes/${quizId}/grants/${grantId}`);
      toast.success('Retake permission revoked.');
      
      // Refresh grants list
      const grantsRes = await api.get(`/api/teacher/quizzes/${quizId}/grants`);
      setExistingGrants(grantsRes);
    } catch (err: any) {
      toast.error(err.message || 'Failed to revoke retake');
    }
  };

  // Listen for custom import event from form
  useEffect(() => {
    const handleImport = (e: any) => {
      const { quizId, file } = e.detail;
      importQuizFromCSV(quizId, file);
    };
    window.addEventListener('importQuizCSV', handleImport);
    return () => window.removeEventListener('importQuizCSV', handleImport);
  }, [isAdmin, user]);

  const [timeLeft, setTimeLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [uploading, setUploading] = useState(false);


  const deleteQuiz = async (id: number) => {
    if (!confirm('Delete this quiz? All results will be lost.')) return;
    try {
      const endpoint = isAdmin ? `/api/admin/quizzes/${id}` : `/api/teacher/quizzes/${id}`;
      await api.delete(endpoint);
      toast.success('Quiz deleted');
      fetchQuizzes();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleEditClick = async (quiz: any) => {
    try {
      setLoadingQuiz(true);
      const endpoint = isAdmin ? `/api/admin/quizzes/${quiz.id}` : `/api/teacher/quizzes/${quiz.id}`;
      const fullQuiz = await api.get(endpoint);
      setQuizToEdit(fullQuiz);
      setShowEdit(true);
    } catch (err: any) {
      toast.error('Failed to load quiz details');
    } finally {
      setLoadingQuiz(false);
    }
  };

  useEffect(() => { fetchQuizzes(); }, [user]);

  const fetchQuizzes = async () => {
    try {
      setLoading(true);
      let endpoint = isStudent ? '/api/student/quizzes' :
                     isTeacher ? '/api/teacher/quizzes' :
                     '/api/admin/quizzes';
      const res = await api.get(endpoint);
      setQuizzes(Array.isArray(res) ? res : res.quizzes || []);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const exportQuizToPDF = async (quizId: number) => {
    try {
      const endpoint = isAdmin ? `/api/admin/quizzes/${quizId}` : `/api/teacher/quizzes/${quizId}`;
      const res = await api.get(endpoint);
      if (!res) throw new Error('Failed to fetch quiz');

      const doc = new jsPDF();
      doc.setFontSize(22);
      doc.text(res.title || 'Quiz', 14, 20);
      
      doc.setFontSize(14);
      doc.text(`Subject: ${res.course?.subject?.name || 'N/A'}`, 14, 30);
      let yPos = 38;
      if (res.class?.name) {
         doc.text(`Class: ${res.class?.name}`, 14, yPos);
         yPos += 8;
      }

      doc.setFontSize(12);

      res.quizQuestions?.forEach((q: any, i: number) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }

        const questionLines = doc.splitTextToSize(`${i + 1}. ${q.questionText}`, 180);
        doc.setFont(undefined, 'bold');
        doc.text(questionLines, 14, yPos);
        yPos += (questionLines.length * 6) + 2;

        doc.setFont(undefined, 'normal');
        q.options?.forEach((opt: any) => {
          if (yPos > 280) {
            doc.addPage();
            yPos = 20;
          }
          const optText = `    ${opt.optionLabel}. ${opt.optionText} ${opt.isCorrect ? '(Correct Answer)' : ''}`;
          if (opt.isCorrect) doc.setFont(undefined, 'bolditalic');
          else doc.setFont(undefined, 'normal');
          
          const optLines = doc.splitTextToSize(optText, 170);
          doc.text(optLines, 14, yPos);
          yPos += (optLines.length * 6);
        });
        
        yPos += 6;
      });

      doc.save(`${(res.title || 'Quiz').replace(/\s+/g, '_')}.pdf`);
      toast.success('PDF exported successfully');
    } catch (err) {
      toast.error('Failed to export quiz to PDF format');
    }
  };

  const exportQuizToCSV = async (quizId: number) => {
    try {
      const endpoint = isAdmin 
        ? `/api/admin/quizzes/${quizId}/export/csv`
        : `/api/teacher/quizzes/${quizId}/export/csv`;
      
      const blob = await api.get(endpoint, { responseType: 'blob' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Quiz_${quizId}_Questions.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('CSV exported successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to export CSV');
    }
  };

  const importQuizFromCSV = async (quizId: number, file: File) => {
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);

      const endpoint = isAdmin 
        ? `/api/admin/quizzes/${quizId}/import/csv`
        : `/api/teacher/quizzes/${quizId}/import/csv`;

      await api.post(endpoint, formData);
      toast.success('Questions imported successfully!');
      fetchQuizzes();
      // If we are in edit mode, we might need to refresh the edit form
      if (showEdit && quizToEdit?.id === quizId) {
        handleEditClick({ id: quizId });
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to import CSV');
    } finally {
      setUploading(false);
    }
  };

  const filtered = quizzes.filter(q => {
    const matchSearch = q.title.toLowerCase().includes(search.toLowerCase());
    if (isStudent && !q.isPublished) return false;
    return matchSearch;
  });

  // Timer logic
  useEffect(() => {
    if (!activeAttempt || activeAttempt.submitted) return;
    if (timeLeft <= 0 && activeAttempt) { handleSubmitQuiz(); return; }
    const timer = setInterval(() => setTimeLeft(t => Math.max(0, t - 1)), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, activeAttempt]);

  const startQuiz = async (quiz: any) => {
    try {
      const res = await api.get(`/api/student/quizzes/${quiz.id}/start`);
      const quizData = res.quiz;
      setActiveQuiz(quizData);
      setActiveAttempt({
        id: res.attemptId,
        quizId: quiz.id,
        answers: {},
        score: null,
        submitted: false,
        startedAt: Date.now(),
        strikes: 0,
      });
      setTimeLeft(quizData.duration * 60);
      setShowResults(false);
      
      // Request Fullscreen
      document.documentElement.requestFullscreen().catch(() => {
        toast.error('Could not auto-enable fullscreen mode.');
      });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const reviewQuiz = async (attemptId: number) => {
    try {
      setLoadingQuiz(true);
      const res = await api.get(`/api/student/quizzes/attempts/${attemptId}`);
      
      const answersMap: Record<number, number> = {};
      (res.answers || []).forEach((ans: any) => {
        if (ans.selectedOptionId) {
          answersMap[ans.questionId] = ans.selectedOptionId;
        }
      });

      setActiveQuiz(res.quiz);
      setActiveAttempt({
        id: res.id,
        quizId: res.quizId,
        answers: answersMap,
        score: res.score,
        total: res.total,
        submitted: true,
        startedAt: res.submittedAt,
        strikes: res.strikes,
      });
      setShowResults(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load quiz review');
    } finally {
      setLoadingQuiz(false);
    }
  };

  const selectAnswer = (questionId: number, optionId: number) => {
    if (!activeAttempt || activeAttempt.submitted) return;
    setActiveAttempt((prev: any) => prev ? {
      ...prev,
      answers: { ...prev.answers, [questionId]: optionId }
    } : null);
  };

  const handleSubmitQuiz = useCallback(async () => {
    if (!activeAttempt || !activeQuiz || submitting) return;
    try {
      setSubmitting(true);
      const res = await api.post(`/api/student/quizzes/${activeQuiz.id}/submit`, {
        answers: activeAttempt.answers,
        attemptId: activeAttempt.id
      });
      setActiveAttempt((prev: any) => ({ ...prev, submitted: true, score: res.percentage }));
      setShowResults(true);
      toast.success('Quiz submitted successfully!');
      fetchQuizzes();
      
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }, [activeAttempt, activeQuiz, submitting]);

  // Lockdown Rules Engine
  useEffect(() => {
    if (!activeAttempt || activeAttempt.submitted || !activeQuiz) return;

    const preventDefault = (e: Event) => {
      e.preventDefault();
      toast.warning('This action is disabled during the exam.');
    };

    let isStriking = false;

    const handleVisibilityChange = async () => {
      if (document.hidden && !isStriking) {
        isStriking = true;
        try {
           const res = await api.post(`/api/student/quizzes/${activeQuiz.id}/strike`, {
             attemptId: activeAttempt.id
           });
           
           if (res.strikes >= 3) {
             toast.error('EXAM TERMINATED: You have exceeded the maximum allowed tab switches (3).');
             await handleSubmitQuiz();
           } else {
             toast.error(`WARNING: You left the exam screen. Strike ` + res.strikes + `/3. At 3 strikes your exam is auto-submitted.`);
           }
        } catch (e) {
           console.error(e);
        } finally {
           isStriking = false;
        }
      }
    };

    document.addEventListener('contextmenu', preventDefault);
    document.addEventListener('copy', preventDefault);
    document.addEventListener('paste', preventDefault);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('contextmenu', preventDefault);
      document.removeEventListener('copy', preventDefault);
      document.removeEventListener('paste', preventDefault);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [activeAttempt, activeQuiz, handleSubmitQuiz]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      published: 'bg-success/10 text-success border-success/20',
      draft: 'bg-warning/10 text-warning border-warning/20',
    };
    return <Badge variant="outline" className={cn('font-medium capitalize', styles[status])}>{status}</Badge>;
  };

  // ─── ACTIVE QUIZ TAKING VIEW ────────────────────────────
  if (activeQuiz && activeAttempt) {
    const questions = activeQuiz.quizQuestions || [];
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground">{activeQuiz.title}</h1>
            <p className="text-muted-foreground mt-1">{activeQuiz.course?.title}</p>
          </div>
          <div className="flex items-center gap-3">
            {!activeAttempt.submitted && (
              <div className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg font-heading font-bold text-lg',
                timeLeft <= 60 ? 'bg-destructive/10 text-destructive animate-pulse' :
                timeLeft <= 300 ? 'bg-warning/10 text-warning' : 'bg-primary/10 text-primary'
              )}>
                <Clock className="w-5 h-5" />
                {formatTime(timeLeft)}
              </div>
            )}
          </div>
        </div>

        {!activeAttempt.submitted && (
          <Card className="border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">
                  {Object.keys(activeAttempt.answers).length} of {questions.length} answered
                </span>
                <span className="text-sm font-medium text-primary">
                  {questions.length > 0 ? Math.round((Object.keys(activeAttempt.answers).length / questions.length) * 100) : 0}%
                </span>
              </div>
              <Progress value={questions.length > 0 ? (Object.keys(activeAttempt.answers).length / questions.length) * 100 : 0} className="h-2" />
            </CardContent>
          </Card>
        )}

        {showResults && activeAttempt.score !== null && (
          <Card className={cn('border-2', activeAttempt.score >= 50 ? 'border-success/30 bg-success/5' : 'border-destructive/30 bg-destructive/5')}>
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-3"
                style={{ background: activeAttempt.score >= 50 ? 'hsl(var(--success) / 0.15)' : 'hsl(var(--destructive) / 0.15)' }}>
                {activeAttempt.score >= 50
                  ? <Trophy className="w-8 h-8 text-success" />
                  : <AlertTriangle className="w-8 h-8 text-destructive" />
                }
              </div>
              <h2 className="font-heading text-3xl font-bold text-foreground">{Math.round(activeAttempt.score)}%</h2>
              <p className="text-muted-foreground mt-1">
                {activeAttempt.score >= 50 ? 'Congratulations! You passed!' : 'You need 50% to pass.'}
              </p>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          {questions.map((question: any, qi: number) => {
            const selectedOptionId = activeAttempt.answers[question.id];
            const correctOption = question.options?.find((o: any) => o.isCorrect);

            return (
              <Card key={question.id} className={cn('border-border',
                showResults && selectedOptionId === correctOption?.id ? 'ring-1 ring-success/30' :
                showResults && selectedOptionId ? 'ring-1 ring-destructive/30' : ''
              )}>
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
                      {qi + 1}
                    </span>
                    <div className="flex-1">
                      <p className="font-medium text-card-foreground mb-3">{question.questionText}</p>
                      {showResults ? (
                        // Review mode: plain divs with explicit color highlighting
                        <div className="space-y-2">
                          {(question.options || []).map((opt: any) => {
                            const isSelected = selectedOptionId === opt.id;
                            const isCorrect = opt.isCorrect;
                            return (
                              <div
                                key={opt.id}
                                className={cn(
                                  'flex items-center gap-3 p-3 rounded-lg border transition-all',
                                  isCorrect
                                    ? 'border-success bg-success/10 text-success font-medium'
                                    : isSelected && !isCorrect
                                    ? 'border-destructive bg-destructive/10 text-destructive'
                                    : 'border-border bg-muted/5 text-muted-foreground/50'
                                )}
                              >
                                <span className={cn(
                                  'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                                  isCorrect 
                                    ? 'bg-success text-white' 
                                    : isSelected && !isCorrect 
                                    ? 'bg-destructive text-white' 
                                    : 'bg-muted text-muted-foreground'
                                )}>{opt.optionLabel}</span>
                                <span className="text-sm flex-1">{opt.optionText}</span>
                                {isCorrect && <CheckCircle className="w-4 h-4 text-success shrink-0" />}
                                {isSelected && !isCorrect && <XCircle className="w-4 h-4 text-destructive shrink-0" />}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        // Active quiz mode: interactive radio group
                        <RadioGroup
                          value={selectedOptionId?.toString()}
                          onValueChange={v => selectAnswer(question.id, parseInt(v))}
                        >
                          {(question.options || []).map((opt: any) => (
                            <label
                              key={opt.id}
                              className={cn(
                                'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all',
                                selectedOptionId === opt.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30 hover:bg-primary/5'
                              )}
                            >
                              <RadioGroupItem value={opt.id.toString()} />
                              <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold">{opt.optionLabel}</span>
                              <span className="text-sm text-card-foreground flex-1">{opt.optionText}</span>
                            </label>
                          ))}
                        </RadioGroup>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="flex justify-between">
          <Button variant="outline" onClick={() => { 
             if (document.fullscreenElement) document.exitFullscreen().catch(()=>{});
             setActiveQuiz(null); 
             setActiveAttempt(null); 
          }}>
            {activeAttempt.submitted ? 'Back to Quizzes' : 'Abandon Quiz'}
          </Button>
          {!activeAttempt.submitted && (
            <Button onClick={handleSubmitQuiz} className="gap-2" disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />} Submit Quiz
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ─── QUIZ LIST VIEW ────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Quizzes</h1>
          <p className="text-muted-foreground mt-1">{filtered.length} quizzes available</p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <Dialog open={showCreate} onOpenChange={setShowCreate}>
              <DialogTrigger asChild>
                <Button className="gap-2"><Plus className="w-4 h-4" /> Create Quiz</Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle className="font-heading">Create MCQ Quiz</DialogTitle></DialogHeader>
                <CreateQuizForm onClose={() => setShowCreate(false)} onRefresh={fetchQuizzes} isAdmin={isAdmin} />
              </DialogContent>
            </Dialog>

            <Dialog open={showEdit} onOpenChange={setShowEdit}>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle className="font-heading">Edit Quiz</DialogTitle></DialogHeader>
                {quizToEdit && <EditQuizForm quiz={quizToEdit} onClose={() => { setShowEdit(false); setQuizToEdit(null); }} onRefresh={fetchQuizzes} isAdmin={isAdmin} />}
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      <Card className="border-border">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search quizzes..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <div className="col-span-full py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : filtered.map((quiz: any) => (
          <Card key={quiz.id} className="border-border hover:shadow-md transition-all">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-heading font-semibold text-card-foreground">{quiz.title}</h3>
                    {statusBadge(quiz.isPublished ? 'published' : 'draft')}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{quiz.course?.title || 'Subject'}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {quiz.duration} min</span>
                <span>{quiz._count?.quizQuestions || 0} questions</span>
                <span>Attempts: {quiz.attemptLimit || 1}</span>
                {quiz.class?.name && <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-none">{quiz.class.name}</Badge>}
                {canManage && <span>{quiz._count?.quizAttempts || 0} submissions</span>}
              </div>

              {/* Due date / countdown row */}
              {isStudent && quiz.dueDate && <QuizDueBadge dueDate={quiz.dueDate} />}
              {canManage && quiz.dueDate && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
                  <Calendar className="w-3 h-3" />
                  Due: {new Date(quiz.dueDate).toLocaleString()}
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Created: {new Date(quiz.createdAt).toLocaleDateString()}</span>
                {isStudent && quiz.isPublished && (
                  <div className="flex items-center gap-2">
                    {quiz.quizAttempts && quiz.quizAttempts.length > 0 && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="gap-2 text-primary border-primary/20 hover:bg-primary/5 font-semibold"
                        onClick={() => reviewQuiz(quiz.quizAttempts[0].id)}
                        disabled={loadingQuiz}
                      >
                        Review Quiz
                      </Button>
                    )}
                    <Button size="sm" className="gap-2" onClick={() => {
                      if (quiz.instructions && quiz.instructions.trim()) {
                        setInstructionsQuiz(quiz);
                        setAgreedToInstructions(false);
                      } else {
                        startQuiz(quiz);
                      }
                    }}
                      disabled={(quiz.isExpired || quiz.quizAttempts?.length >= (quiz.attemptLimit || 1)) && !quiz.hasRetakeGrant}>
                      {quiz.hasRetakeGrant
                        ? <><RefreshCw className="w-3.5 h-3.5" /> Retake Quiz</>
                        : quiz.isExpired
                        ? <><Timer className="w-3.5 h-3.5" /> Closed</>
                        : quiz.quizAttempts?.length >= (quiz.attemptLimit || 1)
                        ? <><CheckCircle className="w-3.5 h-3.5" /> Completed</>
                        : <><PlayCircle className="w-3.5 h-3.5" /> Start Quiz</>}
                    </Button>
                  </div>
                )}
                {canManage && (
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" variant="outline" className="gap-1 bg-primary/5 text-primary hover:bg-primary/20 hover:text-primary border-primary/20 font-semibold" onClick={() => exportQuizToPDF(quiz.id)}>
                      <FileText className="w-3 h-3" /> PDF
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1 bg-success/5 text-success hover:bg-success/20 hover:text-success border-success/20 font-semibold" onClick={() => exportQuizToCSV(quiz.id)}>
                      <FileSpreadsheet className="w-3 h-3" /> CSV
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1 font-semibold hover:bg-muted/50" onClick={() => handleEditClick(quiz)} disabled={loadingQuiz}>
                      {loadingQuiz ? <Loader2 className="w-3 h-3 animate-spin" /> : <Edit className="w-3 h-3" />} Edit
                    </Button>
                    <Button size="sm" variant="outline"
                      className="gap-1 font-semibold text-amber-600 border-amber-400/30 hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:text-amber-700"
                      onClick={() => openGrantRetake(quiz)}>
                      <RefreshCw className="w-3 h-3" /> Grant Retake
                    </Button>
                    <Button size="sm" variant="ghost" className="gap-1 text-destructive hover:text-destructive hover:bg-destructive/20 font-semibold" onClick={() => deleteQuiz(quiz.id)}>
                      <Trash2 className="w-3 h-3" /> Delete
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {!loading && filtered.length === 0 && (
        <Card className="border-border"><CardContent className="p-8 text-center text-muted-foreground">No quizzes found</CardContent></Card>
      )}
      {/* Student Quiz Instructions Pop-up Modal */}
      <Dialog open={!!instructionsQuiz} onOpenChange={(open) => { if (!open) setInstructionsQuiz(null); }}>
        <DialogContent className="max-w-md border-border bg-card rounded-2xl shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg font-bold flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-primary" />
              Quiz Instructions
            </DialogTitle>
          </DialogHeader>
          
          <div className="my-4 space-y-4">
            <div className="bg-muted/30 border border-border p-4 rounded-xl max-h-[30vh] overflow-y-auto">
              <h4 className="font-bold text-sm mb-1">{instructionsQuiz?.title}</h4>
              <p className="text-xs text-muted-foreground mb-3">
                Duration: {instructionsQuiz?.duration} minutes • {instructionsQuiz?.attemptLimit || 1} Attempt(s) allowed
              </p>
              <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                {instructionsQuiz?.instructions}
              </div>
            </div>
            
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-primary/5 border border-primary/10">
              <input 
                type="checkbox" 
                id="agree-checkbox" 
                checked={agreedToInstructions} 
                onChange={(e) => setAgreedToInstructions(e.target.checked)} 
                className="mt-1 rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer"
              />
              <Label htmlFor="agree-checkbox" className="text-xs text-foreground/80 leading-normal cursor-pointer select-none">
                I have read and understood the instructions, rules, and conditions for this quiz. I agree to proceed.
              </Label>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setInstructionsQuiz(null)} className="flex-1 font-bold">
              Cancel
            </Button>
            <Button 
              disabled={!agreedToInstructions} 
              onClick={() => {
                const quizToStart = instructionsQuiz;
                setInstructionsQuiz(null);
                startQuiz(quizToStart);
              }}
              className="flex-1 font-bold gap-1"
            >
              <PlayCircle className="w-4 h-4" /> Start Attempt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Teacher — Grant Retake Dialog */}
      <Dialog open={!!grantRetakeQuiz} onOpenChange={(open) => { if (!open) { setGrantRetakeQuiz(null); setGrantStudentId(''); setGrantClassId(''); }}}>
        <DialogContent className="max-w-lg border-border bg-card rounded-2xl shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg font-bold flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-amber-500" />
              Grant Retake — {grantRetakeQuiz?.title}
            </DialogTitle>
          </DialogHeader>

          <div className="my-4 space-y-5">
            {/* Target type toggle */}
            <div className="flex gap-2">
              <button
                onClick={() => { setGrantTarget('student'); setGrantClassId(''); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold border transition-all ${
                  grantTarget === 'student'
                    ? 'bg-amber-500 text-white border-amber-500 shadow-md'
                    : 'bg-muted/30 border-border text-muted-foreground hover:bg-muted/60'
                }`}
              >
                <UserCheck className="w-4 h-4" /> Individual Student
              </button>
              <button
                onClick={() => { setGrantTarget('class'); setGrantStudentId(''); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold border transition-all ${
                  grantTarget === 'class'
                    ? 'bg-amber-500 text-white border-amber-500 shadow-md'
                    : 'bg-muted/30 border-border text-muted-foreground hover:bg-muted/60'
                }`}
              >
                <Users className="w-4 h-4" /> Entire Class
              </button>
            </div>

            {/* Student picker */}
            {grantTarget === 'student' && (
              <div className="space-y-2">
                <Label>Select Student</Label>
                <Select value={grantStudentId} onValueChange={setGrantStudentId}>
                  <SelectTrigger><SelectValue placeholder="Select student..." /></SelectTrigger>
                  <SelectContent>
                    {grantStudents.map((s: any) => (
                      <SelectItem key={s.id} value={s.id.toString()}>{s.user?.name} — {s.user?.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Class picker */}
            {grantTarget === 'class' && (
              <div className="space-y-2">
                <Label>Select Class</Label>
                <Select value={grantClassId} onValueChange={setGrantClassId}>
                  <SelectTrigger><SelectValue placeholder="Select class..." /></SelectTrigger>
                  <SelectContent>
                    {grantClasses.map((c: any) => (
                      <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Active grants list */}
            {existingGrants.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Active Grants</Label>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {existingGrants.map((g: any) => (
                    <div key={g.id} className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40">
                      <div className="flex items-center gap-2">
                        {g.targetType === 'student'
                          ? <UserCheck className="w-3.5 h-3.5 text-amber-600" />
                          : <Users className="w-3.5 h-3.5 text-amber-600" />}
                        <span className="text-xs font-semibold text-amber-800 dark:text-amber-200">{g.targetName}</span>
                      </div>
                      <button
                        onClick={() => revokeGrant(grantRetakeQuiz.id, g.id)}
                        className="text-destructive hover:bg-destructive/10 rounded-full p-0.5 transition-colors"
                        title="Revoke grant"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {existingGrants.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-1">No active retake grants for this quiz.</p>
            )}
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setGrantRetakeQuiz(null)} className="flex-1 font-bold">Cancel</Button>
            <Button
              disabled={grantLoading || (grantTarget === 'student' ? !grantStudentId : !grantClassId)}
              onClick={submitGrant}
              className="flex-1 font-bold gap-1 bg-amber-500 hover:bg-amber-600 text-white border-amber-500"
            >
              {grantLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Grant Retake
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── MCQ QUESTION BUILDER COMPONENT ───────────────────────
function MCQQuestionBuilder({ questions, setQuestions }: { questions: any[]; setQuestions: (q: any[]) => void }) {
  const addQuestion = () => {
    setQuestions([...questions, {
      questionText: '',
      points: 1,
      options: LABELS.map(label => ({ optionLabel: label, optionText: '', isCorrect: false }))
    }]);
  };

  const removeQuestion = (idx: number) => {
    setQuestions(questions.filter((_, i) => i !== idx));
  };

  const updateQuestion = (idx: number, field: string, value: any) => {
    const updated = [...questions];
    updated[idx] = { ...updated[idx], [field]: value };
    setQuestions(updated);
  };

  const updateOption = (qIdx: number, oIdx: number, field: string, value: any) => {
    const updated = [...questions];
    if (field === 'isCorrect') {
      // Only one correct answer allowed
      updated[qIdx].options = updated[qIdx].options.map((o: any, i: number) => ({
        ...o, isCorrect: i === oIdx
      }));
    } else {
      updated[qIdx].options[oIdx] = { ...updated[qIdx].options[oIdx], [field]: value };
    }
    setQuestions(updated);
  };

  const handleCSVImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
        if (lines.length < 2) return toast.error('CSV file is empty or invalid header.');

        // Simple CSV parser that respects quotes
        const parseLine = (line: string) => {
          const result = [];
          let current = '';
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
              if (inQuotes && line[i+1] === '"') {
                current += '"';
                i++;
              } else {
                inQuotes = !inQuotes;
              }
            } else if (char === ',' && !inQuotes) {
              result.push(current);
              current = '';
            } else {
              current += char;
            }
          }
          result.push(current);
          return result;
        };

        const headers = parseLine(lines[0]).map(h => h.trim());
        const newQuestions: any[] = [];

        for (let i = 1; i < lines.length; i++) {
          const values = parseLine(lines[i]);
          if (values.length < 5) continue; // Basic check

          const row: any = {};
          headers.forEach((h, idx) => {
            if (values[idx] !== undefined) row[h] = values[idx];
          });

          const questionText = row['Question Text'] || row['questionText'];
          const points = parseInt(row['Points'] || row['points'] || '1');

          if (!questionText) continue;

          const options: any[] = [];
          ['A', 'B', 'C', 'D'].forEach(label => {
            const optText = row[`Option ${label}`] || row[`option${label}`];
            const isCorrectText = (row[`${label} Correct`] || row[`${label}Correct`] || row[`isCorrect${label}`] || '').toUpperCase();
            if (optText) {
              options.push({
                optionLabel: label,
                optionText: optText,
                isCorrect: isCorrectText === 'YES' || isCorrectText === 'TRUE' || isCorrectText === '1'
              });
            }
          });

          if (options.length > 0) {
            newQuestions.push({ questionText, points, options });
          }
        }

        if (newQuestions.length > 0) {
          setQuestions([...questions, ...newQuestions]);
          toast.success(`Successfully imported ${newQuestions.length} questions!`);
        } else {
          toast.error('No valid questions found in CSV.');
        }
      } catch (err) {
        console.error(err);
        toast.error('Failed to parse CSV file.');
      }
    };
    reader.readAsText(file);
  };

  const [autoGrade, setAutoGrade] = useState(true);

  return (
    <div className="space-y-4">
      {/* Header row: title + Add Question */}
      <div className="flex items-center justify-between gap-2">
        <Label className="text-base font-semibold">Questions ({questions.length})</Label>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={addQuestion} className="gap-1">
            <Plus className="w-3 h-3" /> Add Question
          </Button>
        </div>
      </div>

      {/* CSV row: Import + Download Template below */}
      <div className="flex flex-col gap-1">
        <div className="relative w-full">
          <input
            type="file"
            accept=".csv,text/csv,application/vnd.ms-excel"
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleCSVImport(file);
              e.target.value = '';
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1 w-full text-success border-success/30 hover:bg-success/5"
          >
            <Upload className="w-3 h-3" /> Bulk Import via CSV
          </Button>
        </div>
        <button
          type="button"
          onClick={downloadCSVTemplate}
          className="text-xs text-primary/70 hover:text-primary underline underline-offset-2 text-center transition-colors"
        >
          <Download className="w-3 h-3 inline mr-1" />Download CSV Template
        </button>
      </div>

      {/* Auto-grade / Manual marks toggle */}
      <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/20">
        <div>
          <p className="text-sm font-medium">Marks per question</p>
          <p className="text-xs text-muted-foreground">
            {autoGrade ? 'System auto-assigns 1 mark per question' : 'Set marks individually on each question'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAutoGrade(p => !p)}
          className={cn(
            'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none border',
            autoGrade ? 'bg-primary border-primary' : 'bg-muted border-border'
          )}
          aria-label="Toggle auto grade"
        >
          <span
            className={cn(
              'inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform',
              autoGrade ? 'translate-x-6' : 'translate-x-1'
            )}
          />
        </button>
      </div>

      {questions.map((q, qi) => (
        <Card key={qi} className="border-border bg-muted/30">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-primary">Question {qi + 1}</span>
              <div className="flex items-center gap-2">
                {!autoGrade && (
                  <div className="flex items-center gap-1">
                    <Label className="text-xs text-muted-foreground whitespace-nowrap">Marks:</Label>
                    <Input
                      type="number"
                      min="1"
                      value={q.points ?? 1}
                      onChange={e => updateQuestion(qi, 'points', parseInt(e.target.value) || 1)}
                      className="w-16 h-7 text-xs text-center"
                    />
                  </div>
                )}
                {autoGrade && (
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">1 mark</span>
                )}
                <Button type="button" size="sm" variant="ghost" className="text-destructive h-7 px-2" onClick={() => removeQuestion(qi)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>

            <Input
              placeholder="Enter question text..."
              value={q.questionText}
              onChange={e => updateQuestion(qi, 'questionText', e.target.value)}
              required
            />

            <div className="space-y-2">
              {q.options.map((opt: any, oi: number) => (
                <div key={oi} className="flex items-center gap-2">
                  <button
                    type="button"
                    className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all shrink-0',
                      opt.isCorrect
                        ? 'border-success bg-success text-white'
                        : 'border-border bg-background text-muted-foreground hover:border-success/50'
                    )}
                    onClick={() => updateOption(qi, oi, 'isCorrect', true)}
                    title={opt.isCorrect ? 'Correct answer' : 'Click to mark as correct'}
                  >
                    {opt.optionLabel}
                  </button>
                  <Input
                    placeholder={`Option ${opt.optionLabel}...`}
                    value={opt.optionText}
                    onChange={e => updateOption(qi, oi, 'optionText', e.target.value)}
                    className="flex-1"
                    required
                  />
                  {opt.isCorrect && <CheckCircle className="w-4 h-4 text-success shrink-0" />}
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Click a letter circle to mark the correct answer</p>
          </CardContent>
        </Card>
      ))}

      {questions.length === 0 && (
        <Card className="border-dashed border-2 border-border">
          <CardContent className="p-6 text-center text-muted-foreground">
            <p>No questions added yet. Click "Add Question" to create your first MCQ question.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── CREATE QUIZ FORM ─────────────────────────────────────
function CreateQuizForm({ onClose, onRefresh, isAdmin }: { onClose: () => void; onRefresh: () => void; isAdmin: boolean }) {
  const [form, setForm] = useState({ title: '', timeLimit: '30', attemptLimit: '1', courseId: '', dueDate: '', instructions: '' });
  const [classIds, setClassIds] = useState<string[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [availableClasses, setAvailableClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const endpoint = isAdmin ? '/api/admin/courses' : '/api/teacher/my-courses';
    api.get(endpoint).then(res => setCourses(Array.isArray(res) ? res : res.courses || [])).catch(() => {});
  }, [isAdmin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.courseId) { toast.error('Please select a subject'); return; }
    if (classIds.length === 0) { toast.error('Please select at least one class'); return; }

    // Validate questions
    if (questions.length === 0) { toast.error('Add at least 1 question'); return; }
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.questionText.trim()) { toast.error(`Question ${i + 1}: Enter question text`); return; }
      if (q.options.some((o: any) => !o.optionText.trim())) { toast.error(`Question ${i + 1}: Fill all 4 options`); return; }
      if (!q.options.some((o: any) => o.isCorrect)) { toast.error(`Question ${i + 1}: Select the correct answer`); return; }
    }

    try {
      setLoading(true);
      const endpoint = isAdmin ? '/api/admin/quizzes' : '/api/teacher/quizzes';
      await api.post(endpoint, {
        ...form,
        classIds,
        timeLimit: parseInt(form.timeLimit),
        attemptLimit: parseInt(form.attemptLimit),
        dueDate: form.dueDate || null,
        questions,
      });
      toast.success('Quiz created successfully!');
      onRefresh();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create quiz');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-2">
      <div className="space-y-2"><Label>Title</Label><Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} required /></div>
      <div className="space-y-2">
        <Label>Instructions (Optional)</Label>
        <Textarea 
          placeholder="Enter instructions students must agree to before starting the quiz..." 
          value={form.instructions} 
          onChange={e => setForm(p => ({ ...p, instructions: e.target.value }))}
          className="min-h-[80px]"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-2">
          <Label>Subject</Label>
          <Select value={form.courseId} onValueChange={v => {
            setForm(p => ({ ...p, courseId: v }));
            setClassIds([]);
            const course = courses.find((c: any) => c.id.toString() === v);
            setAvailableClasses(course?.courseClasses?.map((cc: any) => cc.class) || []);
          }}>
            <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
            <SelectContent>
              {courses.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {availableClasses.length > 0 && (
          <div className="col-span-2 space-y-2">
            <Label>Target Classes</Label>
            <div className="grid grid-cols-2 gap-2 p-3 border rounded-xl bg-muted/30">
              {availableClasses.map(cls => (
                 <div key={cls.id} className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      id={`create-quiz-cls-${cls.id}`}
                      checked={classIds.includes(cls.id.toString())}
                      onChange={(e) => {
                        const ids = e.target.checked 
                          ? [...classIds, cls.id.toString()]
                          : classIds.filter(id => id !== cls.id.toString());
                        setClassIds(ids);
                      }}
                      className="rounded border-border text-primary h-4 w-4"
                    />
                    <Label htmlFor={`create-quiz-cls-${cls.id}`} className="text-sm font-normal cursor-pointer">{cls.name}</Label>
                 </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2"><Label>Duration (min)</Label><Input type="number" min="1" value={form.timeLimit} onChange={e => setForm(p => ({ ...p, timeLimit: e.target.value }))} required /></div>
        <div className="space-y-2"><Label>Attempt Limit</Label><Input type="number" min="1" value={form.attemptLimit} onChange={e => setForm(p => ({ ...p, attemptLimit: e.target.value }))} required /></div>
        <div className="space-y-2">
          <Label>Due Date (Optional)</Label>
          <Input 
            type="datetime-local" 
            value={form.dueDate} 
            onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))} 
          />
        </div>
      </div>

      <hr className="border-border" />

      <MCQQuestionBuilder questions={questions} setQuestions={setQuestions} />

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Quiz'}
        </Button>
      </div>
    </form>
  );
}

// ─── EDIT QUIZ FORM ───────────────────────────────────────
function EditQuizForm({ quiz, onClose, onRefresh, isAdmin }: { quiz: any; onClose: () => void; onRefresh: () => void; isAdmin: boolean }) {
  const [form, setForm] = useState({
    title: quiz.title || '',
    timeLimit: quiz.duration?.toString() || '30',
    attemptLimit: quiz.attemptLimit?.toString() || '1',
    courseId: quiz.courseId?.toString() || '',
    isPublished: quiz.isPublished || false,
    dueDate: quiz.dueDate ? new Date(quiz.dueDate).toISOString().substring(0, 16) : '',
    instructions: quiz.instructions || '',
  });

  const [classIds, setClassIds] = useState<string[]>(
    quiz.quizClasses?.map((qc: any) => qc.classId.toString()) || []
  );

  const existingQuestions = (quiz.quizQuestions || []).map((q: any) => ({
    questionText: q.questionText,
    points: q.points || 1,
    options: (q.options || []).map((o: any) => ({
      optionLabel: o.optionLabel,
      optionText: o.optionText,
      isCorrect: o.isCorrect,
    })),
  }));

  const [questions, setQuestions] = useState<any[]>(existingQuestions);
  const [courses, setCourses] = useState<any[]>([]);
  const [availableClasses, setAvailableClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const initialCourseId = useRef(quiz.courseId?.toString() || '');

  useEffect(() => {
    const endpoint = isAdmin ? '/api/admin/courses' : '/api/teacher/my-courses';
    api.get(endpoint).then(res => {
      const fetchedCourses = Array.isArray(res) ? res : res.courses || [];
      setCourses(fetchedCourses);
      
      if (initialCourseId.current) {
        const course = fetchedCourses.find((c: any) => c.id.toString() === initialCourseId.current);
        setAvailableClasses(course?.courseClasses?.map((cc: any) => cc.class) || []);
      }
    }).catch(() => {});
  }, [isAdmin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (classIds.length === 0) { toast.error('Please select at least one class'); return; }

    // Validate questions
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.questionText.trim()) { toast.error(`Question ${i + 1}: Enter question text`); return; }
      if (q.options.some((o: any) => !o.optionText.trim())) { toast.error(`Question ${i + 1}: Fill all 4 options`); return; }
      if (!q.options.some((o: any) => o.isCorrect)) { toast.error(`Question ${i + 1}: Select the correct answer`); return; }
    }

    try {
      setLoading(true);
      const endpoint = isAdmin ? `/api/admin/quizzes/${quiz.id}` : `/api/teacher/quizzes/${quiz.id}`;
      await api.put(endpoint, {
        title: form.title,
        instructions: form.instructions || null,
        timeLimit: parseInt(form.timeLimit),
        attemptLimit: parseInt(form.attemptLimit),
        isPublished: form.isPublished,
        dueDate: form.dueDate || null,
        classIds,
        questions,
      });
      toast.success('Quiz updated successfully!');
      onRefresh();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update quiz');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 py-2">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold font-heading">Edit: {quiz.title}</h2>
          <p className="text-sm text-muted-foreground">ID: {quiz.id} • {questions.length} Questions</p>
        </div>
        <div className="flex flex-col gap-1 min-w-[160px]">
          <div className="relative w-full">
            <input 
              type="file" 
              accept=".csv,text/csv,application/vnd.ms-excel" 
              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                   const event = new CustomEvent('importQuizCSV', { detail: { quizId: quiz.id, file } });
                   window.dispatchEvent(event);
                }
                e.target.value = '';
              }}
            />
            <Button 
              variant="outline" 
              type="button"
              className="gap-2 border-success/50 text-success hover:bg-success/10 w-full"
            >
              <Upload className="w-4 h-4" /> Bulk Import (CSV)
            </Button>
          </div>
          <button
            type="button"
            onClick={downloadCSVTemplate}
            className="text-xs text-primary/70 hover:text-primary underline underline-offset-2 text-center transition-colors"
          >
            <Download className="w-3 h-3 inline mr-1" />Download CSV Template
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2"><Label>Title</Label><Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} required /></div>
      <div className="space-y-2">
        <Label>Instructions (Optional)</Label>
        <Textarea 
          placeholder="Enter instructions students must agree to before starting the quiz..." 
          value={form.instructions} 
          onChange={e => setForm(p => ({ ...p, instructions: e.target.value }))}
          className="min-h-[80px]"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-2">
          <Label>Subject</Label>
          <Select value={form.courseId} disabled={true}>
            <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
            <SelectContent>
              {courses.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {availableClasses.length > 0 && (
          <div className="col-span-2 space-y-2">
            <Label>Target Classes</Label>
            <div className="grid grid-cols-2 gap-2 p-3 border rounded-xl bg-muted/30">
              {availableClasses.map(cls => (
                 <div key={cls.id} className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      id={`edit-quiz-cls-${cls.id}`}
                      checked={classIds.includes(cls.id.toString())}
                      onChange={(e) => {
                        const ids = e.target.checked 
                          ? [...classIds, cls.id.toString()]
                          : classIds.filter(id => id !== cls.id.toString());
                        setClassIds(ids);
                      }}
                      className="rounded border-border text-primary h-4 w-4"
                    />
                    <Label htmlFor={`edit-quiz-cls-${cls.id}`} className="text-sm font-normal cursor-pointer">{cls.name}</Label>
                 </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="grid grid-cols-4 gap-3">
        <div className="space-y-2"><Label>Duration (min)</Label><Input type="number" min="1" value={form.timeLimit} onChange={e => setForm(p => ({ ...p, timeLimit: e.target.value }))} required /></div>
        <div className="space-y-2"><Label>Attempt Limit</Label><Input type="number" min="1" value={form.attemptLimit} onChange={e => setForm(p => ({ ...p, attemptLimit: e.target.value }))} required /></div>
        <div className="space-y-2">
          <Label>Publish?</Label>
          <Select value={form.isPublished ? 'true' : 'false'} onValueChange={v => setForm(p => ({ ...p, isPublished: v === 'true' }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="false">Draft</SelectItem>
              <SelectItem value="true">Published</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Due Date</Label>
            {form.dueDate && (
              <button 
                type="button" 
                onClick={() => setForm(p => ({ ...p, dueDate: '' }))}
                className="text-[10px] text-destructive hover:underline"
              >
                Clear
              </button>
            )}
          </div>
          <Input 
            type="datetime-local" 
            value={form.dueDate} 
            onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))} 
            className="text-xs h-9"
          />
        </div>
      </div>

      <hr className="border-border" />

      <MCQQuestionBuilder questions={questions} setQuestions={setQuestions} />

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
        </Button>
      </div>
    </form>
  </div>
  );
}
