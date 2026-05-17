import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Navigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';
import { Layers, BookOpen, Plus, Trash2, Edit, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
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

export default function AcademicPage() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  
  if (user?.role !== 'super_admin') return <Navigate to="/dashboard" />;
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loadingTasks, setLoadingTasks] = useState({ classes: false, subjects: false });
  const [showClassDialog, setShowClassDialog] = useState(false);
  const [showSubjectDialog, setShowSubjectDialog] = useState(false);
  const [showEditClassDialog, setShowEditClassDialog] = useState(false);
  const [activeClass, setActiveClass] = useState<any>(null);
  const [showEditSubjectDialog, setShowEditSubjectDialog] = useState(false);
  const [activeSubject, setActiveSubject] = useState<any>(null);
  const [itemToDelete, setItemToDelete] = useState<{ id: number, type: 'class' | 'subject', name: string } | null>(null);

  useEffect(() => {
    fetchClasses();
    fetchSubjects();
  }, []);

  const fetchClasses = async () => {
    try {
      setLoadingTasks(p => ({ ...p, classes: true }));
      const res = await api.get('/api/admin/classes');
      setClasses(res);
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch classes');
    } finally {
      setLoadingTasks(p => ({ ...p, classes: false }));
    }
  };

  const fetchSubjects = async () => {
    try {
      setLoadingTasks(p => ({ ...p, subjects: true }));
      const res = await api.get('/api/admin/subjects');
      setSubjects(res);
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch subjects');
    } finally {
      setLoadingTasks(p => ({ ...p, subjects: false }));
    }
  };

  const deleteClass = async (id: number) => {
    try {
      await api.delete(`/api/admin/classes/${id}`);
      toast.success('Class deleted successfully');
      fetchClasses();
      fetchSubjects();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete class');
    } finally {
      setItemToDelete(null);
    }
  };

  const deleteSubject = async (id: number) => {
    try {
      await api.delete(`/api/admin/subjects/${id}`);
      toast.success('Subject deleted successfully');
      fetchSubjects();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete subject');
    } finally {
      setItemToDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">Academic Structure</h1>
        <p className="text-muted-foreground mt-1">Manage classes and subjects for the school</p>
      </div>

      <Tabs defaultValue="classes" className="space-y-4">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="classes" className="gap-2"><Layers className="w-4 h-4"/> Classes/Grades</TabsTrigger>
          <TabsTrigger value="subjects" className="gap-2"><BookOpen className="w-4 h-4"/> Subjects</TabsTrigger>
        </TabsList>

        <TabsContent value="classes">
          <Card className="border-border">
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-heading text-lg font-semibold text-card-foreground">Classes Overview</h3>
                <Dialog open={showClassDialog} onOpenChange={setShowClassDialog}>
                  <DialogTrigger asChild>
                    <Button className="gap-2"><Plus className="w-4 h-4" /> Add Class</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle className="font-heading">Create New Class</DialogTitle></DialogHeader>
                    <CreateClassForm onClose={() => setShowClassDialog(false)} onRefresh={fetchClasses} />
                  </DialogContent>
                </Dialog>
              </div>

              {loadingTasks.classes ? (
                <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : classes.length === 0 ? (
                <div className="text-center p-8 text-muted-foreground">No classes found. Create your first class!</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {classes.map(cls => (
                    <Card key={cls.id} className="border-border bg-card hover:bg-muted/10 transition-colors">
                      <CardContent className="p-4 flex flex-col justify-between h-full">
                        <div>
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-heading font-semibold text-lg">{cls.name}</h4>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setActiveClass(cls); setShowEditClassDialog(true); }}><Edit className="w-3.5 h-3.5" /></Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0" onClick={() => setItemToDelete({ id: cls.id, type: 'class', name: cls.name })}><Trash2 className="w-3.5 h-3.5" /></Button>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">{cls.description || 'No description provided.'}</p>
                        </div>
                        <div className="mt-4 flex gap-2">
                          <Badge variant="outline" className="bg-primary/5">{cls._count?.students ?? cls.students?.length ?? 0} Students</Badge>
                          <Badge variant="outline" className="bg-accent/5">{cls._count?.subjects ?? cls.subjects?.length ?? 0} Subjects</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <Dialog open={showEditClassDialog} onOpenChange={setShowEditClassDialog}>
            <DialogContent>
              <DialogHeader><DialogTitle className="font-heading">Edit Class</DialogTitle></DialogHeader>
              {activeClass && <EditClassForm classData={activeClass} onClose={() => setShowEditClassDialog(false)} onRefresh={fetchClasses} />}
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="subjects">
          <Card className="border-border">
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-heading text-lg font-semibold text-card-foreground">Subjects Directory</h3>
                <Dialog open={showSubjectDialog} onOpenChange={setShowSubjectDialog}>
                  <DialogTrigger asChild>
                    <Button className="gap-2" disabled={classes.length === 0}><Plus className="w-4 h-4" /> Add Subject</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle className="font-heading">Create New Subject</DialogTitle></DialogHeader>
                    <CreateSubjectForm onClose={() => setShowSubjectDialog(false)} onRefresh={fetchSubjects} classes={classes} />
                  </DialogContent>
                </Dialog>
              </div>

              {loadingTasks.subjects ? (
                <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : subjects.length === 0 ? (
                <div className="text-center p-8 text-muted-foreground">No subjects found. Create your first subject!</div>
              ) : (
                <div className="space-y-3">
                  {classes.map(cls => {
                    const classSubjects = subjects.filter(s => s.classId === cls.id);
                    if (classSubjects.length === 0) return null;
                    return (
                      <div key={cls.id} className="border border-border rounded-xl overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 bg-muted/40 border-b border-border">
                          <div className="flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-primary" />
                            <span className="font-heading font-semibold text-foreground">{cls.name}</span>
                          </div>
                          <Badge variant="outline" className="bg-primary/5">{classSubjects.length} Subjects</Badge>
                        </div>
                        <div className="divide-y divide-border">
                          {classSubjects.map(sub => (
                            <div key={sub.id} className="flex items-center justify-between px-4 py-2.5 bg-card hover:bg-muted/20 transition-colors">
                              <span className="text-sm font-medium text-foreground">{sub.name}</span>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setActiveSubject(sub); setShowEditSubjectDialog(true); }}>
                                  <Edit className="w-3.5 h-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setItemToDelete({ id: sub.id, type: 'subject', name: sub.name })}>
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
          <Dialog open={showEditSubjectDialog} onOpenChange={setShowEditSubjectDialog}>
            <DialogContent>
              <DialogHeader><DialogTitle className="font-heading">Edit Subject</DialogTitle></DialogHeader>
              {activeSubject && <EditSubjectForm subjectData={activeSubject} classes={classes} onClose={() => setShowEditSubjectDialog(false)} onRefresh={fetchSubjects} />}
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!itemToDelete} onOpenChange={(open) => !open && setItemToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {itemToDelete?.type === 'class' ? (
                <>
                  This will permanently delete the class <strong>{itemToDelete.name}</strong>. 
                  All associated subjects and lessons will be removed. Students will be un-enrolled but their accounts will remain.
                </>
              ) : (
                <>
                  This will permanently delete the subject <strong>{itemToDelete?.name}</strong> and all its associated materials and quizzes.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => itemToDelete?.type === 'class' ? deleteClass(itemToDelete.id) : deleteSubject(itemToDelete!.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete {itemToDelete?.type === 'class' ? 'Class' : 'Subject'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CreateClassForm({ onClose, onRefresh }: { onClose: () => void; onRefresh: () => void }) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await api.post('/api/admin/classes', form);
      toast.success('Class created');
      onRefresh();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 pt-2">
      <div className="space-y-2"><Label>Class Name (e.g. JSS 1)</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required /></div>
      <div className="space-y-2"><Label>Description (Optional)</Label><Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
      <div className="flex justify-end gap-2 mt-4">
        <Button variant="outline" type="button" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={loading}>{loading ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Create'}</Button>
      </div>
    </form>
  );
}

function CreateSubjectForm({ onClose, onRefresh, classes }: { onClose: () => void; onRefresh: () => void; classes: any[] }) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', classId: '' });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await api.post('/api/admin/subjects', form);
      toast.success('Subject created');
      onRefresh();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 pt-2">
      <div className="space-y-2"><Label>Subject Name (e.g. Mathematics)</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required /></div>
      <div className="space-y-2">
        <Label>Assign to Class</Label>
        <Select value={form.classId} onValueChange={v => setForm(p => ({ ...p, classId: v }))}>
          <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
          <SelectContent>
            {classes.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <Button variant="outline" type="button" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={loading || !form.classId}>{loading ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Create'}</Button>
      </div>
    </form>
  );
}

function EditClassForm({ classData, onClose, onRefresh }: { classData: any; onClose: () => void; onRefresh: () => void }) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: classData.name, description: classData.description || '' });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await api.put(`/api/admin/classes/${classData.id}`, form);
      toast.success('Class updated');
      onRefresh();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 pt-2">
      <div className="space-y-2"><Label>Class Name</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required /></div>
      <div className="space-y-2"><Label>Description (Optional)</Label><Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
      <div className="flex justify-end gap-2 mt-4">
        <Button variant="outline" type="button" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={loading}>{loading ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Save Changes'}</Button>
      </div>
    </form>
  );
}

function EditSubjectForm({ subjectData, classes, onClose, onRefresh }: { subjectData: any; classes: any[]; onClose: () => void; onRefresh: () => void }) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: subjectData.name, classId: subjectData.classId?.toString() });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await api.put(`/api/admin/subjects/${subjectData.id}`, form);
      toast.success('Subject updated');
      onRefresh();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 pt-2">
      <div className="space-y-2"><Label>Subject Name</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required /></div>
      <div className="space-y-2">
        <Label>Assign to Class</Label>
        <Select value={form.classId} onValueChange={v => setForm(p => ({ ...p, classId: v }))}>
          <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
          <SelectContent>
            {classes.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <Button variant="outline" type="button" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={loading}>{loading ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Save Changes'}</Button>
      </div>
    </form>
  );
}
