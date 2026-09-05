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
import { Plus, Megaphone, Pin, Users, Trash2, Search, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createNotification, subscribeToNotifications } from '@/lib/services/messageService';
import { toast } from 'sonner';

export default function AnnouncementsPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'super_admin' || user?.role === 'teacher';
  const isAdmin = user?.role === 'super_admin';
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ title: '', content: '', target: 'all' });

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const timeout = setTimeout(() => setLoading(false), 3000);
    const unsub = subscribeToNotifications(user.id as string, user.role as string, (notifs) => {
      setAnnouncements(notifs);
      setLoading(false);
      clearTimeout(timeout);
    });
    return () => {
      clearTimeout(timeout);
      unsub();
    };
  }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) return toast.error('Please enter title and message.');
    try {
      setCreating(true);
      const isTargetAll = form.target === 'all';
      await createNotification({
        title: form.title.trim(),
        message: form.content.trim(),
        type: 'ANNOUNCEMENT',
        isGlobal: isTargetAll,
        targetRole: isTargetAll ? undefined : form.target,
        userId: String(user?.id || ''),
      });
      toast.success('Announcement published successfully!');
      setShowCreate(false);
      setForm({ title: '', content: '', target: 'all' });
    } catch (err: any) {
      toast.error(err.message || 'Failed to publish announcement');
    } finally {
      setCreating(false);
    }
  };

  const deleteAnnouncement = async (id: string) => {
    try {
      const { deleteDoc, doc } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');
      await deleteDoc(doc(db, 'notifications', id));
      toast.success('Deleted announcement');
      setAnnouncements(prev => prev.filter(a => a.id !== id));
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const filtered = announcements.filter(a =>
    (a.title || '').toLowerCase().includes(search.toLowerCase()) ||
    (a.message || '').toLowerCase().includes(search.toLowerCase())
  );

  const renderAnnouncement = (a: any) => {
    const isForEveryone = a.isGlobal || !a.targetRole || a.targetRole === 'all';
    const targetLabel = isForEveryone ? 'Everyone' : a.targetRole.toLowerCase().includes('teacher') ? 'Teachers' : 'Students';
    
    return (
      <Card key={a.id} className={cn('border-border hover:shadow-md transition-all', isForEveryone && 'ring-1 ring-primary/20 bg-primary/[0.02]')}>
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', isForEveryone ? 'bg-primary/10' : 'bg-muted')}>
              {isForEveryone ? <Pin className="w-5 h-5 text-primary" /> : <Megaphone className="w-5 h-5 text-muted-foreground" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-heading font-semibold text-card-foreground">{a.title}</h3>
                    <Badge variant="outline" className={cn("text-[10px] font-bold px-2 py-0.5", 
                      isForEveryone ? "bg-primary/10 text-primary border-primary/20" : "bg-info/10 text-info border-info/20"
                    )}>
                      {targetLabel}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground/80">{a.authorName || a.user?.name || 'Administrator'}</span>
                    <span>·</span>
                    <span>{new Date(a.createdAt || Date.now()).toLocaleDateString()}</span>
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => deleteAnnouncement(a.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-3 leading-relaxed whitespace-pre-wrap">{a.message}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Announcements</h1>
          <p className="text-muted-foreground mt-1">{loading ? 'Loading...' : `${announcements.length} announcements`}</p>
        </div>
        {canManage && (
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="w-4 h-4" /> New Announcement</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle className="font-heading">Create Announcement</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4 py-2">
                <div className="space-y-2"><Label>Title</Label><Input value={form.title} onChange={e => setForm(p => ({...p, title: e.target.value}))} required /></div>
                <div className="space-y-2"><Label>Content</Label><Textarea rows={4} value={form.content} onChange={e => setForm(p => ({...p, content: e.target.value}))} required /></div>
                {isAdmin && (
                  <div className="space-y-2">
                    <Label>Target Audience</Label>
                    <Select value={form.target} onValueChange={v => setForm(p => ({...p, target: v}))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Everyone</SelectItem>
                        <SelectItem value="teachers">Teachers Only</SelectItem>
                        <SelectItem value="students">Students Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                  <Button type="submit" disabled={creating}>
                    {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}Publish
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search announcements..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {loading ? (
        <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <Card className="border-border"><CardContent className="p-8 text-center text-muted-foreground">No announcements found</CardContent></Card>
          ) : (
            filtered.map(renderAnnouncement)
          )}
        </div>
      )}
    </div>
  );
}
