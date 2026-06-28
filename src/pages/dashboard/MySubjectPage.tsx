import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  BookOpen, Users, Award, FileText, Plus,
  Trash2, Upload, ChevronRight,
  Clock, Download, Loader2, FolderOpen,
  Mail, Eye, Book, Pencil
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { jsPDF } from 'jspdf';
import MaterialViewer from '@/components/dashboard/MaterialViewer';
import EditMaterialModal from '@/components/dashboard/EditMaterialModal';

const API_BASE = import.meta.env.VITE_API_URL || '';

export default function MySubjectPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [courseDetails, setCourseDetails] = useState<any>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'modules' | 'assignments' | 'quizzes' | 'notes' | 'roster'>('modules');

  // Modals state
  const [isModuleModalOpen, setIsModuleModalOpen] = useState(false);
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
  const [viewerMaterial, setViewerMaterial] = useState<any | null>(null);
  const [editMaterial, setEditMaterial] = useState<any | null>(null);

  // Forms state
  const [moduleForm, setModuleForm] = useState({ title: '', description: '', orderIndex: '0' });
  const [materialForm, setMaterialForm] = useState({ title: '', type: 'PDF', externalUrl: '', topicId: '', textContent: '', description: '' });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    fetchCourses();
  }, [user]);

  useEffect(() => {
    if (selectedCourseId) {
      fetchCourseDetails(selectedCourseId);
      fetchNotes();
    }
  }, [selectedCourseId]);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/teacher/my-courses');
      const courseList = Array.isArray(res) ? res : res.courses || [];
      setCourses(courseList);
      if (courseList.length > 0) {
        setSelectedCourseId(courseList[0].id);
      } else {
        setLoading(false);
      }
    } catch (err: any) {
      console.error('Fetch courses error:', err);
      toast({
        title: 'Error',
        description: 'Failed to load courses assigned to you.',
        variant: 'destructive',
      });
      setLoading(false);
    }
  };

  const fetchCourseDetails = async (courseId: number) => {
    try {
      setLoading(true);
      const res = await api.get(`/api/teacher/courses/${courseId}`);
      setCourseDetails(res);
    } catch (err: any) {
      console.error('Fetch course details error:', err);
      toast({
        title: 'Error',
        description: 'Failed to load course command center data.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchNotes = async () => {
    try {
      const res = await api.get('/api/notes');
      setNotes(Array.isArray(res) ? res : []);
    } catch (err: any) {
      console.error('Fetch notes error:', err);
    }
  };

  // Helper to extract unique students from classes associated with course
  const getStudentsRoster = () => {
    if (!courseDetails?.courseClasses) return [];
    const rosterMap = new Map();
    courseDetails.courseClasses.forEach((cc: any) => {
      const className = cc.class?.name || 'Assigned Class';
      if (cc.class?.students) {
        cc.class.students.forEach((student: any) => {
          if (student.user) {
            rosterMap.set(student.user.id, {
              id: student.id,
              userId: student.user.id,
              name: student.user.name,
              email: student.user.email,
              className: className
            });
          }
        });
      }
    });
    return Array.from(rosterMap.values());
  };

  // Create Module
  const handleCreateModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseId || !moduleForm.title.trim()) return;

    try {
      setActionLoading(true);
      await api.post('/api/teacher/topics', {
        courseId: selectedCourseId,
        title: moduleForm.title,
        description: moduleForm.description,
        orderIndex: parseInt(moduleForm.orderIndex) || 0
      });
      toast({
        title: 'Success',
        description: `Successfully added module "${moduleForm.title}".`,
      });
      setIsModuleModalOpen(false);
      setModuleForm({ title: '', description: '', orderIndex: '0' });
      fetchCourseDetails(selectedCourseId);
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to create module.',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Upload Material
  const handleUploadMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!materialForm.topicId) {
      toast({ title: 'Validation Error', description: 'Please select a module first.', variant: 'destructive' });
      return;
    }
    if (!materialForm.title.trim()) {
      toast({ title: 'Validation Error', description: 'Title is required.', variant: 'destructive' });
      return;
    }

    try {
      setActionLoading(true);
      const formData = new FormData();
      formData.append('title', materialForm.title);
      formData.append('type', materialForm.type);
      formData.append('topicId', materialForm.topicId);
      formData.append('isGlobal', 'false');
      if (materialForm.description) formData.append('description', materialForm.description);
      if (materialForm.textContent) formData.append('textContent', materialForm.textContent);
      if (selectedFile) formData.append('material', selectedFile);
      if (materialForm.externalUrl) formData.append('externalUrl', materialForm.externalUrl);

      await api.upload('/api/teacher/materials', formData);
      toast({
        title: 'Success',
        description: `Resource "${materialForm.title}" uploaded successfully.`,
      });
      setIsMaterialModalOpen(false);
      setMaterialForm({ title: '', type: 'PDF', externalUrl: '', topicId: '', textContent: '', description: '' });
      setSelectedFile(null);
      if (selectedCourseId) fetchCourseDetails(selectedCourseId);
    } catch (err: any) {
      toast({
        title: 'Upload Failed',
        description: err.message || 'Failed to publish learning material.',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Module/Topic
  const handleDeleteModule = async (topicId: number) => {
    if (!confirm('Are you sure you want to delete this module and all its materials permanently?')) return;
    try {
      await api.delete(`/api/teacher/topics/${topicId}`);
      toast({ title: 'Deleted', description: 'Module removed successfully.' });
      if (selectedCourseId) fetchCourseDetails(selectedCourseId);
    } catch (err: any) {
      toast({ title: 'Error', description: 'Failed to delete module.', variant: 'destructive' });
    }
  };

  // Delete Material
  const handleDeleteMaterial = async (materialId: number) => {
    if (!confirm('Are you sure you want to remove this learning material?')) return;
    try {
      await api.delete(`/api/teacher/materials/${materialId}`);
      toast({ title: 'Deleted', description: 'Material removed from curriculum.' });
      if (selectedCourseId) fetchCourseDetails(selectedCourseId);
    } catch (err: any) {
      toast({ title: 'Error', description: 'Failed to delete material.', variant: 'destructive' });
    }
  };

  const handleDownload = async (resource: any) => {
    const url = resource.fileUrl || resource.externalUrl || resource.filePath || '';

    // TEXT type → generate PDF via jsPDF
    if (!url || url === 'text-content' || resource.type === 'TEXT') {
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const name = resource.title || resource.fileName || 'Study Notes';
      const content = resource.textContent || '';
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(name, 40, 50);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(content, 515);
      doc.text(lines, 40, 80);
      doc.save(`${name}.pdf`);
      return;
    }

    const isExternal = url.startsWith('http');
    const fullUrl = isExternal ? url : `${API_BASE}/${url}`;
    try {
      const response = await fetch(fullUrl, {
        headers: { Authorization: `Bearer ${localStorage.getItem('onereal_token')}` },
      });
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = resource.fileName || resource.title || 'resource';
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      window.open(fullUrl, '_blank');
    }
  };

  if (loading && !courseDetails) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
        <p className="text-muted-foreground font-semibold animate-pulse">Initializing Course Command Center...</p>
      </div>
    );
  }

  const students = getStudentsRoster();
  const activeCourse = courses.find(c => c.id === selectedCourseId);
  const courseNotes = notes.filter(note => note.courseId === selectedCourseId && note.isShared);

  return (
    <div className="space-y-6">
      {/* Dynamic Course Header & Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <BookOpen className="w-6 h-6" />
            </span>
            <h1 className="text-3xl font-heading font-bold text-foreground">My Subject</h1>
          </div>
          <p className="text-muted-foreground">
            Centralized commander dashboard to upload syllabi, organize modules, review worksheets, and monitor rosters.
          </p>
        </div>

        {/* Dropdown Selector */}
        {courses.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted-foreground uppercase shrink-0">Switch Subject:</span>
            <select
              value={selectedCourseId || ''}
              onChange={(e) => setSelectedCourseId(Number(e.target.value))}
              className="bg-card border border-border px-3 py-2.5 rounded-xl text-sm font-semibold hover:bg-muted/50 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 min-w-[200px]"
            >
              {courses.map(course => (
                <option key={course.id} value={course.id}>{course.title}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {courses.length === 0 ? (
        <Card className="border-border">
          <CardContent className="p-12 text-center">
            <BookOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground/35" />
            <h3 className="text-lg font-bold text-foreground">No assigned courses</h3>
            <p className="text-muted-foreground max-w-sm mx-auto mt-2 text-sm leading-relaxed">
              You are currently not registered as an instructor for any active courses. Please contact the administrator to assign subjects.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Neon-themed Subject Card Banner */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative rounded-3xl border border-primary/20 overflow-hidden shadow-2xl p-6 md:p-8 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent"
          >
            <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial-gradient from-primary/10 via-transparent to-transparent pointer-events-none" />
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge className="bg-primary/20 text-primary border-none font-bold uppercase tracking-wider text-[10px] px-2.5 py-1">
                    {courseDetails?.subject?.name || 'Classroom Course'}
                  </Badge>
                  {courseDetails?.courseClasses?.map((cc: any) => (
                    <Badge key={cc.id} variant="secondary" className="font-bold text-xs">
                      🏠 Class: {cc.class?.name}
                    </Badge>
                  ))}
                </div>
                <h2 className="text-3xl font-extrabold tracking-tight text-foreground">{courseDetails?.title}</h2>
                <p className="text-muted-foreground text-sm max-w-2xl leading-relaxed">
                  {courseDetails?.description || 'No course overview provided yet. Set course expectations and description by updating materials or topic structures.'}
                </p>
              </div>

              <div className="flex flex-wrap gap-2 shrink-0">
                <Button onClick={() => setIsModuleModalOpen(true)} size="sm" variant="outline" className="font-bold gap-1.5 border-border hover:bg-muted bg-background/50">
                  <Plus className="w-4 h-4" /> Add Module
                </Button>
                <Button onClick={() => {
                  if (courseDetails?.topics?.length === 0) {
                    toast({ title: 'Curriculum Empty', description: 'Create at least one module first before adding resources.', variant: 'default' });
                    return;
                  }
                  setMaterialForm(prev => ({ ...prev, topicId: courseDetails.topics[0].id.toString() }));
                  setIsMaterialModalOpen(true);
                }} size="sm" className="font-bold gap-1.5 shadow-lg shadow-primary/10">
                  <Upload className="w-4 h-4" /> Publish Material
                </Button>
              </div>
            </div>
          </motion.div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Enrolled Students', val: students.length, desc: 'Active scholars', icon: Users, color: 'text-sky-500' },
              { label: 'Lesson Modules', val: courseDetails?.topics?.length || 0, desc: 'Topic containers', icon: BookOpen, color: 'text-violet-500' },
              { label: 'Materials Uploaded', val: courseDetails?.topics?.reduce((acc: number, t: any) => acc + (t.materials?.length || 0), 0) || 0, desc: 'Shared learning slides', icon: FolderOpen, color: 'text-emerald-500' },
              { label: 'Quizzes Active', val: courseDetails?.quizzes?.length || 0, desc: 'Assessments', icon: Award, color: 'text-amber-500' },
              { label: 'Worksheets', val: courseDetails?.assignments?.length || 0, desc: 'Assigned papers', icon: FileText, color: 'text-rose-500' },
            ].map(m => (
              <Card key={m.label} className="border-border/60 hover:border-primary/20 transition-all shadow-sm">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={cn("p-2 rounded-xl bg-muted shrink-0", m.color.replace('text-', 'bg-').replace('500', '500/10'), m.color)}>
                    <m.icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">{m.label}</span>
                    <span className="text-xl font-extrabold text-foreground block mt-0.5">{m.val}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Commander Navigation Tabs */}
          <div className="flex border-b border-border/50 gap-2 overflow-x-auto pb-0.5">
            {[
              { id: 'modules', label: '📁 Lesson Modules', count: courseDetails?.topics?.length || 0 },
              { id: 'assignments', label: '📝 Assignments', count: courseDetails?.assignments?.length || 0 },
              { id: 'quizzes', label: '📋 Quizzes & Tests', count: courseDetails?.quizzes?.length || 0 },
              { id: 'notes', label: '📓 Shared Notebooks', count: courseNotes.length },
              { id: 'roster', label: '👥 Student Directory', count: students.length },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={cn(
                  "px-4 py-3 text-sm font-bold border-b-2 whitespace-nowrap transition-all flex items-center gap-2",
                  activeTab === t.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border/60"
                )}
              >
                {t.label}
                <Badge variant="secondary" className={cn("text-[10px] font-extrabold px-1.5 py-0", activeTab === t.id ? "bg-primary/10 text-primary" : "")}>
                  {t.count}
                </Badge>
              </button>
            ))}
          </div>

          {/* TAB CONTENTS */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.15 }}
            >
              {/* TAB 1: MODULES */}
              {activeTab === 'modules' && (
                <div className="space-y-6">
                  {courseDetails?.topics?.length === 0 ? (
                    <Card className="border-border bg-card/50">
                      <CardContent className="p-12 text-center">
                        <FolderOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30 animate-pulse" />
                        <h3 className="text-lg font-bold text-foreground">No syllabus modules published</h3>
                        <p className="text-muted-foreground max-w-sm mx-auto mt-2 text-sm">
                          Begin organizing your course curriculum by grouping slides, PDF handouts, and worksheets into distinct structured learning modules.
                        </p>
                        <Button onClick={() => setIsModuleModalOpen(true)} className="mt-5 font-bold shadow-lg">
                          <Plus className="w-4 h-4 mr-2" /> Add Your First Module
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-4">
                      {courseDetails.topics.map((topic: any, idx: number) => (
                        <Card key={topic.id} className="border-border hover:shadow-md transition-all">
                          <CardHeader className="pb-3 border-b border-border/40 bg-muted/15 flex flex-row items-start justify-between gap-4 p-4 rounded-t-xl">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="text-[10px] font-extrabold text-primary border-primary/20">
                                  Module {idx + 1}
                                </Badge>
                                <span className="text-[10px] font-bold text-muted-foreground">Order Index: {topic.orderIndex}</span>
                              </div>
                              <CardTitle className="text-lg font-bold text-foreground">{topic.title}</CardTitle>
                              {topic.description && (
                                <p className="text-xs text-muted-foreground mt-1 max-w-3xl italic">"{topic.description}"</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 font-bold text-xs gap-1 border-border"
                                onClick={() => {
                                  setMaterialForm(prev => ({ ...prev, topicId: topic.id.toString() }));
                                  setIsMaterialModalOpen(true);
                                }}
                              >
                                <Upload className="w-3.5 h-3.5" /> Upload File
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                onClick={() => handleDeleteModule(topic.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </CardHeader>

                          <CardContent className="p-4 pt-4">
                            {topic.materials?.length === 0 ? (
                              <p className="text-xs font-semibold text-muted-foreground/60 italic py-2 pl-2">
                                📁 No resources uploaded in this module. Click "Upload File" above to add worksheets, PDFs, or lecture video links.
                              </p>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {topic.materials.map((mat: any) => (
                                  <div key={mat.id} className="p-3 border border-border/50 rounded-xl hover:border-primary/25 transition-all flex items-center justify-between gap-4 bg-muted/5 group">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <div className="p-1.5 rounded-lg bg-primary/10 text-primary shrink-0">
                                        <FileText className="w-4 h-4" />
                                      </div>
                                      <div className="min-w-0">
                                        <h4 className="text-sm font-semibold truncate text-foreground group-hover:text-primary transition-colors">
                                          {mat.title || mat.fileName}
                                        </h4>
                                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5">
                                          <Badge variant="secondary" className="px-1 py-0 text-[8px] uppercase tracking-wider">{mat.type}</Badge>
                                          <span>•</span>
                                          <span>{new Date(mat.uploadedAt || mat.createdAt).toLocaleDateString()}</span>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-1">
                                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setViewerMaterial(mat)} title="View file">
                                        <Eye className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                                      </Button>
                                      {(user?.role === 'teacher' || user?.role === 'super_admin') && (
                                        <Button size="icon" variant="ghost" className="h-7 w-7 text-blue-500 hover:bg-blue-500/10" onClick={() => setEditMaterial(mat)} title="Edit material">
                                          <Pencil className="w-3.5 h-3.5" />
                                        </Button>
                                      )}
                                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDownload(mat)} title="Download">
                                        <Download className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                                      </Button>
                                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => handleDeleteMaterial(mat.id)} title="Remove file">
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: ASSIGNMENTS */}
              {activeTab === 'assignments' && (
                <div className="space-y-4">
                  {courseDetails?.assignments?.length === 0 ? (
                    <Card className="border-border">
                      <CardContent className="p-12 text-center">
                        <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground/35" />
                        <h3 className="text-lg font-bold text-foreground">No worksheets or assignments created</h3>
                        <p className="text-muted-foreground max-w-sm mx-auto mt-2 text-sm">
                          Publish assignments, set due deadlines, configure grades, and evaluate submission portals directly in the Assignments Command tab.
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {courseDetails.assignments.map((assignment: any) => (
                        <Card key={assignment.id} className="border-border hover:shadow-md transition-all">
                          <CardContent className="p-4 flex flex-col justify-between h-full gap-4">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <Badge className="bg-primary/20 text-primary border-none text-[9px] uppercase font-bold px-2 py-0.5">
                                  Score: {assignment.points} Points
                                </Badge>
                                <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-muted-foreground" />
                                  Due: {new Date(assignment.dueDate).toLocaleDateString()}
                                </span>
                              </div>
                              <h3 className="font-bold text-base line-clamp-1">{assignment.title}</h3>
                              {assignment.description && (
                                <p className="text-xs text-muted-foreground line-clamp-2 italic">"{assignment.description}"</p>
                              )}
                            </div>

                            <div className="pt-2 border-t border-border/50 flex items-center justify-between gap-4">
                              <div className="text-xs text-muted-foreground">
                                Submissions: <b className="text-foreground">{assignment._count?.submissions || 0} students</b>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 font-bold text-xs gap-1 border-primary/20 text-primary hover:bg-primary/5"
                                onClick={() => window.location.href = `/dashboard/gradebook`}
                              >
                                Grade Submissions
                                <ChevronRight className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: QUIZZES */}
              {activeTab === 'quizzes' && (
                <div className="space-y-4">
                  {courseDetails?.quizzes?.length === 0 ? (
                    <Card className="border-border">
                      <CardContent className="p-12 text-center">
                        <Award className="w-12 h-12 mx-auto mb-4 text-muted-foreground/35 animate-bounce" />
                        <h3 className="text-lg font-bold text-foreground">No active subject quizzes</h3>
                        <p className="text-muted-foreground max-w-sm mx-auto mt-2 text-sm">
                          Design online multiple-choice/written questions, configure automated grading engines, and generate evaluation reports.
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {courseDetails.quizzes.map((quiz: any) => (
                        <Card key={quiz.id} className="border-border hover:shadow-md transition-all">
                          <CardContent className="p-4 flex flex-col justify-between h-full gap-4">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <Badge className="bg-amber-500/10 text-amber-500 border-none text-[9px] uppercase font-bold px-2 py-0.5">
                                  {quiz._count?.quizQuestions || 0} Questions
                                </Badge>
                                <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-muted-foreground" />
                                  Duration: {quiz.duration} mins
                                </span>
                              </div>
                              <h3 className="font-bold text-base line-clamp-1">{quiz.title}</h3>
                              <p className="text-xs text-muted-foreground font-medium">
                                Enrolled Class Target: {quiz.classId ? `Class ID #${quiz.classId}` : 'All Sections'}
                              </p>
                            </div>

                            <div className="pt-2 border-t border-border/50 flex items-center justify-between gap-4">
                              <div className="text-xs text-muted-foreground">
                                Total Attempts: <b className="text-foreground">{quiz._count?.quizAttempts || 0} submitted</b>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 font-bold text-xs gap-1 border-amber-500/30 text-amber-500 hover:bg-amber-500/5"
                                onClick={() => window.location.href = `/dashboard/quizzes`}
                              >
                                View Live Results
                                <ChevronRight className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: SHARED NOTES */}
              {activeTab === 'notes' && (
                <div className="space-y-4">
                  {courseNotes.length === 0 ? (
                    <Card className="border-border">
                      <CardContent className="p-12 text-center">
                        <Book className="w-12 h-12 mx-auto mb-4 text-muted-foreground/35" />
                        <h3 className="text-lg font-bold text-foreground">No shared study binders in this subject</h3>
                        <p className="text-muted-foreground max-w-sm mx-auto mt-2 text-sm">
                          Publish beautifully stylized handwritten logs or review checklists in the notes tab. Your students will instantly sync copies to their study notebook drawers!
                        </p>
                        <Button onClick={() => window.location.href = `/dashboard/notes`} className="mt-5 font-bold shadow-lg" variant="outline">
                          Create Study Notebook Page
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {courseNotes.map((note: any) => (
                        <Card key={note.id} className="border-border hover:shadow-md transition-all relative overflow-hidden h-44 flex flex-col justify-between">
                          {/* Top Spine ribbon */}
                          <div className="absolute top-0 bottom-0 left-0 w-2.5 bg-gradient-to-r from-black/25 to-transparent z-10" style={{ backgroundColor: note.color || '#ecc94b' }} />

                          <CardHeader className="pb-2 pt-3 pl-6">
                            <div className="flex items-center justify-between">
                              <Badge className="bg-primary/20 text-primary border-none text-[8px] uppercase font-bold px-1.5 py-0.5">
                                {note.category}
                              </Badge>
                              <span className="text-[9px] text-muted-foreground">{new Date(note.updatedAt).toLocaleDateString()}</span>
                            </div>
                            <CardTitle className="text-sm font-bold truncate mt-1.5">{note.title}</CardTitle>
                          </CardHeader>

                          <CardContent className="pb-3 pt-0 pl-6 flex-1 overflow-hidden">
                            <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                              {note.content}
                            </p>
                          </CardContent>

                          <CardFooter className="py-2 pl-6 border-t border-border/30 bg-muted/10 flex justify-between items-center text-[10px]">
                            <span>Binder: <b>{note.notebook}</b></span>
                            <Button size="sm" variant="link" className="p-0 h-auto font-bold text-[10px] text-primary" onClick={() => window.location.href = `/dashboard/notes`}>
                              Open Notes Page
                            </Button>
                          </CardFooter>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: STUDENT ROSTER */}
              {activeTab === 'roster' && (
                <div className="space-y-4">
                  {students.length === 0 ? (
                    <Card className="border-border">
                      <CardContent className="p-12 text-center">
                        <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground/35 animate-pulse" />
                        <h3 className="text-lg font-bold text-foreground">No students enrolled in this course</h3>
                        <p className="text-muted-foreground max-w-sm mx-auto mt-2 text-sm leading-relaxed">
                          Students are automatically enrolled into subject directories once their assigned section classes are registered with the curriculum.
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card className="border-border shadow-sm">
                      <CardContent className="p-0 overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-muted/40 border-b border-border/50 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                <th className="px-6 py-4">Student Name</th>
                                <th className="px-6 py-4">Class Group</th>
                                <th className="px-6 py-4">Email Address</th>
                                <th className="px-6 py-4 text-right">Academic Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/40 text-sm">
                              {students.map((student: any) => (
                                <tr key={student.userId} className="hover:bg-muted/10 transition-colors">
                                  <td className="px-6 py-4 font-semibold text-foreground flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-xs">
                                      {student.name.charAt(0).toUpperCase()}
                                    </div>
                                    {student.name}
                                  </td>
                                  <td className="px-6 py-4">
                                    <Badge variant="secondary" className="font-semibold text-xs bg-muted text-muted-foreground">
                                      {student.className}
                                    </Badge>
                                  </td>
                                  <td className="px-6 py-4 text-muted-foreground font-medium">{student.email}</td>
                                  <td className="px-6 py-4 text-right">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="font-bold text-xs gap-1 text-primary hover:bg-primary/5 hover:text-primary shrink-0"
                                      onClick={() => window.open(`mailto:${student.email}`)}
                                    >
                                      <Mail className="w-3.5 h-3.5" /> Email
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {/* MODAL 1: ADD MODULE FORM */}
      <Dialog open={isModuleModalOpen} onOpenChange={setIsModuleModalOpen}>
        <DialogContent className="sm:max-w-[500px] border-border bg-card shadow-2xl rounded-2xl p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-2 bg-muted/10">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-primary" />
              Add Curriculum Module
            </DialogTitle>
            <DialogDescription>
              Create structured lesson folders to contain slides, textbooks, and interactive files.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateModule}>
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground/80 uppercase">Module Title</label>
                <Input
                  required
                  placeholder="e.g., Chapter 1: Introduction to Mechanics"
                  className="bg-muted/30 focus:bg-background border-border/60 transition-all font-semibold py-5"
                  value={moduleForm.title}
                  onChange={(e) => setModuleForm(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground/80 uppercase">Overview / Description (Optional)</label>
                <Textarea
                  placeholder="Briefly state key syllabus outcomes..."
                  className="bg-muted/30 focus:bg-background border-border/60 transition-all resize-none min-h-[90px]"
                  value={moduleForm.description}
                  onChange={(e) => setModuleForm(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground/80 uppercase">Index Order Number</label>
                <Input
                  type="number"
                  placeholder="0"
                  className="bg-muted/30 focus:bg-background border-border/60 transition-all py-5 w-32"
                  value={moduleForm.orderIndex}
                  onChange={(e) => setModuleForm(prev => ({ ...prev, orderIndex: e.target.value }))}
                />
                <p className="text-[10px] text-muted-foreground mt-0.5">Lower numbers display first in class syllabi.</p>
              </div>
            </div>

            <DialogFooter className="p-6 pt-2 border-t border-border/40 bg-muted/5">
              <Button type="button" variant="ghost" onClick={() => setIsModuleModalOpen(false)} className="font-bold">Cancel</Button>
              <Button type="submit" disabled={actionLoading} className="font-bold px-6 shadow-lg">
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Module'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: UPLOAD MATERIAL FORM */}
      <Dialog open={isMaterialModalOpen} onOpenChange={setIsMaterialModalOpen}>
        <DialogContent className="sm:max-w-[550px] border-border bg-card shadow-2xl rounded-2xl p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-2 bg-muted/10">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary" />
              Publish Learning Material
            </DialogTitle>
            <DialogDescription>
              Upload educational presentations, study sheets, text summaries, or lecture video links.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUploadMaterial}>
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto scrollbar-thin">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground/80 uppercase">Target Module</label>
                  <select
                    required
                    value={materialForm.topicId}
                    onChange={(e) => setMaterialForm(prev => ({ ...prev, topicId: e.target.value }))}
                    className="w-full h-10 px-3 py-2 rounded-md border border-border bg-background text-sm font-semibold appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    {courseDetails?.topics?.map((topic: any) => (
                      <option key={topic.id} value={topic.id.toString()}>{topic.title}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground/80 uppercase">Material Category</label>
                  <select
                    value={materialForm.type}
                    onChange={(e) => setMaterialForm(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full h-10 px-3 py-2 rounded-md border border-border bg-background text-sm font-semibold appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="PDF">PDF Presentation</option>
                    <option value="WORD">Word Handout</option>
                    <option value="EXCEL">Excel spreadsheet</option>
                    <option value="IMAGE">Image diagram</option>
                    <option value="VIDEO">Video lesson</option>
                    <option value="AUDIO">Audio lecture</option>
                    <option value="TEXT">Plain-text notes</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground/80 uppercase">Title / Name</label>
                <Input
                  required
                  placeholder="e.g., Mechanics Lecture Slides"
                  className="bg-muted/30 focus:bg-background border-border/60 transition-all font-semibold py-5"
                  value={materialForm.title}
                  onChange={(e) => setMaterialForm(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground/80 uppercase">Description (Audio narration fallback)</label>
                <Input
                  placeholder="Summarize file purpose for screen-readers..."
                  className="bg-muted/30 focus:bg-background border-border/60 transition-all py-5"
                  value={materialForm.description}
                  onChange={(e) => setMaterialForm(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>

              {materialForm.type === 'TEXT' ? (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground/80 uppercase">Plain Text Content</label>
                  <Textarea
                    required
                    placeholder="Type or paste study text content..."
                    className="bg-muted/30 focus:bg-background border-border/60 transition-all min-h-[140px]"
                    value={materialForm.textContent}
                    onChange={(e) => setMaterialForm(prev => ({ ...prev, textContent: e.target.value }))}
                  />
                </div>
              ) : (
                <div className="space-y-4 bg-muted/20 p-4 rounded-xl border border-border/40">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground/80 uppercase block">Local File Attachment</label>
                    <Input
                      type="file"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      className="bg-background border-border/60 focus:bg-background"
                    />
                  </div>
                  <div className="text-center text-[10px] font-bold text-muted-foreground uppercase py-1">OR</div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground/80 uppercase block">Web URL / Stream Link</label>
                    <Input
                      placeholder="e.g., YouTube URL, Google Drive link..."
                      className="bg-background border-border/60 focus:bg-background py-5"
                      value={materialForm.externalUrl}
                      onChange={(e) => setMaterialForm(prev => ({ ...prev, externalUrl: e.target.value }))}
                    />
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="p-6 pt-2 border-t border-border/40 bg-muted/5">
              <Button type="button" variant="ghost" onClick={() => setIsMaterialModalOpen(false)} className="font-bold">Cancel</Button>
              <Button type="submit" disabled={actionLoading} className="font-bold px-8 shadow-lg gap-2">
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Upload className="w-4 h-4" /> Publish Material</>}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Material Viewer */}
      <MaterialViewer
        material={viewerMaterial}
        open={!!viewerMaterial}
        onClose={() => setViewerMaterial(null)}
      />

      {/* Edit Material Modal */}
      <EditMaterialModal
        material={editMaterial}
        open={!!editMaterial}
        onClose={() => setEditMaterial(null)}
        onSaved={() => { if (selectedCourseId) fetchCourseDetails(selectedCourseId); }}
      />
    </div>
  );
}
