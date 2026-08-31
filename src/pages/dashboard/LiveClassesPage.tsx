import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Video, Clock, Users, ExternalLink, Calendar, CheckCircle, Loader2, Trash2, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getLiveClasses, createLiveClass, updateLiveClass, deleteLiveClass } from '@/lib/services/settingsService';
import { getClasses } from '@/lib/services/academicService';
import { toast } from 'sonner';

export default function LiveClassesPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'super_admin' || user?.role === 'teacher';
  const isStudent = user?.role === 'student';
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [myCourses, setMyCourses] = useState<any[]>([]);
  const [myClasses, setMyClasses] = useState<any[]>([]);
  const [form, setForm] = useState({ title: '', classId: '', meetLink: '', date: '', time: '', duration: '60' });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchClasses();
    if (canManage) {
      getClasses().then(setMyClasses).catch(() => {});
    }
  }, [user]);

  const fetchClasses = async () => {
    try {
      setLoading(true);
      const res = await getLiveClasses();
      setClasses(res);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCreating(true);
      const data = {
        title: form.title,
        classId: form.classId,
        googleMeetLink: form.meetLink,
        scheduleDate: form.date,
        scheduleTime: form.time,
        duration: form.duration,
      };

      if (editingId) {
        await updateLiveClass(String(editingId), data as any);
        toast.success('Live class updated!');
      } else {
        await createLiveClass({ ...data, teacherId: user?.id as string, teacherName: user?.fullName as string, duration: Number(data.duration) } as any);
        toast.success('Live class scheduled!');
      }

      setShowCreate(false);
      setEditingId(null);
      setForm({ title: '', classId: '', meetLink: '', date: '', time: '', duration: '60' });
      fetchClasses();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleEdit = (cls: any) => {
    setEditingId(cls.id);
    setForm({
      title: cls.title,
      classId: cls.classId.toString(),
      meetLink: cls.googleMeetLink,
      date: new Date(cls.scheduleDate).toISOString().split('T')[0],
      time: cls.scheduleTime,
      duration: cls.duration.toString(),
    });
    setShowCreate(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to cancel and delete this live class?')) return;
    try {
      await deleteLiveClass(id);
      toast.success('Live class cancelled');
      fetchClasses();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const getStatus = (cls: any) => {
    const now = new Date();
    const schedDate = new Date(cls.scheduleDate);
    const [h, m] = (cls.scheduleTime || '00:00').split(':').map(Number);
    schedDate.setHours(h, m, 0, 0);
    const endDate = new Date(schedDate.getTime() + (cls.duration || 60) * 60000);
    if (now >= schedDate && now <= endDate) return 'live';
    if (now > endDate) return 'completed';
    return 'upcoming';
  };

  const getCountdown = (cls: any) => {
    const now = new Date();
    const schedDate = new Date(cls.scheduleDate);
    const [h, m] = (cls.scheduleTime || '00:00').split(':').map(Number);
    schedDate.setHours(h, m, 0, 0);
    const diff = schedDate.getTime() - now.getTime();
    if (diff <= 0) return '';
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
    return `${hours}h ${mins}m`;
  };

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      live: 'bg-success/10 text-success border-success/20 animate-pulse',
      upcoming: 'bg-info/10 text-info border-info/20',
      completed: 'bg-muted text-muted-foreground border-border',
    };
    return <Badge variant="outline" className={cn('font-medium capitalize', styles[status])}>{status === 'live' ? '🔴 Live Now' : status}</Badge>;
  };

  const upcoming = classes.filter(c => getStatus(c) === 'upcoming');
  const live = classes.filter(c => getStatus(c) === 'live');
  const completed = classes.filter(c => getStatus(c) === 'completed');

  const renderClass = (cls: any) => {
    const status = getStatus(cls);
    const countdown = getCountdown(cls);

    return (
      <Card key={cls.id} className={cn('border-border hover:shadow-md transition-all', status === 'live' && 'ring-2 ring-success/30')}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1">
              <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
                status === 'live' ? 'bg-success/10' : status === 'upcoming' ? 'bg-primary/10' : 'bg-muted')}>
                <Video className={cn('w-5 h-5', status === 'live' ? 'text-success' : status === 'upcoming' ? 'text-primary' : 'text-muted-foreground')} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-heading font-semibold text-card-foreground">{cls.title}</h3>
                  {statusBadge(status)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {cls.class?.name || 'Class'} · {cls.teacher?.user?.name || 'Teacher'}
                </p>
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(cls.scheduleDate).toLocaleDateString()}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {cls.scheduleTime} · {cls.duration}min</span>
                </div>
                {countdown && (
                  <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary/5 rounded-md">
                    <Clock className="w-3 h-3 text-primary" />
                    <span className="text-xs font-medium text-primary">Starts in {countdown}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="shrink-0 flex flex-col gap-2">
              {status === 'live' && (
                <Button size="sm" className="gap-2 w-full" onClick={() => window.open(cls.googleMeetLink, '_blank')}>
                  <ExternalLink className="w-3.5 h-3.5" /> Join Now
                </Button>
              )}
              {status === 'upcoming' && (
                <Button size="sm" variant="outline" className="gap-2 w-full" disabled>
                  <Clock className="w-3.5 h-3.5" /> Not Started
                </Button>
              )}
              {status === 'completed' && (
                <Button size="sm" variant="ghost" className="gap-2 w-full">
                  <CheckCircle className="w-3.5 h-3.5" /> Completed
                </Button>
              )}
              {canManage && (
                <div className="flex flex-col gap-2">
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-primary hover:bg-primary/10" onClick={() => handleEdit(cls)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(cls.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              )}
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
          <h1 className="font-heading text-2xl font-bold text-foreground">Live Classes</h1>
          <p className="text-muted-foreground mt-1">
            {loading ? 'Loading...' : `${upcoming.length} upcoming, ${live.length} live now`}
          </p>
        </div>
        {canManage && (
          <Dialog open={showCreate} onOpenChange={(open) => {
            setShowCreate(open);
            if (!open) {
              setEditingId(null);
              setForm({ title: '', classId: '', meetLink: '', date: '', time: '', duration: '60' });
            }
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="w-4 h-4" /> Schedule Class</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle className="font-heading">{editingId ? 'Edit Live Class' : 'Schedule Live Class'}</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 py-2">
                <div className="space-y-2"><Label>Title</Label><Input value={form.title} onChange={e => setForm(p => ({...p, title: e.target.value}))} required /></div>
                <div className="space-y-2">
                  <Label>Class</Label>
                  <Select value={form.classId} onValueChange={v => setForm(p => ({...p, classId: v}))}>
                    <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                    <SelectContent>
                      {myClasses.map((c: any) => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Google Meet Link</Label><Input type="url" value={form.meetLink} onChange={e => setForm(p => ({...p, meetLink: e.target.value}))} required /></div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2"><Label>Date</Label><Input type="date" value={form.date} onChange={e => setForm(p => ({...p, date: e.target.value}))} required /></div>
                  <div className="space-y-2"><Label>Time</Label><Input type="time" value={form.time} onChange={e => setForm(p => ({...p, time: e.target.value}))} required /></div>
                  <div className="space-y-2"><Label>Duration (min)</Label><Input type="number" value={form.duration} onChange={e => setForm(p => ({...p, duration: e.target.value}))} /></div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                  <Button type="submit" disabled={creating}>
                    {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    {editingId ? 'Update Class' : 'Schedule'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? (
        <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : (
        <>
          {live.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-heading text-lg font-semibold text-foreground flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-success animate-pulse" /> Live Now
              </h2>
              {live.map(renderClass)}
            </div>
          )}

          <div className="space-y-3">
            <h2 className="font-heading text-lg font-semibold text-foreground">Upcoming</h2>
            {upcoming.length === 0 ? (
              <Card className="border-border"><CardContent className="p-6 text-center text-muted-foreground">No upcoming classes scheduled yet</CardContent></Card>
            ) : upcoming.map(renderClass)}
          </div>

          <div className="space-y-3">
            <h2 className="font-heading text-lg font-semibold text-foreground">Completed</h2>
            {completed.length === 0 ? (
              <Card className="border-border"><CardContent className="p-6 text-center text-muted-foreground">No completed classes yet</CardContent></Card>
            ) : completed.map(renderClass)}
          </div>
        </>
      )}
    </div>
  );
}
