import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock,
  Video, ClipboardList, HelpCircle, ExternalLink, Loader2, Filter, AlertCircle
} from 'lucide-react';
import { getLiveClasses } from '@/lib/services/settingsService';
import { getAssignments } from '@/lib/services/assignmentService';
import { getQuizzes } from '@/lib/services/quizService';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function CalendarPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [filterType, setFilterType] = useState<string>('all');

  useEffect(() => {
    fetchEvents();
  }, [user]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const [liveClasses, assignments, quizzes] = await Promise.all([
        getLiveClasses(),
        getAssignments(),
        getQuizzes()
      ]);

      const calendarEvents: any[] = [];

      liveClasses.forEach(lc => {
        calendarEvents.push({
          id: `live-${lc.id}`,
          title: lc.title,
          type: 'live_class',
          date: lc.scheduleDate,
          time: lc.scheduleTime,
          description: `Live class on Google Meet (${lc.duration} mins)`,
          link: lc.googleMeetLink,
        });
      });

      assignments.forEach(a => {
        if (a.deadline) {
          calendarEvents.push({
            id: `assign-${a.id}`,
            title: `Assignment: ${a.title}`,
            type: 'assignment',
            date: a.deadline.split('T')[0],
            time: a.deadline.includes('T') ? a.deadline.split('T')[1]?.slice(0, 5) : '23:59',
            description: a.description || 'Assignment submission due',
          });
        }
      });

      quizzes.forEach(q => {
        if (q.dueDate) {
          calendarEvents.push({
            id: `quiz-${q.id}`,
            title: `Quiz: ${q.title}`,
            type: 'quiz',
            date: q.dueDate.split('T')[0],
            time: q.dueDate.includes('T') ? q.dueDate.split('T')[1]?.slice(0, 5) : '23:59',
            description: q.instructions || `Quiz duration: ${q.duration} mins`,
          });
        }
      });

      setEvents(calendarEvents);
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch calendar events');
    } finally {
      setLoading(false);
    }
  };

  // Helper date functions
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const prevDaysInMonth = new Date(year, month, 0).getDate();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Filter events
  const filteredEvents = events.filter(event => {
    if (filterType === 'all') return true;
    return event.type === filterType;
  });

  // Helper to check if dates match (ignoring time)
  const isSameDay = (date1: Date, date2Str: string) => {
    const d1 = new Date(date1);
    const d2 = new Date(date2Str);
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  // Get events for a specific day
  const getEventsForDay = (day: number, isCurrentMonth: boolean, offsetMonth = 0) => {
    const targetDate = new Date(year, month + offsetMonth, day);
    return filteredEvents.filter(event => isSameDay(targetDate, event.date));
  };

  // Generate calendar grid array
  const calendarCells = [];

  // Previous month padding days
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const day = prevDaysInMonth - i;
    calendarCells.push({
      day,
      isCurrentMonth: false,
      offsetMonth: -1,
      events: getEventsForDay(day, false, -1)
    });
  }

  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    calendarCells.push({
      day: i,
      isCurrentMonth: true,
      offsetMonth: 0,
      events: getEventsForDay(i, true, 0)
    });
  }

  // Next month padding days to fill 6 rows (42 cells)
  const remainingCells = 42 - calendarCells.length;
  for (let i = 1; i <= remainingCells; i++) {
    calendarCells.push({
      day: i,
      isCurrentMonth: false,
      offsetMonth: 1,
      events: getEventsForDay(i, false, 1)
    });
  }

  const getEventBadgeClass = (type: string) => {
    switch (type) {
      case 'assignment':
        return 'bg-rose-500/10 text-rose-500 border-rose-500/20 hover:bg-rose-500/20';
      case 'quiz':
        return 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20 hover:bg-indigo-500/20';
      case 'live-class':
        return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20';
      default:
        return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'assignment':
        return <ClipboardList className="w-3.5 h-3.5" />;
      case 'quiz':
        return <HelpCircle className="w-3.5 h-3.5" />;
      case 'live-class':
        return <Video className="w-3.5 h-3.5" />;
      default:
        return <CalendarIcon className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Interactive Calendar</h1>
          <p className="text-muted-foreground mt-1">Manage and track quizzes, assignments, and live classes</p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-muted-foreground mr-1" />
          <Button
            variant={filterType === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType('all')}
            className="rounded-full text-xs"
          >
            All
          </Button>
          <Button
            variant={filterType === 'assignment' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType('assignment')}
            className="rounded-full text-xs gap-1 border-rose-500/20 text-rose-500 hover:bg-rose-500/5 focus:bg-rose-500/10"
          >
            <ClipboardList className="w-3 h-3" /> Assignments
          </Button>
          <Button
            variant={filterType === 'quiz' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType('quiz')}
            className="rounded-full text-xs gap-1 border-indigo-500/20 text-indigo-500 hover:bg-indigo-500/5 focus:bg-indigo-500/10"
          >
            <HelpCircle className="w-3 h-3" /> Quizzes
          </Button>
          <Button
            variant={filterType === 'live-class' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType('live-class')}
            className="rounded-full text-xs gap-1 border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/5 focus:bg-emerald-500/10"
          >
            <Video className="w-3 h-3" /> Live Classes
          </Button>
        </div>
      </div>

      {/* Calendar Controller */}
      <Card className="border-border bg-card/40 backdrop-blur-md">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={handlePrevMonth} className="h-9 w-9 rounded-lg">
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <h2 className="font-heading text-lg font-bold text-foreground min-w-[140px] text-center">
              {monthNames[month]} {year}
            </h2>
            <Button variant="outline" size="icon" onClick={handleNextMonth} className="h-9 w-9 rounded-lg">
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={handleToday} className="rounded-lg shadow-sm font-semibold">
            Today
          </Button>
        </CardContent>
      </Card>

      {/* Main Grid Calendar */}
      {loading ? (
        <div className="py-32 flex flex-col items-center justify-center text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
          <p>Loading schedule...</p>
        </div>
      ) : (
        <Card className="border-border overflow-hidden bg-card/30 backdrop-blur-sm shadow-xl">
          <CardContent className="p-0">
            {/* Days of Week Headers */}
            <div className="grid grid-cols-7 border-b border-border bg-muted/30">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
                <div key={i} className="py-3 text-center text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  {d}
                </div>
              ))}
            </div>

            {/* Grid Cells */}
            <div className="grid grid-cols-7 grid-rows-6 auto-rows-fr divide-x divide-y divide-border border-b border-border">
              {calendarCells.map((cell, idx) => {
                const isToday =
                  cell.isCurrentMonth &&
                  cell.day === new Date().getDate() &&
                  month === new Date().getMonth() &&
                  year === new Date().getFullYear();

                return (
                  <div
                    key={idx}
                    className={cn(
                      "min-h-[110px] p-2 flex flex-col transition-colors duration-200",
                      cell.isCurrentMonth ? "bg-background/20" : "bg-muted/10 opacity-40",
                      isToday && "bg-primary/5 border-2 border-primary/20"
                    )}
                  >
                    {/* Day Number */}
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={cn(
                          "text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center",
                          isToday ? "bg-primary text-primary-foreground font-black shadow-md" : "text-muted-foreground"
                        )}
                      >
                        {cell.day}
                      </span>
                      {cell.events.length > 0 && (
                        <span className="text-[10px] text-muted-foreground/60 font-medium">
                          {cell.events.length} event{cell.events.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    {/* Events list within cell */}
                    <div className="flex-1 space-y-1 overflow-y-auto max-h-[85px] scrollbar-none pr-0.5">
                      {cell.events.map((event: any) => (
                        <button
                          key={event.id}
                          onClick={() => setSelectedEvent(event)}
                          className={cn(
                            "w-full flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border text-left truncate transition-all duration-150 active:scale-95",
                            getEventBadgeClass(event.type)
                          )}
                        >
                          <span className="shrink-0">{getEventIcon(event.type)}</span>
                          <span className="truncate flex-1">{event.title}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detailed Modal */}
      <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent className="sm:max-w-md border-border bg-card/95 backdrop-blur-xl">
          {selectedEvent && (
            <div className="space-y-4">
              <DialogHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Badge className={cn("gap-1 py-0.5 px-2 text-xs border uppercase font-bold", getEventBadgeClass(selectedEvent.type))}>
                    {getEventIcon(selectedEvent.type)} {selectedEvent.type.replace('-', ' ')}
                  </Badge>
                  <span className="text-xs text-muted-foreground">•</span>
                  <span className="text-xs text-muted-foreground font-semibold flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {new Date(selectedEvent.date).toLocaleDateString(undefined, {
                      weekday: 'long',
                      month: 'short',
                      day: 'numeric'
                    })}
                    {selectedEvent.type === 'live-class' && ' at ' + new Date(selectedEvent.date).toLocaleTimeString(undefined, {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
                <DialogTitle className="font-heading text-lg font-bold text-foreground">
                  {selectedEvent.title}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-3 pt-2 text-sm">
                <p className="text-muted-foreground leading-relaxed italic">
                  "{selectedEvent.description}"
                </p>

                {/* Additional event specific details */}
                <div className="p-3.5 rounded-xl bg-muted/40 border border-border/55 space-y-2.5">
                  {selectedEvent.type === 'assignment' && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground text-xs font-semibold">Subject / Subject:</span>
                        <span className="font-bold text-xs text-foreground">{selectedEvent.courseTitle}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground text-xs font-semibold">Max Grade Score:</span>
                        <span className="font-bold text-xs text-rose-500">{selectedEvent.maxScore} points</span>
                      </div>
                    </>
                  )}

                  {selectedEvent.type === 'quiz' && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground text-xs font-semibold">Subject / Subject:</span>
                        <span className="font-bold text-xs text-foreground">{selectedEvent.courseTitle}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground text-xs font-semibold">Duration Limit:</span>
                        <span className="font-bold text-xs text-indigo-500">{selectedEvent.duration} minutes</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground text-xs font-semibold">Attempts Limit:</span>
                        <span className="font-bold text-xs text-foreground">{selectedEvent.attemptLimit} attempt(s)</span>
                      </div>
                    </>
                  )}

                  {selectedEvent.type === 'live-class' && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground text-xs font-semibold">Instructor:</span>
                        <span className="font-bold text-xs text-foreground">{selectedEvent.teacherName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground text-xs font-semibold">Assigned Class:</span>
                        <span className="font-bold text-xs text-emerald-500">{selectedEvent.className}</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Action button */}
                <div className="flex justify-end pt-3">
                  {selectedEvent.type === 'live-class' && selectedEvent.googleMeetLink && (
                    <Button
                      className="w-full gap-2 shadow-lg shadow-emerald-500/20 bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => window.open(selectedEvent.googleMeetLink, '_blank')}
                    >
                      <ExternalLink className="w-4 h-4" /> Join Google Meet
                    </Button>
                  )}
                  {selectedEvent.type === 'assignment' && (
                    <Button
                      className="w-full gap-2 shadow-lg shadow-rose-500/20 bg-rose-600 hover:bg-rose-700"
                      onClick={() => {
                        setSelectedEvent(null);
                        window.location.href = '/dashboard/assignments';
                      }}
                    >
                      <ClipboardList className="w-4 h-4" /> Go to Assignments
                    </Button>
                  )}
                  {selectedEvent.type === 'quiz' && (
                    <Button
                      className="w-full gap-2 shadow-lg shadow-indigo-500/20 bg-indigo-600 hover:bg-indigo-700"
                      onClick={() => {
                        setSelectedEvent(null);
                        window.location.href = '/dashboard/quizzes';
                      }}
                    >
                      <HelpCircle className="w-4 h-4" /> Go to Quizzes
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
