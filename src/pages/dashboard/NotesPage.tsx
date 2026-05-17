import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { 
  Plus, Search, StickyNote, Trash2, Edit3, 
  ChevronRight, Calendar, Tag, MoreVertical,
  Filter, BookOpen, Clock, AlertCircle, FileText
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
import { api } from '@/lib/api';
import { TTSButton } from '@/components/ui/TTSButton';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

interface Note {
  id: number;
  userId: number;
  title: string;
  content: string;
  category: string;
  createdAt: string;
  updatedAt: string;
}

const CATEGORIES = ['General', 'Study', 'Research', 'Review', 'Personal'];

export default function NotesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [noteForm, setNoteForm] = useState({ title: '', content: '', category: 'General' });

  useEffect(() => {
    fetchNotes();
  }, []);

  const fetchNotes = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/api/notes');
      setNotes(response);
    } catch (error) {
      console.error('Fetch notes error:', error);
      toast({
        title: 'Error',
        description: 'Failed to load your notes.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateOrUpdate = async () => {
    if (!noteForm.title.trim() || !noteForm.content.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Title and content are required.',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (editingNote) {
        const response = await api.put(`/api/notes/${editingNote.id}`, noteForm);
        setNotes(prev => prev.map(n => n.id === editingNote.id ? response : n));
        toast({ title: 'Success', description: 'Note updated successfully.' });
      } else {
        const response = await api.post('/api/notes', noteForm);
        setNotes(prev => [response, ...prev]);
        toast({ title: 'Success', description: 'Note created successfully.' });
      }
      closeModal();
    } catch (error) {
      console.error('Save note error:', error);
      toast({
        title: 'Error',
        description: 'Failed to save note.',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/api/notes/${id}`);
      setNotes(prev => prev.filter(n => n.id !== id));
      toast({ title: 'Success', description: 'Note deleted permanently.' });
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: 'Error',
        description: 'Could not delete note.',
        variant: 'destructive',
      });
    }
  };

  const openModal = (note?: Note) => {
    if (note) {
      setEditingNote(note);
      setNoteForm({ title: note.title, content: note.content, category: note.category });
    } else {
      setEditingNote(null);
      setNoteForm({ title: '', content: '', category: 'General' });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingNote(null);
    setNoteForm({ title: '', content: '', category: 'General' });
  };

  const handleDownloadPDF = (note: Note) => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(22);
    doc.setTextColor(99, 102, 241); // Primary color
    doc.text('LMS Study Notes', 20, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, 20, 28);
    
    doc.setDrawColor(226, 232, 240);
    doc.line(20, 32, 190, 32);
    
    // Title
    doc.setFontSize(18);
    doc.setTextColor(30, 41, 59);
    doc.text(note.title, 20, 45);
    
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184);
    doc.text(`Category: ${note.category}`, 20, 52);
    
    // Content
    doc.setFontSize(12);
    doc.setTextColor(51, 65, 85);
    const splitText = doc.splitTextToSize(note.content, 170);
    doc.text(splitText, 20, 65);
    
    // Save
    doc.save(`${note.title.replace(/\s+/g, '_')}_notes.pdf`);
    
    toast({
      title: 'Success',
      description: 'PDF downloaded successfully.',
    });
  };

  const filteredNotes = notes.filter(note => {
    const matchesSearch = note.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         note.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || note.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">My Personal Notes</h1>
          <p className="text-muted-foreground mt-1">Organize your thoughts, study materials, and research in one place.</p>
        </div>
        <Button onClick={() => openModal()} className="shadow-lg hover:shadow-primary/20 transition-all font-semibold">
          <Plus className="w-5 h-5 mr-2" />
          Create New Note
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 bg-card/50 p-4 rounded-xl border border-border shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search through your notes..." 
            className="pl-10 bg-background/50 border-border/50 focus:bg-background transition-colors"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <Badge 
            variant={selectedCategory === null ? 'default' : 'outline'}
            className="cursor-pointer px-3 py-1 text-xs shrink-0"
            onClick={() => setSelectedCategory(null)}
          >
            All
          </Badge>
          {CATEGORIES.map(cat => (
            <Badge 
              key={cat}
              variant={selectedCategory === cat ? 'default' : 'outline'}
              className="cursor-pointer px-3 py-1 text-xs shrink-0"
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </Badge>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse bg-card/40 border-border/40">
              <div className="h-40" />
            </Card>
          ))}
        </div>
      ) : filteredNotes.length > 0 ? (
        <motion.div 
          layout
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          <AnimatePresence>
            {filteredNotes.map((note) => (
              <motion.div
                key={note.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                layout
              >
                <Card className="group hover:border-primary/50 transition-all duration-300 shadow-md hover:shadow-lg bg-card/80 backdrop-blur-sm h-full flex flex-col">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <Badge variant="secondary" className="mb-2 bg-primary/10 text-primary hover:bg-primary/20 border-none">
                        {note.category}
                      </Badge>
                      <div className="flex items-center gap-1">
                        <TTSButton text={note.content} className="h-8 w-8" />
                        <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40 border-border shadow-xl">
                          <DropdownMenuItem onClick={() => openModal(note)} className="cursor-pointer gap-2">
                            <Edit3 className="w-4 h-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDownloadPDF(note)} className="cursor-pointer gap-2">
                            <FileText className="w-4 h-4" /> Download PDF
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => handleDelete(note.id)} 
                            className="text-destructive focus:text-destructive cursor-pointer gap-2"
                          >
                            <Trash2 className="w-4 h-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                    <CardTitle className="text-xl group-hover:text-primary transition-colors line-clamp-1">{note.title}</CardTitle>
                    <CardDescription className="flex items-center gap-1.5 text-xs font-medium mt-1">
                      <Clock className="w-3.2 h-3.2" />
                      {new Date(note.updatedAt).toLocaleDateString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 pb-4">
                    <p className="text-sm text-muted-foreground line-clamp-4 leading-relaxed">
                      {note.content}
                    </p>
                  </CardContent>
                  <CardFooter className="pt-0 border-t border-border/30 bg-muted/5 py-4">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="w-full justify-between text-xs font-semibold hover:bg-primary/5 hover:text-primary transition-all group/btn"
                      onClick={() => openModal(note)}
                    >
                      View Full Note
                      <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 px-4 bg-muted/20 border border-dashed border-border rounded-2xl">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <StickyNote className="w-8 h-8 text-muted-foreground/50" />
          </div>
          <h3 className="text-xl font-semibold">No notes found</h3>
          <p className="text-muted-foreground text-center max-w-xs mt-2">
            {searchQuery || selectedCategory ? 'Try adjusting your search or filters.' : 'Start your journey by creating your first personal note!'}
          </p>
          {!searchQuery && !selectedCategory && (
            <Button onClick={() => openModal()} variant="outline" className="mt-6 font-semibold">
              Create My First Note
            </Button>
          )}
        </div>
      )}

      {/* Note Editor Modal */}
      <Dialog open={isModalOpen} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-hidden flex flex-col p-0 border-border bg-card shadow-2xl">
          <DialogHeader className="p-6 pb-2 border-b border-border/50">
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <StickyNote className="w-6 h-6 text-primary" />
              {editingNote ? 'Edit Note' : 'Create New Personal Note'}
            </DialogTitle>
            <DialogDescription>
              {editingNote ? 'Make changes to your existing note. Updates are saved immediately.' : 'Fill in the details below to create a new personal note.'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground/80 flex items-center gap-1.5">
                    <Edit3 className="w-3.5 h-3.5" /> Title
                  </label>
                  <Input 
                    placeholder="Enter a descriptive title..." 
                    className="bg-muted/30 focus:bg-background border-border/60 transition-all font-medium py-5"
                    value={noteForm.title}
                    onChange={(e) => setNoteForm(prev => ({ ...prev, title: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground/80 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5" /> Category
                  </label>
                  <div className="relative">
                    <select 
                      className="w-full h-10 px-3 py-2 rounded-md border border-border/60 bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none text-sm font-medium pr-10 hover:bg-muted/50 transition-colors"
                      value={noteForm.category}
                      onChange={(e) => setNoteForm(prev => ({ ...prev, category: e.target.value }))}
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground rotate-90 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground/80 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5" /> Content
                </label>
                <Textarea 
                  placeholder="Write your note here using plain text or Markdown..." 
                  className="min-h-[250px] bg-muted/30 focus:bg-background border-border/60 transition-all resize-none leading-relaxed p-4 scrollbar-thin overflow-y-auto"
                  value={noteForm.content}
                  onChange={(e) => setNoteForm(prev => ({ ...prev, content: e.target.value }))}
                />
              </div>
            </div>
            
            <div className="p-4 bg-muted/30 rounded-xl border border-border/40 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-primary shrink-0" />
              <p className="text-xs text-muted-foreground leading-snug">
                Your notes are private and only visible to you. They are securely stored on our servers and can be accessed from any device.
              </p>
            </div>
          </div>

          <DialogFooter className="p-6 pt-2 border-t border-border/50 bg-muted/5">
            <Button variant="ghost" onClick={closeModal} className="font-semibold px-6">Cancel</Button>
            <Button onClick={handleCreateOrUpdate} className="font-bold px-10 shadow-lg shadow-primary/20 transition-all">
              {editingNote ? 'Save Changes' : 'Create Note'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
