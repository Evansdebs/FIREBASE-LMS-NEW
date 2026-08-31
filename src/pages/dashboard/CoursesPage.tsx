import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  getCourses, getCourseById, createCourse,
  updateCourse, deleteCourse, getTopics,
  createTopic, updateTopic, deleteTopic,
  getSubjects, getClasses, CourseDoc, TopicDoc
} from '@/lib/services/academicService';
import { getMaterials, deleteMaterial, MaterialDoc } from '@/lib/services/contentService';
import { getUsersByRole } from '@/lib/services/userService';
import {
  BookOpen, Plus, Users, Clock, ChevronRight, FileText, Video, Search,
  MoreVertical, Edit, Trash2, Eye, Loader2, Check, ChevronDown, ChevronUp,
  Download, File, Image, FileAudio, FileBadge, Play, ExternalLink
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { TTSButton } from '@/components/ui/TTSButton';
import VideoPlayerModal from '@/components/dashboard/VideoPlayerModal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function CoursesPage() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCourse, setSelectedCourse] = useState<any | null>(null);
  const [courseDetails, setCourseDetails] = useState<any | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [courseToEdit, setCourseToEdit] = useState<any>(null);
  const [courseToDelete, setCourseToDelete] = useState<any>(null);
  const [showAddTopic, setShowAddTopic] = useState(false);
  const [showEditTopic, setShowEditTopic] = useState(false);
  const [activeTopic, setActiveTopic] = useState<any>(null);

  const isAdmin = user?.role === 'super_admin';
  const isTeacher = user?.role === 'teacher';
  const isStudent = user?.role === 'student';
  const canManage = isAdmin || isTeacher;
  const isAdminOnly = isAdmin;

  useEffect(() => {
    fetchCourses();
  }, [user]);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const res = await getCourses();
      setCourses(res || []);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCourse = async (id: string) => {
    try {
      await deleteCourse(id);
      toast.success('Subject deleted');
      fetchCourses();
      if (selectedCourse?.id === id) setSelectedCourse(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete subject');
    } finally {
      setCourseToDelete(null);
    }
  };

  const fetchCourseDetails = async (courseId: string) => {
    try {
      setDetailsLoading(true);
      const course = await getCourseById(courseId);
      if (!course) {
        toast.error('Course not found');
        return;
      }
      const topics = await getTopics(courseId);
      const topicsWithMaterials = await Promise.all(
        topics.map(async (t) => {
          const materials = await getMaterials(t.id);
          return { ...t, materials };
        })
      );
      const full = { ...course, topics: topicsWithMaterials };
      setCourseDetails(full);
      setSelectedCourse(full);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleDeleteTopic = async (topicId: string) => {
    if (!confirm('Are you sure you want to delete this module and all its materials?')) return;
    try {
      await deleteTopic(topicId);
      toast.success('Module deleted');
      if (courseDetails?.id) fetchCourseDetails(courseDetails.id);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete module');
    }
  };

  const filtered = courses.filter(c => 
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    (c.subjectName || '').toLowerCase().includes(search.toLowerCase())
  );

  if (selectedCourse && courseDetails) {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center justify-between">
          <Button variant="ghost" className="gap-2" onClick={() => { setSelectedCourse(null); setActiveTab('overview'); }}>
            <ChevronRight className="w-4 h-4 rotate-180" /> Back to Subjects
          </Button>
          <div className="flex gap-2">
            {canManage && (
              <Button variant="outline" size="sm" className="gap-1 shadow-sm" onClick={() => setShowAddTopic(true)}>
                <Plus className="w-3.5 h-3.5" /> New Module
              </Button>
            )}
            {isAdminOnly && (
              <Button variant="outline" size="sm" className="gap-1" onClick={() => { setCourseToEdit(courseDetails); setShowEdit(true); }}>
                <Edit className="w-3.5 h-3.5" /> Edit Subject
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="overflow-hidden border-border bg-card/50 backdrop-blur-sm">
              <div className="aspect-video bg-muted relative flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10" />
                <BookOpen className="w-20 h-20 text-muted-foreground/20" />
                <div className="absolute bottom-6 left-6 right-6 z-20">
                  <Badge className="mb-2 bg-primary/20 text-primary border-primary/30 backdrop-blur-md">
                    {courseDetails.subject?.name}
                  </Badge>
                  <h1 className="text-3xl font-bold text-white font-heading">{courseDetails.title}</h1>
                </div>
              </div>
              <CardContent className="p-6">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="bg-muted/50 p-1 mb-6">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="content">Subject Content</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="overview" className="space-y-4">
                    <p className="text-muted-foreground leading-relaxed">{courseDetails.description}</p>
                    <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border mt-6">
                      <div className="text-center p-4 rounded-xl bg-muted/30">
                        <Users className="w-5 h-5 mx-auto mb-2 text-primary" />
                        <div className="text-sm font-bold text-foreground">
                          {courseDetails.courseClasses?.length || 0} Classes
                        </div>
                      </div>
                      <div className="text-center p-4 rounded-xl bg-muted/30">
                        <Clock className="w-5 h-5 mx-auto mb-2 text-primary" />
                        <div className="text-sm font-bold text-foreground">
                          {courseDetails.topics?.length || 0} Modules
                        </div>
                      </div>
                      <div className="text-center p-4 rounded-xl bg-muted/30">
                        <Video className="w-5 h-5 mx-auto mb-2 text-primary" />
                        <div className="text-sm font-bold text-foreground">
                          {courseDetails.liveClasses?.length || 0} Live Sessions
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="content">
                    <div className="space-y-3">
                      {courseDetails.topics?.map((topic: any, idx: number) => (
                        <TopicMaterialsAccordion
                          key={topic.id}
                          topic={topic}
                          idx={idx}
                          canManage={canManage}
                          onEditTopic={() => { setActiveTopic(topic); setShowEditTopic(true); }}
                          onDeleteTopic={() => handleDeleteTopic(topic.id)}
                          onRefresh={() => fetchCourseDetails(courseDetails.id)}
                        />
                      ))}
                      {(courseDetails.topics?.length === 0) && (
                        <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
                          No content published yet.
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="border-border bg-card/50 backdrop-blur-sm sticky top-24">
              <CardContent className="p-6">
                <h3 className="font-heading font-bold text-lg mb-4 text-foreground">Classes</h3>
                <div className="space-y-3 mb-6">
                  {courseDetails.courseClasses?.map(({ class: cls }: any) => (
                    <div key={cls.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                        {cls.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">{cls.name}</p>
                        <p className="text-xs text-muted-foreground">Class Profile</p>
                      </div>
                    </div>
                  ))}
                </div>

                <h3 className="font-heading font-bold text-lg mb-4 text-foreground">Instructors</h3>
                <div className="space-y-3">
                  {courseDetails.courseTeachers?.map(({ teacher }: any) => (
                    <div key={teacher.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                        {teacher.user?.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">{teacher.user?.name}</p>
                        <p className="text-xs text-muted-foreground">Lead Teacher</p>
                      </div>
                    </div>
                  ))}
                </div>

                <Button className="w-full mt-6 shadow-lg shadow-primary/20" 
                  onClick={() => setActiveTab('content')}>
                  Access Materials
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {canManage && (
          <>
            <Dialog open={showAddTopic} onOpenChange={setShowAddTopic}>
              <DialogContent>
                <DialogHeader><DialogTitle className="font-heading">Add New Module</DialogTitle></DialogHeader>
                <TopicForm courseId={courseDetails.id} onClose={() => setShowAddTopic(false)} onRefresh={() => fetchCourseDetails(courseDetails.id)} isAdmin={isAdmin} />
              </DialogContent>
            </Dialog>

            <Dialog open={showEditTopic} onOpenChange={setShowEditTopic}>
              <DialogContent>
                <DialogHeader><DialogTitle className="font-heading">Edit Module</DialogTitle></DialogHeader>
                {activeTopic && (
                  <TopicForm 
                    courseId={courseDetails.id} 
                    topic={activeTopic} 
                    onClose={() => { setShowEditTopic(false); setActiveTopic(null); }} 
                    onRefresh={() => fetchCourseDetails(courseDetails.id)} 
                    isAdmin={isAdmin}
                  />
                )}
              </DialogContent>
            </Dialog>
          </>
        )}

        {isAdminOnly && (
          <Dialog open={showEdit} onOpenChange={setShowEdit}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle className="font-heading text-xl">Edit Subject</DialogTitle></DialogHeader>
              {courseToEdit && (
                <EditCourseForm 
                  course={courseToEdit} 
                  onClose={() => { setShowEdit(false); setCourseToEdit(null); }} 
                  onRefresh={() => { fetchCourses(); fetchCourseDetails(courseDetails.id); }} 
                />
              )}
            </DialogContent>
          </Dialog>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Subject Catalog</h1>
          <p className="text-muted-foreground mt-1">Manage and access educational content</p>
        </div>
        {isAdmin && (
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button className="gap-2 shadow-lg shadow-primary/20">
                <Plus className="w-4 h-4" /> Create Subject
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle className="font-heading text-xl">Create New Subject</DialogTitle></DialogHeader>
              <CreateCourseForm onClose={() => setShowCreate(false)} onRefresh={fetchCourses} />
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[300px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input 
            placeholder="Search by title or subject..." 
            value={search} 
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-background/50 border-border focus:ring-primary/20 h-11"
          />
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
          <p>Loading catalog...</p>
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((course: any) => (
            <Card key={course.id} className="group border-border border-t-4 border-t-primary bg-card/50 backdrop-blur-sm overflow-hidden hover:shadow-xl hover:shadow-primary/5 transition-all duration-300">
              <div className="aspect-video bg-muted relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                <BookOpen className="w-12 h-12 text-muted-foreground/30 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-transform group-hover:scale-110" />
                <div className="absolute top-4 right-4">
                  <Badge className="bg-background/80 text-foreground border-border backdrop-blur-md">
                    {course.subject?.name}
                  </Badge>
                </div>
              </div>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-heading font-semibold text-lg text-card-foreground group-hover:text-primary transition-colors truncate">
                      {course.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Users className="w-3 h-3" /> {course.courseClasses?.length || 0} Classes
                      </span>
                    </div>
                  </div>
                  {isAdmin && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg"><MoreVertical className="w-4 h-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40 border-border shadow-xl">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setCourseToEdit(course); setShowEdit(true); }} className="gap-2 cursor-pointer">
                          <Edit className="w-4 h-4" /> Edit
                        </DropdownMenuItem>
                         <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setCourseToDelete(course); }} className="gap-2 cursor-pointer text-destructive focus:text-destructive">
                           <Trash2 className="w-4 h-4" /> Delete
                         </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                
                <p className="text-sm text-muted-foreground line-clamp-2 mb-6 h-10">
                  {course.description}
                </p>

                <div className="flex items-center justify-between mt-auto pt-4 border-t border-border">
                  <div className="flex -space-x-2">
                    {course.courseTeachers?.slice(0, 3).map(({ teacher }: any, idx: number) => (
                      <div key={idx} className="w-8 h-8 rounded-full border-2 border-card bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary" title={teacher.user?.name}>
                        {teacher.user?.name.charAt(0)}
                      </div>
                    ))}
                    {(course.courseTeachers?.length > 3) && (
                      <div className="w-8 h-8 rounded-full border-2 border-card bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                        +{course.courseTeachers.length - 3}
                      </div>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" className="gap-1 group-hover:bg-primary/10 group-hover:text-primary transition-all" onClick={() => fetchCourseDetails(course.id)}>
                    View Details <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="py-20 text-center text-muted-foreground bg-muted/20 border border-dashed border-border rounded-2xl">
          <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <p className="font-heading text-lg font-medium">No subjects found matching your search.</p>
          <Button variant="outline" className="mt-4" onClick={() => setSearch('')}>Clear Search</Button>
        </div>
      )}

      {isAdmin && (
        <Dialog open={showEdit} onOpenChange={setShowEdit}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="font-heading text-xl">Edit Subject</DialogTitle></DialogHeader>
            {courseToEdit && (
              <EditCourseForm 
                course={courseToEdit} 
                onClose={() => { setShowEdit(false); setCourseToEdit(null); }} 
                onRefresh={fetchCourses} 
              />
            )}
          </DialogContent>
        </Dialog>
      )}

      <AlertDialog open={!!courseToDelete} onOpenChange={(open) => !open && setCourseToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the subject <strong>{courseToDelete?.title}</strong>. 
              All associated topics, lessons, quizzes, and student enrollments will be permanently removed.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => handleDeleteCourse(courseToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Subject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── TOPIC MATERIALS ACCORDION ───────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_URL || '';

function TopicMaterialsAccordion({ topic, idx, canManage, onEditTopic, onDeleteTopic, onRefresh }: {
  topic: any;
  idx: number;
  canManage: boolean;
  onEditTopic: () => void;
  onDeleteTopic: () => void;
  onRefresh?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [previewMaterial, setPreviewMaterial] = useState<any>(null);
  const [videoMaterial, setVideoMaterial] = useState<any>(null);
  const [tick, setTick] = useState(0);

  const getMaterialIcon = (type: string, name?: string) => {
    const t = (type || '').toUpperCase();
    const ext = name?.split('.').pop()?.toLowerCase();
    if (t === 'VIDEO') return <Video className="w-4 h-4 text-rose-500 shrink-0" />;
    if (t === 'IMAGE') return <Image className="w-4 h-4 text-emerald-500 shrink-0" />;
    if (t === 'PDF') return <FileText className="w-4 h-4 text-red-500 shrink-0" />;
    if (t === 'WORD' || ext === 'doc' || ext === 'docx') return <FileText className="w-4 h-4 text-blue-500 shrink-0" />;
    if (t === 'EXCEL' || ext === 'xls' || ext === 'xlsx') return <FileBadge className="w-4 h-4 text-green-600 shrink-0" />;
    if (t === 'AUDIO') return <FileAudio className="w-4 h-4 text-purple-500 shrink-0" />;
    if (t === 'TEXT') return <FileText className="w-4 h-4 text-slate-500 shrink-0" />;
    return <File className="w-4 h-4 text-muted-foreground shrink-0" />;
  };

  const getEmbedUrl = (url: string) => {
    if (!url) return null;
    if (url.includes('youtube.com/watch?v=')) return `https://www.youtube.com/embed/${url.split('v=')[1]?.split('&')[0]}`;
    if (url.includes('youtu.be/')) return `https://www.youtube.com/embed/${url.split('youtu.be/')[1]?.split('?')[0]}`;
    if (url.includes('vimeo.com/')) return `https://player.vimeo.com/video/${url.split('vimeo.com/')[1]?.split('?')[0]}`;
    return null;
  };

  const handleDownload = async (material: any) => {
    const url = material.fileUrl || material.externalUrl || material.filePath || '';
    if (!url || url === 'text-content') {
      const blob = new Blob([material.textContent || ''], { type: 'text/plain' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${material.fileName || 'note'}.txt`;
      a.click();
      URL.revokeObjectURL(a.href);
      return;
    }
    const isExternal = url.startsWith('http');
    const fullUrl = isExternal ? url : `${API_BASE}/${url}`;
    try {
      const response = await fetch(fullUrl, {
        headers: { Authorization: `Bearer ${localStorage.getItem('onereal_token')}` }
      });
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = material.fileName || 'resource';
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      window.open(fullUrl, '_blank');
    }
  };

  return (
    <>
      <div className="border border-border rounded-xl overflow-hidden">
        {/* Topic header — click to expand */}
        <button
          type="button"
          className="w-full p-4 flex items-center justify-between text-left hover:bg-muted/30 transition-colors"
          onClick={() => setOpen(o => !o)}
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
              {idx + 1}
            </span>
            <div className="min-w-0">
              <h3 className="font-semibold text-foreground truncate text-left">{topic.title}</h3>
              {topic.description && <p className="text-xs text-muted-foreground truncate">{topic.description}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2 ml-2 shrink-0">
            <Badge variant="outline" className="text-[10px] h-5">{topic.materials?.length || 0} items</Badge>
            {canManage && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => e.stopPropagation()}>
                    <MoreVertical className="w-3.5 h-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-32">
                  <DropdownMenuItem onClick={e => { e.stopPropagation(); onEditTopic(); }} className="gap-2">
                    <Edit className="w-3.5 h-3.5" /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={e => { e.stopPropagation(); onDeleteTopic(); }} className="gap-2 text-destructive focus:text-destructive">
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </button>

        {/* Materials list */}
        {open && (
          <div className="border-t border-border divide-y divide-border bg-muted/10">
            {(topic.materials || []).length === 0 ? (
              <p className="text-center py-6 text-xs text-muted-foreground">No materials in this module yet.</p>
            ) : (
              (topic.materials || []).map((mat: any) => {
                const url = mat.fileUrl || mat.externalUrl || (mat.filePath && mat.filePath !== 'text-content' ? `${API_BASE}/${mat.filePath}` : null);
                const isVideo = mat.type === 'VIDEO';
                const isText = mat.type === 'TEXT' || mat.textContent;
                const embedUrl = isVideo ? getEmbedUrl(url || '') : null;
                return (
                  <div key={mat.id} className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        {getMaterialIcon(mat.type, mat.fileName)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{mat.fileName || mat.title || 'Untitled'}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">{mat.type || 'FILE'}</Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(mat.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* TTS & Progress Controls */}
                    <div className="flex flex-wrap items-center gap-2 mt-2 sm:mt-0 sm:ml-auto">
                      {(isText || mat.fileName || mat.title) && (
                        <TTSButton 
                          text={`${mat.title || mat.fileName || 'Material'}. ${mat.description ? `Description: ${mat.description}` : ''} ${isText ? `. Content: ${mat.textContent}` : ''}`} 
                          className="h-7 w-7" 
                        />
                      )}
                      
                      {!canManage && (
                        <div className="flex items-center shrink-0">
                          {(() => {
                             const isCompleted = mat.progress?.[0]?.status === 'COMPLETED';
                             return (
                               <Button 
                                 variant={isCompleted ? "default" : "outline"} 
                                 size="sm" 
                                 className={cn("gap-1 h-7 text-[10px] px-2", isCompleted && "bg-green-600 hover:bg-green-700")}
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   const newStatus = isCompleted ? 'IN_PROGRESS' : 'COMPLETED';
                                   if (!mat.progress) mat.progress = [];
                                   if (mat.progress.length > 0) mat.progress[0].status = newStatus;
                                   else mat.progress.push({ status: newStatus });
                                   setTick(t => t + 1); // Force re-render
                                   if (newStatus === 'COMPLETED') {
                                     toast.success('Marked as completed!');
                                   }
                                   if (onRefresh) onRefresh();
                                   e.currentTarget.blur();
                                 }}
                               >
                                 {isCompleted ? <Check className="w-3 h-3 text-white" /> : <div className="w-3 h-3 rounded-full border border-current" />}
                                 <span className="hidden xs:inline">{isCompleted ? 'Completed' : 'Mark Complete'}</span>
                               </Button>
                             );
                          })()}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex gap-1.5 shrink-0 mt-2 sm:mt-0">
                      {isVideo && (
                        <Button size="sm" variant="default" className="gap-1 h-7 text-xs px-2.5 bg-rose-600 hover:bg-rose-700 hover:scale-105 transition-all duration-200"
                          onClick={() => setVideoMaterial(mat)}>
                          <Play className="w-3 h-3" /> Play
                        </Button>
                      )}
                      {isText && (
                        <Button size="sm" variant="outline" className="gap-1 h-7 text-xs px-2.5"
                          onClick={() => setPreviewMaterial(mat)}>
                          <Eye className="w-3 h-3" /> View
                        </Button>
                      )}
                      <Button size="sm" variant="outline" className="gap-1 h-7 text-xs px-2.5"
                        onClick={() => handleDownload(mat)}>
                        <Download className="w-3 h-3" /> Download
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Preview modal */}
      {previewMaterial && (
        <Dialog open={!!previewMaterial} onOpenChange={() => setPreviewMaterial(null)}>
          <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black/95 border-none">
            <div className="flex flex-col h-[80vh]">
              <div className="p-4 bg-background/10 border-b border-white/10 flex justify-between items-center">
                <h3 className="text-white font-medium">{previewMaterial.fileName || previewMaterial.title}</h3>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" className="text-white/70 hover:bg-white/10 gap-1 text-xs" onClick={() => handleDownload(previewMaterial)}>
                    <Download className="w-3.5 h-3.5" /> Download
                  </Button>
                  <Button variant="ghost" size="sm" className="text-white hover:bg-white/10" onClick={() => setPreviewMaterial(null)}>Close</Button>
                </div>
              </div>
              <div className="flex-1 min-h-0 bg-black flex items-center justify-center p-0">
                {previewMaterial.type === 'VIDEO' ? (
                  <iframe
                    src={getEmbedUrl(previewMaterial.fileUrl || previewMaterial.externalUrl || previewMaterial.filePath || '') || ''}
                    className="w-full h-full border-none"
                    allowFullScreen
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  />
                ) : (
                  <div className="w-full h-full bg-background p-8 overflow-auto">
                    <pre className="whitespace-pre-wrap font-sans text-foreground leading-relaxed">
                      {previewMaterial.textContent}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Premium Video Player Modal */}
      {videoMaterial && (
        <VideoPlayerModal
          material={videoMaterial}
          isOpen={!!videoMaterial}
          onClose={() => setVideoMaterial(null)}
          onProgressComplete={() => {
            if (onRefresh) onRefresh();
          }}
        />
      )}
    </>
  );
}

// ─── MULTI-SELECT HELPER ──────────────────────────────────
function MultiSelectToggle({ label, items, selectedIds, onToggle, getItemId, getItemName }: any) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-semibold flex justify-between items-center">
        {label}
        <Badge variant="outline" className="text-[10px] px-1.5 h-4">{selectedIds.length} selected</Badge>
      </Label>
      <div className="grid grid-cols-2 gap-2 p-3 border border-border rounded-xl bg-muted/20 max-h-48 overflow-y-auto">
        {items.map((item: any) => {
          const id = getItemId(item);
          const name = getItemName(item);
          const isSelected = selectedIds.includes(id.toString());
          return (
            <button
              key={id}
              type="button"
              onClick={() => onToggle(id.toString())}
              className={cn(
                "flex items-center gap-2 p-2 rounded-lg text-xs text-left transition-all border",
                isSelected 
                  ? "bg-primary/10 border-primary/30 text-primary font-bold shadow-sm" 
                  : "bg-background border-transparent text-muted-foreground hover:bg-muted"
              )}
            >
              <div className={cn(
                "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all",
                isSelected ? "bg-primary border-primary" : "border-muted-foreground/30"
              )}>
                {isSelected && <Check className="w-3 h-3 text-white" />}
              </div>
              <span className="truncate">{name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CreateCourseForm({ onClose, onRefresh }: { onClose: () => void; onRefresh: () => void }) {
  const [form, setForm] = useState({ title: '', description: '', subjectId: '' });
  const [classIds, setClassIds] = useState<string[]>([]);
  const [teacherIds, setTeacherIds] = useState<string[]>([]);
  
  const [subjects, setSubjects] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getSubjects().then(setSubjects).catch(() => {});
    getClasses().then(setClasses).catch(() => {});
    getUsersByRole('teacher').then(setTeachers).catch(() => {});
  }, []);

  const toggleClass = (id: string) => {
    setClassIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleTeacher = (id: string) => {
    setTeacherIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (classIds.length === 0) return toast.error("Select at least one class");
    if (teacherIds.length === 0) return toast.error("Select at least one teacher");
    
    try {
      setLoading(true);
      const subj = subjects.find(s => s.id === form.subjectId);
      await createCourse({
        ...form,
        subjectName: subj?.name || '',
        classIds,
        teacherIds,
      });
      toast.success('Subject created successfully');
      onRefresh();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 py-4">
      <div className="grid grid-cols-1 md:grid-grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} required placeholder="e.g. Advanced Mathematics" />
          </div>
          <div className="space-y-2">
            <Label>Subject</Label>
            <Select value={form.subjectId} onValueChange={v => setForm(p => ({ ...p, subjectId: v }))}>
              <SelectTrigger className="rounded-xl border-border bg-background"><SelectValue placeholder="Select subject" /></SelectTrigger>
              <SelectContent>
                {subjects.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea 
              value={form.description} 
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))} 
              required 
              rows={5}
              placeholder="Provide a detailed description of the course goals and curriculum..."
              className="resize-none rounded-xl"
            />
          </div>
        </div>

        <div className="space-y-6">
          <MultiSelectToggle 
            label="Target Classes" 
            items={classes} 
            selectedIds={classIds} 
            onToggle={toggleClass}
            getItemId={(i: any) => i.id}
            getItemName={(i: any) => i.name}
          />
          <MultiSelectToggle 
            label="Assign Teachers" 
            items={teachers} 
            selectedIds={teacherIds} 
            onToggle={toggleTeacher}
            getItemId={(i: any) => i.id}
            getItemName={(i: any) => i.name || i.fullName}
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-6 border-t border-border">
        <Button type="button" variant="outline" onClick={onClose} className="rounded-xl px-6">Cancel</Button>
        <Button type="submit" disabled={loading} className="rounded-xl px-8 shadow-lg shadow-primary/20">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Subject'}
        </Button>
      </div>
    </form>
  );
}

function EditCourseForm({ course, onClose, onRefresh }: { course: any; onClose: () => void; onRefresh: () => void }) {
  const [form, setForm] = useState({ 
    title: course.title || '', 
    description: course.description || '', 
    subjectId: course.subjectId?.toString() || '', 
  });
  
  const [classIds, setClassIds] = useState<string[]>(course.classIds || []);
  const [teacherIds, setTeacherIds] = useState<string[]>(course.teacherIds || []);

  const [subjects, setSubjects] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getSubjects().then(setSubjects).catch(() => {});
    getClasses().then(setClasses).catch(() => {});
    getUsersByRole('teacher').then(setTeachers).catch(() => {});
  }, []);

  const toggleClass = (id: string) => {
    setClassIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleTeacher = (id: string) => {
    setTeacherIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (classIds.length === 0) return toast.error("Select at least one class");
    if (teacherIds.length === 0) return toast.error("Select at least one teacher");

    try {
      setLoading(true);
      const subj = subjects.find(s => s.id === form.subjectId);
      await updateCourse(course.id, {
        ...form,
        subjectName: subj?.name || course.subjectName,
        classIds,
        teacherIds,
      });
      toast.success('Subject updated successfully');
      onRefresh();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 py-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} required />
          </div>
          <div className="space-y-2">
            <Label>Subject</Label>
            <Select value={form.subjectId} onValueChange={v => setForm(p => ({ ...p, subjectId: v }))}>
              <SelectTrigger className="rounded-xl border-border bg-background"><SelectValue /></SelectTrigger>
              <SelectContent>
                {subjects.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea 
              value={form.description} 
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))} 
              required 
              rows={5}
              className="resize-none rounded-xl"
            />
          </div>
        </div>

        <div className="space-y-6">
          <MultiSelectToggle 
            label="Target Classes" 
            items={classes} 
            selectedIds={classIds} 
            onToggle={toggleClass}
            getItemId={(i: any) => i.id}
            getItemName={(i: any) => i.name}
          />
          <MultiSelectToggle 
            label="Assign Teachers" 
            items={teachers} 
            selectedIds={teacherIds} 
            onToggle={toggleTeacher}
            getItemId={(i: any) => i.id}
            getItemName={(i: any) => i.name || i.fullName}
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-6 border-t border-border">
        <Button type="button" variant="outline" onClick={onClose} className="rounded-xl px-6">Cancel</Button>
        <Button type="submit" disabled={loading} className="rounded-xl px-8 shadow-lg shadow-primary/20">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
}

function TopicForm({ courseId, topic, onClose, onRefresh, isAdmin }: { courseId: string; topic?: any; onClose: () => void; onRefresh: () => void; isAdmin: boolean }) {
  const [form, setForm] = useState({ 
    title: topic?.title || '', 
    description: topic?.description || '', 
    orderIndex: topic?.orderIndex?.toString() || '0' 
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      if (topic) {
        await updateTopic(topic.id, { ...form, orderIndex: parseInt(form.orderIndex) || 0 });
        toast.success('Module updated');
      } else {
        await createTopic({ ...form, courseId, orderIndex: parseInt(form.orderIndex) || 0 });
        toast.success('Module added');
      }
      onRefresh();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save module');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-2">
      <div className="space-y-2">
        <Label>Module Title</Label>
        <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} required placeholder="e.g. Introduction to Derivatives" />
      </div>
      <div className="space-y-2">
        <Label>Description (Optional)</Label>
        <Textarea 
          value={form.description} 
          onChange={e => setForm(p => ({ ...p, description: e.target.value }))} 
          placeholder="Briefly describe what this module covers..."
          className="resize-none"
        />
      </div>
      <div className="space-y-2">
        <Label>Order / Index</Label>
        <Input type="number" value={form.orderIndex} onChange={e => setForm(p => ({ ...p, orderIndex: e.target.value }))} />
        <p className="text-[10px] text-muted-foreground">Lower numbers appear first in the curriculum.</p>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={loading} className="min-w-[100px]">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (topic ? 'Update' : 'Create')}
        </Button>
      </div>
    </form>
  );
}
