import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { 
  Plus, Search, StickyNote, Trash2, Edit3, 
  ChevronRight, Calendar, Tag, MoreVertical,
  BookOpen, Clock, AlertCircle, FileText, Share2, 
  Lock, Unlock, ChevronLeft, Palette, Book,
  Bookmark, Sparkles, Copy, Download, Check,
  Save, Upload
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, 
  DialogTrigger, DialogFooter, DialogDescription 
} from '@/components/ui/dialog';
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
  DropdownMenuTrigger, DropdownMenuSeparator 
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { getNotes, createNote, updateNote, deleteNote, NoteDoc } from '@/lib/services/contentService';
import { getCourses, CourseDoc } from '@/lib/services/academicService';
import { TTSButton } from '@/components/ui/TTSButton';
import MediaRecorderModal from '@/components/dashboard/MediaRecorderModal';
import { Mic, Radio } from 'lucide-react';
import { jsPDF } from 'jspdf';

interface Note {
  id: any;
  userId: any;
  courseId: any;
  title: string;
  content: string;
  category: string;
  notebook: string;
  style: string;
  color: string;
  mediaUrl?: string;
  mediaType?: 'audio' | 'video';
  duration?: number;
  isShared: boolean;
  isPersonal?: boolean;
  teacherName?: string;
  createdAt: string;
  updatedAt: string;
  course?: {
    id: any;
    title: string;
  } | null;
}

interface Course {
  id: any;
  title: string;
}

const NOTEBOOK_COLORS = [
  { name: 'Warm Cream', bg: '#fffdf5', border: '#e6dfc3', text: '#3c3a30', cover: '#dfcba5' },
  { name: 'Legal Yellow', bg: '#fefcbf', border: '#f6e05e', text: '#2f3020', cover: '#ecc94b' },
  { name: 'Sage Mint', bg: '#f0fdf4', border: '#bbf7d0', text: '#14532d', cover: '#86efac' },
  { name: 'Sky Blue', bg: '#eff6ff', border: '#bfdbfe', text: '#1e3a8a', cover: '#60a5fa' },
  { name: 'Blossom Rose', bg: '#fdf2f8', border: '#fbcfe8', text: '#4c0519', cover: '#f472b6' },
  { name: 'Royal Lavender', bg: '#faf5ff', border: '#e9d5ff', text: '#3b0764', cover: '#c084fc' },
  { name: 'Slate Blackboard', bg: '#1e293b', border: '#475569', text: '#f8fafc', cover: '#334155' },
];

const FONTS = [
  { name: 'Modern Sans', class: 'font-sans' },
  { name: 'Typewriter Mono', class: 'font-mono' },
  { name: 'Handwritten Cursive', class: 'font-cursive font-medium text-lg leading-relaxed tracking-wide font-serif italic' },
];

const PAPER_STYLES = [
  { id: 'ruled', name: '📖 Ruled Notebook', desc: 'Horizontal thin lines with left vertical margin' },
  { id: 'grid', name: '📐 Math Grid', desc: 'Graph paper style grid lines for formulas' },
  { id: 'dotted', name: '✏️ Dotted Bullet', desc: 'Modern dots for creative styling' },
  { id: 'blank', name: '📄 Smooth Blank', desc: 'Clean paper template' },
];

export default function NotesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [notes, setNotes] = useState<Note[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [activeNotebook, setActiveNotebook] = useState<string>('all');
  const [activeCourse, setActiveCourse] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [viewingNote, setViewingNote] = useState<Note | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [viewingFontClass, setViewingFontClass] = useState('font-sans');

  const isTeacher = user?.role === 'teacher';
  const isStudent = user?.role === 'student';
  const [activeTab, setActiveTab] = useState<'personal' | 'shared'>('personal');
  const [selectedNotebook, setSelectedNotebook] = useState<string | null>(null);
  const [showRecorder, setShowRecorder] = useState(false);
  const notesFileInputRef = useRef<HTMLInputElement | null>(null);

  const [noteForm, setNoteForm] = useState({
    title: '',
    content: '',
    category: 'Lecture Notes',
    notebook: 'General Study',
    style: 'ruled',
    color: '#fffdf5',
    isShared: false,
    courseId: '',
  });

  useEffect(() => {
    fetchNotes();
    fetchCourses();
  }, [user]);

  const fetchNotes = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const response = await getNotes(user.id as string);
      const currentUid = String(user.id);
      const mapped = response.map((n: any) => ({
        ...n,
        isPersonal: String(n.userId) === currentUid,
      }));
      setNotes(mapped);
    } catch (error) {
      console.error('Fetch notes error:', error);
      toast({
        title: 'Error',
        description: 'Failed to load notebooks and pages.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCourses = async () => {
    try {
      const response = await getCourses();
      setCourses(response as any);
    } catch (error) {
      console.error('Fetch courses error:', error);
    }
  };

  const handleCreateOrUpdate = async () => {
    if (!noteForm.title.trim() || !noteForm.content.trim() || !user) {
      toast({
        title: 'Validation Error',
        description: 'Title and content are required.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const payload: any = {
        ...noteForm,
        userId: String(user.id),
      };
      if (noteForm.courseId) {
        payload.courseId = String(noteForm.courseId);
      }

      if (editingNote) {
        await updateNote(editingNote.id, payload);
        setNotes(prev => prev.map(n => n.id === editingNote.id ? { ...n, ...payload } : n));
        toast({ title: 'Success', description: 'Notebook page updated successfully.' });
      } else {
        const created = await createNote(payload);
        setNotes(prev => [{ ...(created as any), isPersonal: true }, ...prev]);
        toast({ title: 'Success', description: 'Notebook page created successfully.' });
      }
      closeModal();
    } catch (error) {
      console.error('Save note error:', error);
      toast({
        title: 'Error',
        description: 'Failed to save notes to notebook.',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: any) => {
    if (!confirm('Are you sure you want to rip this page out of your notebook permanently?')) return;
    try {
      await deleteNote(id);
      setNotes(prev => prev.filter(n => n.id !== id));
      toast({ title: 'Success', description: 'Note page discarded successfully.' });
      if (viewingNote?.id === id) setViewingNote(null);
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: 'Error',
        description: 'Could not delete page.',
        variant: 'destructive',
      });
    }
  };

  const handleCopyToPersonal = async (note: Note) => {
    if (!user) return;
    try {
      const payload: any = {
        userId: user.id as string,
        title: `${note.title} (Copy)`,
        content: note.content,
        category: note.category,
        notebook: `Imported Lectures`,
        style: note.style,
        color: note.color,
        isShared: false,
        courseId: undefined
      };
      const created = await createNote(payload);
      setNotes(prev => [created as any, ...prev]);
      toast({
        title: 'Cloned!',
        description: `Successfully added "${note.title}" to your personal notebooks.`,
      });
    } catch (error) {
      console.error('Clone error:', error);
      toast({
        title: 'Error',
        description: 'Could not copy notes to your portal.',
        variant: 'destructive',
      });
    }
  };

  const openModal = (note?: Note) => {
    if (note) {
      setEditingNote(note);
      setNoteForm({
        title: note.title,
        content: note.content,
        category: note.category,
        notebook: note.notebook,
        style: note.style,
        color: note.color,
        isShared: note.isShared,
        courseId: note.courseId ? note.courseId.toString() : '',
      });
    } else {
      setEditingNote(null);
      setNoteForm({
        title: '',
        content: '',
        category: 'Study',
        notebook: selectedNotebook || 'My Notebook',
        style: 'ruled',
        color: '#fffdf5',
        isShared: false,
        courseId: '',
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingNote(null);
    setNoteForm({
      title: '',
      content: '',
      category: 'Study',
      notebook: 'My Notebook',
      style: 'ruled',
      color: '#fffdf5',
      isShared: false,
      courseId: '',
    });
  };

  const handleDownloadPDF = (note: Note) => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.setTextColor(79, 70, 229); // Premium indigo
    doc.text(note.notebook || 'Notebook Pages', 20, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    const dateStr = note.createdAt ? new Date(note.createdAt).toLocaleDateString() : new Date().toLocaleDateString();
    doc.text(`Subject: ${note.course?.title || 'Personal notes'} | Created: ${dateStr}`, 20, 28);
    
    doc.setDrawColor(226, 232, 240);
    doc.line(20, 32, 190, 32);
    
    // Title
    doc.setFontSize(16);
    doc.setTextColor(30, 41, 59);
    doc.text(note.title || 'Untitled Note', 20, 42);
    
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184);
    doc.text(`Category: ${note.category} | Style: ${note.style}`, 20, 49);
    
    // Content body with pagination
    doc.setFontSize(11);
    doc.setTextColor(51, 65, 85);
    const splitText = doc.splitTextToSize(note.content || '', 170);
    
    let cursorY = 60;
    const pageHeight = 280;
    for (let i = 0; i < splitText.length; i++) {
      if (cursorY > pageHeight) {
        doc.addPage();
        cursorY = 20;
      }
      doc.text(splitText[i], 20, cursorY);
      cursorY += 6;
    }
    
    // Save
    doc.save(`${(note.title || 'note').replace(/[^a-zA-Z0-9_-]/g, '_')}_notes.pdf`);
    
    toast({
      title: 'Success',
      description: 'Downloaded note as PDF to your local device.',
    });
  };

  const handleDownloadText = (note: Note) => {
    const textContent = `========================================
${note.title || 'Untitled Note'}
========================================
Binder: ${note.notebook}
Category: ${note.category}
Date: ${new Date(note.updatedAt || note.createdAt || Date.now()).toLocaleString()}
${note.course ? `Course: ${note.course.title}\n` : ''}----------------------------------------

${note.content || ''}
`;
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(note.title || 'note').replace(/[^a-zA-Z0-9_-]/g, '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({
      title: 'Success',
      description: 'Downloaded note as plain text (.txt) to device.',
    });
  };

  const handleDownloadJSON = (note: Note) => {
    const blob = new Blob([JSON.stringify(note, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(note.title || 'note').replace(/[^a-zA-Z0-9_-]/g, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({
      title: 'Success',
      description: 'Downloaded note (.json) to device storage.',
    });
  };

  const handleExportAllNotesJSON = () => {
    if (notes.length === 0) {
      toast({
        title: 'Notice',
        description: 'No notes available to export.',
      });
      return;
    }
    const exportData = {
      app: 'OneReal_LMS_Notes',
      exportedAt: new Date().toISOString(),
      user: {
        id: user?.id,
        name: user?.fullName || user?.name,
        role: user?.role,
      },
      count: notes.length,
      notes,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `my_notes_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({
      title: 'Success',
      description: `Exported ${notes.length} note(s) to local storage.`,
    });
  };

  const handleImportNotesJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        const importedList = Array.isArray(data) ? data : (data.notes && Array.isArray(data.notes) ? data.notes : null);
        if (!importedList || importedList.length === 0) {
          toast({
            title: 'Error',
            description: 'No valid notes found in this backup file.',
            variant: 'destructive',
          });
          return;
        }

        let count = 0;
        for (const item of importedList) {
          if (item.title && item.content) {
            await createNote({
              title: item.title,
              content: item.content,
              category: item.category || 'General',
              notebook: item.notebook || 'Imported Notes',
              style: item.style || 'ruled',
              color: item.color || '#fffdf5',
              userId: user.id as string,
              isShared: false,
              courseId: item.courseId || undefined,
            });
            count++;
          }
        }
        await fetchNotes();
        toast({
          title: 'Success',
          description: `Imported ${count} note(s) to your binder!`,
        });
      } catch (err: any) {
        toast({
          title: 'Import Failed',
          description: 'Failed to read note file.',
          variant: 'destructive',
        });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Filter notebooks by tab and search
  const filteredNotes = notes.filter(note => {
    const matchesSearch = note.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          note.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          note.notebook.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (activeTab === 'personal') {
      return matchesSearch && note.isPersonal;
    } else {
      return matchesSearch && !note.isPersonal;
    }
  });

  // Extract unique notebook names for folder covers
  const uniqueNotebooks = [...new Set(filteredNotes.map(n => n.notebook))];

  // Notes inside the selected notebook folder
  const folderNotes = filteredNotes.filter(note => !selectedNotebook || note.notebook === selectedNotebook);

  const getNotebookTheme = (colorHex: string) => {
    return NOTEBOOK_COLORS.find(c => c.bg === colorHex) || NOTEBOOK_COLORS[0];
  };

  return (
    <div className="space-y-6">
      {/* Immersive notebook header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Book className="w-6 h-6" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-heading font-bold text-foreground">Interactive Notebooks</h1>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl">
            {isTeacher 
              ? 'Draft interactive lecture pages, design custom stationery backgrounds, and publish study binders to your enrolled classes.' 
              : 'Write personal journals, organize course binders, and access rich handwritten notebooks shared by your instructors.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Export / Backup All to Local Storage */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportAllNotesJSON}
            className="shadow-sm font-bold gap-1.5 text-xs sm:text-sm h-9"
            title="Download all notes to device"
          >
            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
            <span className="hidden xs:inline">Backup All</span>
            <span className="xs:hidden">Backup</span>
          </Button>

          {/* Import Notes from device */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => notesFileInputRef.current?.click()}
            className="shadow-sm font-bold gap-1.5 text-xs sm:text-sm h-9"
            title="Import notes from JSON file"
          >
            <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-500" />
            <span className="hidden xs:inline">Import</span>
          </Button>
          <input
            type="file"
            ref={notesFileInputRef}
            onChange={handleImportNotesJSON}
            accept=".json"
            className="hidden"
          />

          <Button
            variant="outline"
            size="sm"
            className="shadow-sm font-bold gap-1.5 border-primary/30 text-primary hover:bg-primary/10 text-xs sm:text-sm h-9"
            onClick={() => setShowRecorder(true)}
          >
            <Mic className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
            <span className="hidden sm:inline">Record Voice Memo</span>
            <span className="sm:hidden">Voice Memo</span>
          </Button>

          <Button onClick={() => openModal()} size="sm" className="shadow-lg hover:shadow-primary/20 transition-all font-bold px-3 sm:px-5 text-xs sm:text-sm h-9">
            <Plus className="w-4 h-4 mr-1 sm:mr-1.5" />
            Write Note
          </Button>
        </div>
      </div>

      {/* Tabs Control */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-muted/30 p-2 rounded-xl border border-border/40">
        <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto overflow-x-auto pb-0.5 no-scrollbar">
          <Button
            variant={activeTab === 'personal' ? 'default' : 'ghost'}
            size="sm"
            className={cn(
              "flex-1 sm:flex-initial font-bold gap-1.5 rounded-lg transition-all text-xs sm:text-sm h-8 sm:h-9 whitespace-nowrap",
              activeTab === 'personal' && "shadow-sm"
            )}
            onClick={() => {
              setActiveTab('personal');
              setSelectedNotebook(null);
              setViewingNote(null);
            }}
          >
            <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            📓 My Notebooks ({notes.filter(n => n.isPersonal).length})
          </Button>
          <Button
            variant={activeTab === 'shared' ? 'default' : 'ghost'}
            size="sm"
            className={cn(
              "flex-1 sm:flex-initial font-bold gap-1.5 rounded-lg transition-all text-xs sm:text-sm h-8 sm:h-9 whitespace-nowrap",
              activeTab === 'shared' && "shadow-sm"
            )}
            onClick={() => {
              setActiveTab('shared');
              setSelectedNotebook(null);
              setViewingNote(null);
            }}
          >
            <Share2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            {isTeacher ? '🎓 Class Notes' : '🎒 Lecture Notes'} ({notes.filter(n => !n.isPersonal).length})
          </Button>
        </div>

        <div className="relative w-full sm:w-72 md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search notes or binders..." 
            className="pl-9 h-8 sm:h-9 text-xs sm:text-sm bg-background/50 border-border/50 focus:bg-background transition-colors w-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 py-10">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="animate-pulse bg-card/40 border-border/40 h-64 rounded-2xl" />
          ))}
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {/* VIEW 1: SINGLE NOTE PAGE OPEN */}
          {viewingNote ? (
            <motion.div
              key="viewing-note"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="space-y-4 sm:space-y-6"
            >
              {/* Note Page toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-card/50 p-2 sm:p-3 rounded-xl border border-border/40 shadow-sm">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setViewingNote(null)} 
                  className="font-semibold gap-1 hover:bg-muted text-xs sm:text-sm h-8"
                >
                  <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden xs:inline">Back to Binders</span>
                  <span className="xs:hidden">Back</span>
                </Button>
                
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  {/* Font picker */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="font-semibold gap-1.5 border-border/50 text-xs h-8 px-2 sm:px-3">
                        <Palette className="w-3.5 h-3.5 text-primary" />
                        <span className="hidden sm:inline">Font Styles</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 border-border shadow-xl">
                      {FONTS.map(f => (
                        <DropdownMenuItem 
                          key={f.name} 
                          onClick={() => setViewingFontClass(f.class)}
                          className="cursor-pointer font-semibold py-2.5 flex items-center justify-between"
                        >
                          <span className={f.class}>{f.name}</span>
                          {viewingFontClass === f.class && <Check className="w-4 h-4 text-primary" />}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* TTS Button */}
                  <TTSButton text={viewingNote.content} className="h-8 w-8 bg-primary/10 hover:bg-primary/20 text-primary border-none shadow-sm" />

                  {/* Download Menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="font-bold gap-1 text-xs h-8 px-2 sm:px-3"
                      >
                        <Download className="w-3.5 h-3.5 text-primary" />
                        Download
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 p-1.5 shadow-xl border-border">
                      <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Download to Local Device
                      </div>
                      <DropdownMenuItem onClick={() => handleDownloadPDF(viewingNote)} className="cursor-pointer gap-2 py-2">
                        <FileText className="w-4 h-4 text-rose-500" />
                        <div>
                          <p className="font-semibold text-xs">Download PDF Document</p>
                          <p className="text-[10px] text-muted-foreground">Printable notebook sheet</p>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDownloadText(viewingNote)} className="cursor-pointer gap-2 py-2">
                        <Bookmark className="w-4 h-4 text-blue-500" />
                        <div>
                          <p className="font-semibold text-xs">Download Plain Text (.txt)</p>
                          <p className="text-[10px] text-muted-foreground">Readable text & markdown</p>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDownloadJSON(viewingNote)} className="cursor-pointer gap-2 py-2">
                        <Save className="w-4 h-4 text-emerald-500" />
                        <div>
                          <p className="font-semibold text-xs">Download Note JSON (.json)</p>
                          <p className="text-[10px] text-muted-foreground">Local file backup</p>
                        </div>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Clone note for student */}
                  {isStudent && !viewingNote.isPersonal && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleCopyToPersonal(viewingNote)}
                      className="font-bold gap-1 text-xs h-8 px-2 sm:px-3 bg-success/15 hover:bg-success/20 border-success/30 text-success"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Add to My Binder</span>
                      <span className="sm:hidden">Save</span>
                    </Button>
                  )}

                  {/* Teacher edit dropdown */}
                  {(viewingNote.userId === user?.id) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 border-border/50">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40 border-border shadow-xl">
                        <DropdownMenuItem onClick={() => openModal(viewingNote)} className="cursor-pointer gap-2 font-semibold">
                          <Edit3 className="w-4 h-4" /> Edit Page
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => handleDelete(viewingNote.id)} 
                          className="text-destructive focus:text-destructive cursor-pointer gap-2 font-semibold"
                        >
                          <Trash2 className="w-4 h-4" /> Discard Page
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>

              {/* Skeuomorphic Open Notebook Page */}
              <div className="relative min-h-[450px] sm:min-h-[600px] border border-border shadow-2xl rounded-2xl overflow-hidden bg-card transition-all duration-300">
                {/* Visual Ring binder spiral spine on left margin */}
                <div className="absolute left-0 top-0 bottom-0 w-5 sm:w-8 bg-gradient-to-r from-muted/50 via-muted to-muted/10 border-r border-border/40 z-10 flex flex-col justify-around py-3 sm:py-6 items-center shadow-inner pointer-events-none">
                  {Array.from({ length: 15 }).map((_, idx) => (
                    <div 
                      key={idx} 
                      className="w-3.5 sm:w-6 h-2 sm:h-3 bg-gradient-to-b from-slate-300 via-slate-400 to-slate-500 rounded-full border border-slate-600 shadow-md transform -rotate-12"
                    />
                  ))}
                </div>

                {/* Notebook paper sheet */}
                <div 
                  className="pl-8 sm:pl-16 pr-3 sm:pr-8 pt-5 sm:pt-8 pb-10 sm:pb-16 min-h-[450px] sm:min-h-[600px] select-text relative transition-all duration-300"
                  style={{
                    backgroundColor: getNotebookTheme(viewingNote.color).bg,
                    color: getNotebookTheme(viewingNote.color).text,
                  }}
                >
                  {/* Skeuomorphic Paper Styles CSS Overlays */}
                  {viewingNote.style === 'ruled' && (
                    <div 
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        backgroundImage: `linear-gradient(${getNotebookTheme(viewingNote.color).border} 1px, transparent 1px)`,
                        backgroundSize: '100% 28px',
                        backgroundPosition: '0 8px',
                      }}
                    >
                      {/* Left vertical red margin line */}
                      <div className="absolute left-6 sm:left-14 top-0 bottom-0 w-[1px] bg-rose-400/50" />
                    </div>
                  )}

                  {viewingNote.style === 'grid' && (
                    <div 
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        backgroundImage: `linear-gradient(${getNotebookTheme(viewingNote.color).border} 1px, transparent 1px), linear-gradient(90deg, ${getNotebookTheme(viewingNote.color).border} 1px, transparent 1px)`,
                        backgroundSize: '24px 24px',
                      }}
                    />
                  )}

                  {viewingNote.style === 'dotted' && (
                    <div 
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        backgroundImage: `radial-gradient(${getNotebookTheme(viewingNote.color).border} 1.5px, transparent 1.5px)`,
                        backgroundSize: '20px 20px',
                      }}
                    />
                  )}

                  {/* Content Container */}
                  <div className="relative z-10 space-y-6">
                    {/* Header Row */}
                    <div className="flex flex-wrap items-center justify-between border-b border-border/20 pb-4">
                      <div>
                        <Badge variant="secondary" className="bg-primary/20 text-primary border-none font-bold uppercase tracking-wider text-[10px] mb-2 px-2 py-0.5">
                          {viewingNote.category}
                        </Badge>
                        <h2 className="text-3xl font-bold tracking-tight">{viewingNote.title}</h2>
                      </div>
                      
                      <div className="text-xs font-semibold text-muted-foreground/80 flex flex-col items-end gap-1 mt-2 sm:mt-0">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(viewingNote.updatedAt).toLocaleDateString()}
                        </span>
                        {viewingNote.course && (
                          <span className="flex items-center gap-1 text-primary">
                            <BookOpen className="w-3.5 h-3.5" />
                            {viewingNote.course.title}
                          </span>
                        )}
                        {!viewingNote.isPersonal && viewingNote.teacherName && (
                          <span className="flex items-center gap-1 font-bold text-success">
                            👨‍🏫 Teacher: {viewingNote.teacherName}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Audio / Video Media Player if attached */}
                    {viewingNote.mediaUrl && (
                      <div className="my-4 p-4 rounded-xl bg-card/80 border border-border shadow-sm">
                        <div className="flex items-center gap-2 text-sm font-semibold text-primary mb-2">
                          {viewingNote.mediaType === 'video' ? <Radio className="w-4 h-4 text-primary" /> : <Mic className="w-4 h-4 text-primary" />}
                          {viewingNote.mediaType === 'video' ? 'Recorded Video Note' : 'Recorded Voice Memo'}
                        </div>
                        {viewingNote.mediaType === 'video' ? (
                          <video controls src={viewingNote.mediaUrl} className="w-full max-h-96 rounded-lg bg-black" />
                        ) : (
                          <audio controls src={viewingNote.mediaUrl} className="w-full h-10" />
                        )}
                      </div>
                    )}

                    {/* Paper content body */}
                    <div className={cn("text-base whitespace-pre-wrap leading-relaxed outline-none min-h-[300px]", viewingFontClass)}>
                      {viewingNote.content}
                    </div>

                    {/* Footer decoration */}
                    <div className="border-t border-border/20 pt-4 flex justify-between items-center text-xs text-muted-foreground/60">
                      <span>Organized in binder: <b className="text-foreground/70">{viewingNote.notebook}</b></span>
                      <span>Page ID: #{viewingNote.id}</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : selectedNotebook ? (
            /* VIEW 2: NOTEBOOK FOLDER CONTENT VIEW */
            <motion.div
              key="notebook-folder"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <Button 
                  variant="ghost" 
                  onClick={() => setSelectedNotebook(null)}
                  className="font-bold gap-1 hover:bg-muted"
                >
                  <ChevronLeft className="w-5 h-5" />
                  All Binders
                </Button>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="px-3 py-1 font-bold text-primary border-primary/20 bg-primary/5">
                    Binder: {selectedNotebook}
                  </Badge>
                  <Badge variant="secondary" className="px-3 py-1 font-bold text-muted-foreground">
                    {folderNotes.length} pages
                  </Badge>
                </div>
              </div>

              {folderNotes.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {folderNotes.map(note => {
                    const theme = getNotebookTheme(note.color);
                    return (
                      <Card 
                        key={note.id}
                        className="group relative cursor-pointer border border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-xl rounded-2xl flex flex-col h-72 overflow-hidden shadow-md"
                        onClick={() => {
                          setViewingNote(note);
                          // Default cursive style if they selected cursive style color/notebook
                          if (note.style === 'ruled') setViewingFontClass('font-serif italic');
                          else setViewingFontClass('font-sans');
                        }}
                      >
                        {/* Bind spiral decoration on the left margin of page */}
                        <div className="absolute left-0 top-0 bottom-0 w-4 bg-muted border-r border-border/20 z-10 flex flex-col justify-around py-3 items-center opacity-60">
                          {Array.from({ length: 10 }).map((_, i) => (
                            <div key={i} className="w-3.5 h-1.5 bg-slate-400 rounded-full border border-slate-600 transform -rotate-12" />
                          ))}
                        </div>

                        <CardHeader 
                          className="pb-3 pl-8 relative transition-colors"
                          style={{ backgroundColor: theme.bg, color: theme.text }}
                        >
                          <div className="flex items-start justify-between">
                            <Badge className="bg-primary/20 text-primary border-none text-[9px] uppercase font-bold px-2 py-0.5">
                              {note.category}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-semibold">
                              <Clock className="w-3 h-3" />
                              {new Date(note.updatedAt).toLocaleDateString()}
                            </span>
                          </div>
                          <CardTitle className="text-lg font-bold group-hover:text-primary transition-colors line-clamp-1 mt-2">
                            {note.title}
                          </CardTitle>
                        </CardHeader>
                        
                        <CardContent className="flex-1 pb-4 pt-4 pl-8 bg-card/20 overflow-hidden relative">
                          {/* Paper lines preview overlay */}
                          {note.style === 'ruled' && (
                            <div className="absolute inset-0 pointer-events-none opacity-40 pl-8">
                              <div className="w-full h-full" style={{ backgroundImage: `linear-gradient(#cbd5e1 1px, transparent 1px)`, backgroundSize: '100% 20px' }} />
                            </div>
                          )}
                          <p className="text-sm text-muted-foreground line-clamp-5 leading-relaxed relative z-10">
                            {note.content}
                          </p>
                        </CardContent>

                        <CardFooter className="pt-2 pb-3 border-t border-border/30 bg-muted/20 pl-8 py-3 flex items-center justify-between text-xs">
                          <span className="text-muted-foreground flex items-center gap-1 font-semibold">
                            {note.isShared ? <Share2 className="w-3 h-3 text-success" /> : <Lock className="w-3 h-3 text-muted-foreground/60" />}
                            {note.isShared ? 'Shared' : 'Private'}
                          </span>
                          <span className="text-primary font-bold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                            Open Page
                            <ChevronRight className="w-3.5 h-3.5" />
                          </span>
                        </CardFooter>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 px-4 bg-muted/20 border border-dashed border-border rounded-2xl">
                  <StickyNote className="w-12 h-12 text-muted-foreground/40 mb-3 animate-bounce" />
                  <h3 className="text-lg font-semibold">Notebook Empty</h3>
                  <p className="text-muted-foreground max-w-xs text-center mt-1 text-sm">
                    Rip a new sheet of paper and start adding pages to this binder!
                  </p>
                  <Button onClick={() => openModal()} variant="outline" className="mt-4 font-bold">
                    Create notebook page
                  </Button>
                </div>
              )}
            </motion.div>
          ) : (
            /* VIEW 3: MAIN LIST OF ALL BOOK COVERS */
            <motion.div
              key="notebooks-covers"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {uniqueNotebooks.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8 py-4">
                  {uniqueNotebooks.map(notebookName => {
                    const pagesInNotebook = filteredNotes.filter(n => n.notebook === notebookName);
                    const firstPageColor = pagesInNotebook[0]?.color || '#fffdf5';
                    const theme = getNotebookTheme(firstPageColor);

                    return (
                      <motion.div
                        key={notebookName}
                        whileHover={{ scale: 1.03, y: -4 }}
                        className="group cursor-pointer relative"
                        onClick={() => setSelectedNotebook(notebookName)}
                      >
                        {/* Immersive Skeuomorphic Folder Spine binding Ring Spine */}
                        <div className="absolute top-0 bottom-0 left-0 w-6 bg-gradient-to-r from-black/20 via-black/40 to-transparent z-20 rounded-l-md" />
                        
                        {/* 3D Realistic Stacked Page Spine Effect */}
                        <div className="absolute right-0 top-1 bottom-1 w-2 bg-gradient-to-r from-white via-gray-200 to-gray-300 border border-slate-300 shadow-md z-0 rounded-r-sm" />
                        <div className="absolute right-1 top-2 bottom-2 w-2 bg-gradient-to-r from-white via-gray-200 to-gray-300 border border-slate-300 shadow-md z-0 rounded-r-sm" />
                        
                        {/* Notebook hardbound cover */}
                        <div 
                          className="relative h-80 rounded-l-xl rounded-r-md border-y border-l shadow-2xl flex flex-col justify-between overflow-hidden z-10"
                          style={{
                            backgroundColor: theme.cover,
                            borderRightWidth: '4px',
                            borderRightColor: 'rgba(0,0,0,0.15)',
                            borderLeftColor: 'rgba(255,255,255,0.2)',
                            borderTopColor: 'rgba(255,255,255,0.2)',
                            borderBottomColor: 'rgba(0,0,0,0.3)',
                          }}
                        >
                          <div className="absolute inset-0 bg-white/5 mix-blend-overlay opacity-30 pointer-events-none" />
                          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/15 to-transparent pointer-events-none" />

                          {/* Top Spine ribbon */}
                          <div className="h-6 w-full opacity-70 bg-gradient-to-r from-black/20 to-black/5 flex items-center pl-8 text-[9px] font-bold text-white uppercase tracking-widest">
                            ONEREAL STUDY BINDER
                          </div>

                          {/* Realistic Composition Book Label Badge */}
                          <div className="mx-6 my-auto bg-white dark:bg-slate-900 border-2 border-slate-900 text-slate-900 dark:text-slate-100 p-4 rounded-xl shadow-lg border-dashed text-center flex flex-col justify-center min-h-[110px] z-10 transition-transform group-hover:scale-[1.02] duration-300">
                            <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase mb-1">Notebook</span>
                            <h3 className="font-heading font-extrabold text-lg line-clamp-2 leading-tight">
                              {notebookName}
                            </h3>
                            <div className="w-10 h-0.5 bg-primary/40 mx-auto my-2" />
                            <span className="text-xs font-semibold text-primary">{pagesInNotebook.length} Pages</span>
                          </div>

                          {/* Footer Course Association */}
                          <div className="p-4 pl-8 bg-black/10 flex items-center justify-between text-xs text-white/90 z-10">
                            <span className="truncate max-w-[120px] font-semibold">
                              {pagesInNotebook[0]?.course?.title || 'Personal Study'}
                            </span>
                            <Bookmark className="w-4 h-4 text-white/80 shrink-0" />
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : searchQuery ? (
                <div className="flex flex-col items-center justify-center py-24 px-4 bg-muted/20 border border-dashed border-border rounded-2xl">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <Book className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold">No match found</h3>
                  <p className="text-muted-foreground text-center max-w-sm mt-2">
                    Try adjusting your search query or clear the filter.
                  </p>
                  <Button variant="outline" className="mt-4" onClick={() => setSearchQuery('')}>Clear Search</Button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 text-xs font-semibold text-primary inline-flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                    Interactive Notebook Binders - Select a cover below to open your stationery logs and start taking notes!
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8 py-4">
                    {[
                      { name: 'My General Notes', cover: '#ecc94b', desc: 'Personal diaries, thoughts, and quick captures.', tag: 'Personal Study' },
                      { name: 'Lectures Binder', cover: '#86efac', desc: 'Subject lecture logs and coursework drafts.', tag: 'Classroom Binders' },
                      { name: 'Exam Formulas', cover: '#60a5fa', desc: 'Academic guides, code snippets, and calculations.', tag: 'Formulas & Guides' },
                    ].map(placeholder => (
                      <motion.div
                        key={placeholder.name}
                        whileHover={{ scale: 1.03, y: -4 }}
                        className="group cursor-pointer relative"
                        onClick={() => setSelectedNotebook(placeholder.name)}
                      >
                        {/* Immersive Skeuomorphic Folder Spine binding Ring Spine */}
                        <div className="absolute top-0 bottom-0 left-0 w-6 bg-gradient-to-r from-black/20 via-black/40 to-transparent z-20 rounded-l-md" />
                        
                        {/* 3D Realistic Stacked Page Spine Effect */}
                        <div className="absolute right-0 top-1 bottom-1 w-2 bg-gradient-to-r from-white via-gray-200 to-gray-300 border border-slate-300 shadow-md z-0 rounded-r-sm" />
                        <div className="absolute right-1 top-2 bottom-2 w-2 bg-gradient-to-r from-white via-gray-200 to-gray-300 border border-slate-300 shadow-md z-0 rounded-r-sm" />
                        
                        {/* Notebook hardbound cover */}
                        <div 
                          className="relative h-80 rounded-l-xl rounded-r-md border-y border-l shadow-2xl flex flex-col justify-between overflow-hidden z-10"
                          style={{
                            backgroundColor: placeholder.cover,
                            borderRightWidth: '4px',
                            borderRightColor: 'rgba(0,0,0,0.15)',
                            borderLeftColor: 'rgba(255,255,255,0.2)',
                            borderTopColor: 'rgba(255,255,255,0.2)',
                            borderBottomColor: 'rgba(0,0,0,0.3)',
                          }}
                        >
                          <div className="absolute inset-0 bg-white/5 mix-blend-overlay opacity-30 pointer-events-none" />
                          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/15 to-transparent pointer-events-none" />

                          {/* Top Spine ribbon */}
                          <div className="h-6 w-full opacity-70 bg-gradient-to-r from-black/20 to-black/5 flex items-center pl-8 text-[9px] font-bold text-white uppercase tracking-widest">
                            ONEREAL STUDY BINDER
                          </div>

                          {/* Realistic Composition Book Label Badge */}
                          <div className="mx-6 my-auto bg-white dark:bg-slate-900 border-2 border-slate-900 text-slate-900 dark:text-slate-100 p-4 rounded-xl shadow-lg border-dashed text-center flex flex-col justify-center min-h-[110px] z-10 transition-transform group-hover:scale-[1.02] duration-300">
                            <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase mb-1">Create Notebook</span>
                            <h3 className="font-heading font-extrabold text-lg line-clamp-2 leading-tight">
                              {placeholder.name}
                            </h3>
                            <div className="w-10 h-0.5 bg-primary/40 mx-auto my-2" />
                            <span className="text-xs font-semibold text-primary">0 Pages (Click to Open)</span>
                          </div>

                          {/* Footer Course Association */}
                          <div className="p-4 pl-8 bg-black/10 flex items-center justify-between text-xs text-white/90 z-10">
                            <span className="truncate max-w-[120px] font-semibold">
                              {placeholder.tag}
                            </span>
                            <Plus className="w-4 h-4 text-white/80 shrink-0" />
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Realistic Notebook Page Editor Modal */}
      <Dialog open={isModalOpen} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="w-[95vw] sm:max-w-[750px] max-h-[92vh] overflow-hidden flex flex-col p-0 border-border bg-card shadow-2xl rounded-2xl">
          <DialogHeader className="p-4 sm:p-6 pb-2 border-b border-border/50 bg-muted/10">
            <DialogTitle className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <StickyNote className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              {editingNote ? 'Edit Notebook Page' : 'Rip New Page in Binder'}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Draft notes, customize stationery backgrounds, select cursive handwritings, and organize folders.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6 scrollbar-thin">
            <div className="space-y-4">
              {/* Notebook folder & Page title */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 space-y-2">
                  <label className="text-xs font-bold text-foreground/80 flex items-center gap-1.5 uppercase tracking-wider">
                    <Edit3 className="w-3.5 h-3.5 text-primary" /> Page Title
                  </label>
                  <Input 
                    placeholder="E.g., Newton's Laws of Motion..." 
                    className="bg-muted/30 focus:bg-background border-border/60 transition-all font-bold py-5"
                    value={noteForm.title}
                    onChange={(e) => setNoteForm(prev => ({ ...prev, title: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-foreground/80 flex items-center gap-1.5 uppercase tracking-wider">
                    <Book className="w-3.5 h-3.5 text-primary" /> Binder Folder
                  </label>
                  <Input 
                    placeholder="E.g., Physics II, Math Log..." 
                    className="bg-muted/30 focus:bg-background border-border/60 transition-all font-semibold py-5"
                    value={noteForm.notebook}
                    onChange={(e) => setNoteForm(prev => ({ ...prev, notebook: e.target.value }))}
                  />
                </div>
              </div>

              {/* Theme color & style selectors */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-muted/20 p-4 rounded-xl border border-border/40">
                {/* Paper color picker */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-foreground/80 flex items-center gap-1.5 uppercase tracking-wider">
                    <Palette className="w-3.5 h-3.5 text-primary" /> Paper Color
                  </label>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {NOTEBOOK_COLORS.map(c => (
                      <button
                        key={c.bg}
                        type="button"
                        className={cn(
                          "w-6 h-6 rounded-full border border-black/10 shadow-sm relative transition-transform hover:scale-110",
                          noteForm.color === c.bg && "ring-2 ring-primary ring-offset-2 scale-110"
                        )}
                        style={{ backgroundColor: c.bg }}
                        onClick={() => setNoteForm(prev => ({ ...prev, color: c.bg }))}
                        title={c.name}
                      />
                    ))}
                  </div>
                </div>

                {/* Paper style selector */}
                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-bold text-foreground/80 flex items-center gap-1.5 uppercase tracking-wider">
                    <Bookmark className="w-3.5 h-3.5 text-primary" /> Paper Stationery Style
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {PAPER_STYLES.map(style => (
                      <button
                        key={style.id}
                        type="button"
                        className={cn(
                          "flex flex-col text-left p-2 rounded-lg border border-border/60 hover:bg-background/80 transition-all text-xs font-bold",
                          noteForm.style === style.id ? "border-primary bg-primary/5 text-primary" : "bg-muted/40 text-muted-foreground"
                        )}
                        onClick={() => setNoteForm(prev => ({ ...prev, style: style.id }))}
                      >
                        <span>{style.name}</span>
                        <span className="text-[9px] font-normal text-muted-foreground mt-0.5 line-clamp-1">{style.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Tag Category selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-foreground/80 flex items-center gap-1.5 uppercase tracking-wider">
                    <Tag className="w-3.5 h-3.5 text-primary" /> Category Tag
                  </label>
                  <select 
                    className="w-full h-10 px-3 py-2 rounded-md border border-border/60 bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none text-sm font-semibold pr-10 hover:bg-muted/50 transition-colors"
                    value={noteForm.category}
                    onChange={(e) => setNoteForm(prev => ({ ...prev, category: e.target.value }))}
                  >
                    {['Study', 'Lectures', 'Formulas', 'Homework', 'General'].map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                {/* Course sharing controls */}
                {(isTeacher || user?.role === 'super_admin') && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-foreground/80 flex items-center gap-1.5 uppercase tracking-wider">
                      <Share2 className="w-3.5 h-3.5 text-primary" /> Course Publishing Link
                    </label>
                    <select 
                      className="w-full h-10 px-3 py-2 rounded-md border border-border/60 bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none text-sm font-semibold pr-10 hover:bg-muted/50 transition-colors"
                      value={noteForm.courseId}
                      onChange={(e) => setNoteForm(prev => ({ ...prev, courseId: e.target.value, isShared: e.target.value !== '' }))}
                    >
                      <option value="">Personal Study Page (Private)</option>
                      {courses.map(course => (
                        <option key={course.id} value={course.id.toString()}>
                          🎓 Publish: {course.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Shared with student toggle */}
              {noteForm.courseId && (isTeacher || user?.role === 'super_admin') && (
                <div className="flex items-center justify-between p-3.5 bg-success/10 border border-success/20 rounded-xl">
                  <div className="space-y-0.5">
                    <label className="text-xs font-bold text-success uppercase tracking-wider flex items-center gap-1.5">
                      <Unlock className="w-3.5 h-3.5" /> Enrolled Class Publishing
                    </label>
                    <p className="text-[11px] text-success/80">
                      When enabled, students enrolled in this course will instantly read this page in their notebooks.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    className="w-5 h-5 rounded border-success/40 accent-success cursor-pointer"
                    checked={noteForm.isShared}
                    onChange={(e) => setNoteForm(prev => ({ ...prev, isShared: e.target.checked }))}
                  />
                </div>
              )}

              {/* Paper Content Body Textarea */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground/80 flex items-center gap-1.5 uppercase tracking-wider">
                  <BookOpen className="w-3.5 h-3.5 text-primary" /> Note Page Body
                </label>
                <div className="relative border border-border/60 rounded-xl overflow-hidden shadow-inner">
                  {/* Visual Left Ruled Pink margin line inside editor */}
                  {noteForm.style === 'ruled' && (
                    <div className="absolute left-7 sm:left-10 top-0 bottom-0 w-[1.5px] bg-rose-300 pointer-events-none opacity-50 z-10" />
                  )}
                  <Textarea 
                    placeholder="Write detailed notes, math formulas, key takeaways..." 
                    className={cn(
                      "min-h-[240px] sm:min-h-[280px] bg-muted/20 focus:bg-background/95 transition-all resize-none leading-relaxed p-3 sm:p-4 scrollbar-thin overflow-y-auto pl-9 sm:pl-12 border-none ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-sm sm:text-base",
                      noteForm.color === '#1e293b' ? 'text-slate-100' : 'text-slate-900'
                    )}
                    style={{ backgroundColor: noteForm.color }}
                    value={noteForm.content}
                    onChange={(e) => setNoteForm(prev => ({ ...prev, content: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            {/* Warning block about class notes */}
            {noteForm.isShared && (
              <div className="p-3 sm:p-4 bg-primary/10 rounded-xl border border-primary/20 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-primary shrink-0" />
                <p className="text-xs text-muted-foreground leading-snug font-semibold">
                  This note is being published to a Course. Any updates will sync in real-time to your enroled students' binder portals.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="p-4 sm:p-6 pt-2 border-t border-border/50 bg-muted/5 flex flex-row items-center justify-end gap-2">
            <Button variant="ghost" onClick={closeModal} className="font-bold px-4 sm:px-6">Cancel</Button>
            <Button onClick={handleCreateOrUpdate} className="font-bold px-6 sm:px-10 shadow-lg shadow-primary/20 transition-all">
              {editingNote ? 'Save binder page' : 'Rip note page'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MediaRecorderModal
        isOpen={showRecorder}
        onClose={() => setShowRecorder(false)}
        onSaved={fetchNotes}
        saveMode="note"
      />
    </div>
  );
}
