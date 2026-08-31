import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Bell, X, CheckCheck, BookOpen, FileText, MessageSquare, Calendar, Trophy, Megaphone, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Popover, PopoverContent, PopoverTrigger
} from '@/components/ui/popover';
import { subscribeToNotifications, markNotificationRead } from '@/lib/services/messageService';
import { useAuth } from '@/lib/auth-context';

export default function NotificationBell() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToNotifications(user.id as string, user.role as string, (notifs) => {
      setNotifications(notifs);
    });
    return unsub;
  }, [user]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const markRead = async (id: string) => {
    try {
      await markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch (err) {
      // Ignore
    }
  };

  const deleteNotification = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      const { deleteDoc, doc } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');
      await deleteDoc(doc(db, 'notifications', id));
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (err) {
      console.error('Failed to delete notification', err);
    }
  };

  const markAllRead = async () => {
    try {
      await api.put(`/api/messages/notifications/all/read`, {});
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (err) {
      // Ignore
    }
  };

  const typeIcon = (type: string) => {
    const t = (type || '').toLowerCase();
    if (t.includes('assignment')) return <FileText className="w-4 h-4 text-primary" />;
    if (t.includes('quiz')) return <BookOpen className="w-4 h-4 text-warning" />;
    if (t.includes('message')) return <MessageSquare className="w-4 h-4 text-info" />;
    if (t.includes('class')) return <Calendar className="w-4 h-4 text-success" />;
    if (t.includes('achievement')) return <Trophy className="w-4 h-4 text-warning" />;
    if (t.includes('announcement')) return <Megaphone className="w-4 h-4 text-primary" />;
    if (t.includes('grade')) return <BookOpen className="w-4 h-4 text-accent" />;
    return <Bell className="w-4 h-4 text-muted-foreground" />;
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 60000); // minutes
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    const hours = Math.floor(diff / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="w-4.5 h-4.5 text-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-heading font-semibold text-sm text-foreground">Notifications</h3>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="text-xs text-primary hover:underline flex items-center gap-1">
              <CheckCheck className="w-3 h-3" /> Mark all read
            </button>
          )}
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-sm">No notifications</div>
          ) : (
            notifications.map(n => (
              <div
                key={n.id}
                onClick={() => markRead(n.id)}
                className={cn(
                  'w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors border-b border-border last:border-0 relative group/item cursor-pointer',
                  !n.isRead && 'bg-primary/[0.03]'
                )}
              >
                <div className="mt-0.5">{typeIcon(n.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <p className={cn('text-sm truncate', !n.isRead ? 'font-semibold text-foreground' : 'text-foreground')}>{n.title}</p>
                      {!n.isRead && <div className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                    </div>
                    <button 
                      onClick={(e) => deleteNotification(e, n.id)}
                      className="opacity-0 group-hover/item:opacity-100 p-1 hover:bg-destructive/10 rounded-full text-muted-foreground hover:text-destructive transition-all"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{formatTime(n.createdAt)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
