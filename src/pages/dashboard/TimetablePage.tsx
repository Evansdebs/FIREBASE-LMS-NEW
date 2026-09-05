import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  getClasses, getSubjects, getCourses, getTimetable,
  createTimetableEntry, updateTimetableEntry,
  deleteTimetableEntry, TimetableEntry, ClassDoc, SubjectDoc
} from '@/lib/services/academicService';
import { getUsersByRole, UserProfile } from '@/lib/services/userService';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Edit, Clock, MapPin, User, Grid, Loader2, Calendar, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

// --- THEME COLOR MAP FOR SUBJECTS ---
const SUBJECT_COLORS: Record<string, { bg: string, text: string, border: string, glow: string }> = {
  math: { 
    bg: 'bg-blue-500/10 dark:bg-blue-500/20', 
    text: 'text-blue-600 dark:text-blue-400', 
    border: 'border-blue-500/30', 
    glow: 'shadow-[0_0_15px_rgba(59,130,246,0.25)] border-blue-500/60 dark:border-blue-400/60' 
  },
  science: { 
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/20', 
    text: 'text-emerald-600 dark:text-emerald-400', 
    border: 'border-emerald-500/30', 
    glow: 'shadow-[0_0_15px_rgba(16,185,129,0.25)] border-emerald-500/60 dark:border-emerald-400/60' 
  },
  physics: { 
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/20', 
    text: 'text-emerald-600 dark:text-emerald-400', 
    border: 'border-emerald-500/30', 
    glow: 'shadow-[0_0_15px_rgba(16,185,129,0.25)] border-emerald-500/60 dark:border-emerald-400/60' 
  },
  chemistry: { 
    bg: 'bg-teal-500/10 dark:bg-teal-500/20', 
    text: 'text-teal-600 dark:text-teal-400', 
    border: 'border-teal-500/30', 
    glow: 'shadow-[0_0_15px_rgba(20,184,166,0.25)] border-teal-500/60 dark:border-teal-400/60' 
  },
  biology: { 
    bg: 'bg-green-500/10 dark:bg-green-500/20', 
    text: 'text-green-600 dark:text-green-400', 
    border: 'border-green-500/30', 
    glow: 'shadow-[0_0_15px_rgba(34,197,94,0.25)] border-green-500/60 dark:border-green-400/60' 
  },
  english: { 
    bg: 'bg-purple-500/10 dark:bg-purple-500/20', 
    text: 'text-purple-600 dark:text-purple-400', 
    border: 'border-purple-500/30', 
    glow: 'shadow-[0_0_15px_rgba(168,85,247,0.25)] border-purple-500/60 dark:border-purple-400/60' 
  },
  history: { 
    bg: 'bg-amber-500/10 dark:bg-amber-500/20', 
    text: 'text-amber-600 dark:text-amber-400', 
    border: 'border-amber-500/30', 
    glow: 'shadow-[0_0_15px_rgba(245,158,11,0.25)] border-amber-500/60 dark:border-amber-400/60' 
  },
  geography: { 
    bg: 'bg-sky-500/10 dark:bg-sky-500/20', 
    text: 'text-sky-600 dark:text-sky-400', 
    border: 'border-sky-500/30', 
    glow: 'shadow-[0_0_15px_rgba(14,165,233,0.25)] border-sky-500/60 dark:border-sky-400/60' 
  },
  art: { 
    bg: 'bg-rose-500/10 dark:bg-rose-500/20', 
    text: 'text-rose-600 dark:text-rose-400', 
    border: 'border-rose-500/30', 
    glow: 'shadow-[0_0_15px_rgba(244,63,94,0.25)] border-rose-500/60 dark:border-rose-400/60' 
  },
  music: { 
    bg: 'bg-pink-500/10 dark:bg-pink-500/20', 
    text: 'text-pink-600 dark:text-pink-400', 
    border: 'border-pink-500/30', 
    glow: 'shadow-[0_0_15px_rgba(236,72,153,0.25)] border-pink-500/60 dark:border-pink-400/60' 
  },
};

function getSubjectStyles(subjectName: string) {
  const name = subjectName.toLowerCase();
  for (const key in SUBJECT_COLORS) {
    if (name.includes(key)) return SUBJECT_COLORS[key];
  }
  // Default Indigo style
  return {
    bg: 'bg-indigo-500/10 dark:bg-indigo-500/20',
    text: 'text-indigo-600 dark:text-indigo-400',
    border: 'border-indigo-500/30',
    glow: 'shadow-[0_0_15px_rgba(99,102,241,0.25)] border-indigo-500/60 dark:border-indigo-400/60'
  };
}

const DAYS = [
  { value: 'MONDAY', label: 'Monday' },
  { value: 'TUESDAY', label: 'Tuesday' },
  { value: 'WEDNESDAY', label: 'Wednesday' },
  { value: 'THURSDAY', label: 'Thursday' },
  { value: 'FRIDAY', label: 'Friday' },
  { value: 'SATURDAY', label: 'Saturday' },
  { value: 'SUNDAY', label: 'Sunday' },
];

export default function TimetablePage() {
  const { user } = useAuth();
  const isTeacherOrAdmin = user?.role === 'teacher' || user?.role === 'super_admin';

  // --- STATE ---
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configData, setConfigData] = useState<{ classes: any[], teachers: any[] }>({ classes: [], teachers: [] });
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [timetable, setTimetable] = useState<any[]>([]);
  const [showWeekends, setShowWeekends] = useState(false);
  const [selectedMobileDay, setSelectedMobileDay] = useState<string>('ALL');

  // Dialog State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<any | null>(null);

  // Form State
  const [formDay, setFormDay] = useState('MONDAY');
  const [formSubjectId, setFormSubjectId] = useState('');
  const [formTeacherId, setFormTeacherId] = useState('');
  const [formStartTime, setFormStartTime] = useState('08:00');
  const [formEndTime, setFormEndTime] = useState('09:00');
  const [formRoom, setFormRoom] = useState('');

  // Clock
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const currentDayOfWeekStr = useMemo(() => {
    const map = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    return map[currentTime.getDay()];
  }, [currentTime]);

  const currentTimeInMinutes = useMemo(() => {
    return currentTime.getHours() * 60 + currentTime.getMinutes();
  }, [currentTime]);

  const isCurrentSlot = (entry: any) => {
    if (entry.dayOfWeek !== currentDayOfWeekStr) return false;
    const [startH, startM] = entry.startTime.split(':').map(Number);
    const [endH, endM] = entry.endTime.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    return currentTimeInMinutes >= startMinutes && currentTimeInMinutes <= endMinutes;
  };

  // --- FETCH CONFIG & DATA ---
  useEffect(() => {
    if (isTeacherOrAdmin) {
      fetchConfig();
    } else {
      fetchStudentTimetable();
    }
  }, [isTeacherOrAdmin, user]);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const [classes, subjects, courses, teachers] = await Promise.all([
        getClasses(),
        getSubjects().catch(() => []),
        getCourses().catch(() => []),
        getUsersByRole('teacher').catch(() => [])
      ]);

      const classesWithSubjects = classes.map(c => {
        const classSubs = subjects.filter(s => s.classId === c.id);
        const subjectList = classSubs.length > 0 ? classSubs : (
          courses.length > 0 
            ? courses.map(co => ({ id: co.id, name: co.title || (co as any).name || 'Course', classId: c.id }))
            : subjects
        );
        return {
          ...c,
          subjects: subjectList
        };
      });

      setConfigData({ classes: classesWithSubjects, teachers });
      
      if (classesWithSubjects.length > 0) {
        setSelectedClassId(classesWithSubjects[0].id.toString());
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load configuration lists.');
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentTimetable = async () => {
    try {
      setLoading(true);
      let targetClassId = user?.classId;
      if (!targetClassId && user?.className) {
        const allClasses = await getClasses();
        const found = allClasses.find(c => c.name.toLowerCase() === user.className?.toLowerCase());
        if (found) targetClassId = found.id;
      }
      if (targetClassId) {
        const res = await getTimetable(String(targetClassId));
        setTimetable(res);
      } else {
        setTimetable([]);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load student timetable.');
    } finally {
      setLoading(false);
    }
  };

  const fetchClassTimetable = async (classId: string) => {
    if (!classId) return;
    try {
      setLoading(true);
      const res = await getTimetable(classId);
      setTimetable(res);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load timetable entries.');
    } finally {
      setLoading(false);
    }
  };

  // Reload timetable when selected class changes
  useEffect(() => {
    if (isTeacherOrAdmin && selectedClassId) {
      fetchClassTimetable(selectedClassId);
    }
  }, [selectedClassId, isTeacherOrAdmin]);

  // Subjects for the currently selected class
  const classSubjects = useMemo(() => {
    if (!isTeacherOrAdmin || !selectedClassId) return [];
    const cls = configData.classes.find(c => c.id.toString() === selectedClassId);
    return cls?.subjects || [];
  }, [selectedClassId, configData.classes, isTeacherOrAdmin]);

  // Group entries by Day of the Week
  const timetableByDay = useMemo(() => {
    const groups: Record<string, any[]> = {
      MONDAY: [],
      TUESDAY: [],
      WEDNESDAY: [],
      THURSDAY: [],
      FRIDAY: [],
      SATURDAY: [],
      SUNDAY: [],
    };
    timetable.forEach(entry => {
      if (groups[entry.dayOfWeek]) {
        groups[entry.dayOfWeek].push(entry);
      }
    });

    Object.keys(groups).forEach(day => {
      groups[day].sort((a, b) => a.startTime.localeCompare(b.startTime));
    });

    return groups;
  }, [timetable]);

  // --- CRUD ACTIONS ---
  const handleOpenAddDialog = () => {
    setEditingEntry(null);
    setFormDay('MONDAY');
    setFormSubjectId(classSubjects[0]?.id || '');
    setFormTeacherId('');
    setFormStartTime('08:00');
    setFormEndTime('09:00');
    setFormRoom('');
    setDialogOpen(true);
  };

  const handleOpenEditDialog = (entry: any) => {
    setEditingEntry(entry);
    setFormDay(entry.dayOfWeek);
    setFormSubjectId(entry.subjectId);
    setFormTeacherId(entry.teacherId || '');
    setFormStartTime(entry.startTime);
    setFormEndTime(entry.endTime);
    setFormRoom(entry.room || '');
    setDialogOpen(true);
  };

  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSubjectId) {
      toast.warning('Please select a subject.');
      return;
    }

    try {
      setSaving(true);
      const effectiveTeacherId = formTeacherId && formTeacherId !== '__none__' ? formTeacherId : undefined;
      const subj = classSubjects.find(s => s.id === formSubjectId);
      const teacher = configData.teachers.find(t => t.id === effectiveTeacherId);

      const payload: any = {
        classId: selectedClassId,
        subjectId: formSubjectId,
        subjectName: subj?.name || '',
        teacherId: effectiveTeacherId,
        teacherName: teacher?.fullName || teacher?.name || '',
        dayOfWeek: formDay,
        startTime: formStartTime,
        endTime: formEndTime,
        room: formRoom || undefined
      };

      if (editingEntry) {
        await updateTimetableEntry(editingEntry.id, payload);
        toast.success('Timetable period updated successfully!');
      } else {
        await createTimetableEntry(payload);
        toast.success('Timetable period added successfully!');
      }

      setDialogOpen(false);
      fetchClassTimetable(selectedClassId);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save timetable slot.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!confirm('Are you sure you want to remove this timetable slot?')) return;
    try {
      await deleteTimetableEntry(entryId);
      toast.success('Slot removed successfully.');
      fetchClassTimetable(selectedClassId);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete timetable entry.');
    }
  };

  // --- FILTERED DAYS FOR GRID ---
  const displayedDays = useMemo(() => {
    return showWeekends 
      ? DAYS 
      : DAYS.filter(d => d.value !== 'SATURDAY' && d.value !== 'SUNDAY');
  }, [showWeekends]);

  const daysToRender = useMemo(() => {
    if (selectedMobileDay === 'ALL') return displayedDays;
    return displayedDays.filter(d => d.value === selectedMobileDay);
  }, [displayedDays, selectedMobileDay]);

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header section with modern glassmorphism touch */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card/60 backdrop-blur-md p-4 sm:p-6 rounded-2xl border border-border/80 shadow-sm">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-indigo-500 to-emerald-500 bg-clip-text text-transparent flex items-center gap-2">
            <Grid className="w-7 h-7 sm:w-8 sm:h-8 text-indigo-500" />
            Weekly Class Timetable
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            {isTeacherOrAdmin 
              ? 'Schedule and manage class subjects, teachers, and study periods.'
              : 'View your class schedule, room numbers, and subject times.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full md:w-auto">
          {/* Class Select Dropdown (Teachers & Admins Only) */}
          {isTeacherOrAdmin && (
            <div className="flex items-center gap-2 flex-1 sm:flex-initial min-w-[160px]">
              <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                <SelectTrigger className="w-full sm:w-52 bg-background/50 border-border/85 h-9 text-xs">
                  <SelectValue placeholder="Select Class" />
                </SelectTrigger>
                <SelectContent>
                  {configData.classes.map(cls => (
                    <SelectItem key={cls.id} value={cls.id.toString()}>
                      {cls.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Weekend Toggle */}
          <Button 
            variant="outline" 
            size="sm" 
            className={cn("h-9 text-xs shrink-0", showWeekends && "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30")}
            onClick={() => setShowWeekends(!showWeekends)}
          >
            {showWeekends ? 'Hide Weekends' : 'Show Weekends'}
          </Button>

          {/* Add Period Button (Teachers & Admins Only) */}
          {isTeacherOrAdmin && (
            <Button onClick={handleOpenAddDialog} size="sm" className="h-9 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md gap-1.5 shrink-0 text-xs">
              <Plus className="w-4 h-4" /> Add Slot
            </Button>
          )}
        </div>
      </div>

      {/* Mobile Day Filter Tabs */}
      <div className="flex md:hidden items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        <button
          type="button"
          onClick={() => setSelectedMobileDay('ALL')}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-colors border",
            selectedMobileDay === 'ALL' 
              ? "bg-primary text-primary-foreground border-primary" 
              : "bg-card text-muted-foreground border-border hover:text-foreground"
          )}
        >
          All Days
        </button>
        {displayedDays.map(d => {
          const isToday = d.value === currentDayOfWeekStr;
          const isSelected = selectedMobileDay === d.value;
          return (
            <button
              key={d.value}
              type="button"
              onClick={() => setSelectedMobileDay(d.value)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-colors border flex items-center gap-1",
                isSelected 
                  ? "bg-primary text-primary-foreground border-primary" 
                  : isToday 
                    ? "bg-primary/10 text-primary border-primary/30"
                    : "bg-card text-muted-foreground border-border hover:text-foreground"
              )}
            >
              <span>{d.label.slice(0, 3)}</span>
              {isToday && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />}
            </button>
          );
        })}
      </div>

      {/* Main Timetable Content */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
        </div>
      ) : timetable.length === 0 && !isTeacherOrAdmin ? (
        <Card className="border border-dashed border-border/100 flex flex-col justify-center items-center text-center p-12 rounded-2xl bg-card/40">
          <Calendar className="w-12 h-12 text-muted-foreground/60 mb-4" />
          <h2 className="text-xl font-semibold">No Schedule Configured</h2>
          <p className="text-muted-foreground max-w-sm mt-2">
            Your class does not have any weekly timetable slots set up yet. Please check back later.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-5 xl:grid-cols-5 gap-4 sm:gap-6">
          {daysToRender.map(day => {
            const dayEntries = timetableByDay[day.value] || [];
            const isToday = day.value === currentDayOfWeekStr;

            return (
              <Card 
                key={day.value} 
                className={cn(
                  "border border-border/80 rounded-2xl transition-all shadow-sm flex flex-col min-h-[360px] sm:min-h-[450px]",
                  isToday && "border-indigo-500/40 bg-indigo-500/[0.02]"
                )}
              >
                {/* Day Header */}
                <CardHeader className={cn(
                  "p-3 sm:p-4 border-b border-border/80 flex flex-row items-center justify-between",
                  isToday && "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-t-2xl"
                )}>
                  <CardTitle className="text-sm sm:text-base font-bold tracking-tight">
                    {day.label}
                  </CardTitle>
                  {isToday && (
                    <Badge variant="outline" className="bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border-none font-semibold text-[10px] animate-pulse">
                      TODAY
                    </Badge>
                  )}
                </CardHeader>

                {/* Day Content Slots */}
                <CardContent className="p-3 sm:p-4 flex-1 space-y-3 sm:space-y-4 overflow-y-auto">
                  {dayEntries.length === 0 ? (
                    <div className="h-full flex flex-col justify-center items-center text-center text-muted-foreground/50 py-10">
                      <Calendar className="w-8 h-8 opacity-20 mb-2" />
                      <span className="text-xs">No slots scheduled</span>
                    </div>
                  ) : (
                    dayEntries.map(entry => {
                      const subjectTitle = entry.subjectName || entry.subject?.name || 'Subject';
                      const styles = getSubjectStyles(subjectTitle);
                      const live = isCurrentSlot(entry);
                      const teacherTitle = entry.teacherName || entry.teacher?.fullName || entry.teacher?.name || entry.teacher?.user?.name || '';

                      return (
                        <div 
                          key={entry.id} 
                          className={cn(
                            "relative group p-3 sm:p-4 rounded-xl border transition-all duration-200 flex flex-col justify-between",
                            styles.bg,
                            styles.border,
                            live ? styles.glow : "hover:border-border-hover"
                          )}
                        >
                          {/* Live pulse indicator */}
                          {live && (
                            <div className="absolute -top-1.5 -right-1.5 flex h-3 w-3">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                            </div>
                          )}

                          <div className="space-y-1.5 sm:space-y-2">
                            <div className="flex justify-between items-start gap-2">
                              <span className={cn("font-bold text-xs sm:text-sm leading-tight", styles.text)}>
                                {subjectTitle}
                              </span>
                              {live && (
                                <span className="text-[9px] sm:text-[10px] uppercase tracking-wider font-extrabold text-emerald-500 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded shrink-0">
                                  LIVE NOW
                                </span>
                              )}
                            </div>

                            {/* Time info */}
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Clock className="w-3.5 h-3.5 shrink-0" />
                              <span>{entry.startTime} - {entry.endTime}</span>
                            </div>

                            {/* Room Info */}
                            {entry.room && (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <MapPin className="w-3.5 h-3.5 shrink-0" />
                                <span>{entry.room}</span>
                              </div>
                            )}

                            {/* Teacher Info */}
                            {teacherTitle && (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground/80 pt-1 border-t border-border/40">
                                <User className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                                <span className="truncate">{teacherTitle}</span>
                              </div>
                            )}
                          </div>

                          {/* Edit / Delete actions for Teachers/Admins on hover */}
                          {isTeacherOrAdmin && (
                            <div className="flex justify-end gap-1.5 mt-2.5 sm:mt-3 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="w-7 h-7 hover:bg-background/80 hover:text-indigo-600"
                                onClick={() => handleOpenEditDialog(entry)}
                                title="Edit slot"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="w-7 h-7 hover:bg-background/80 hover:text-red-600 text-destructive"
                                onClick={() => handleDeleteEntry(entry.id)}
                                title="Delete slot"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* --- ADD / EDIT SLOT DIALOG --- */}
      {isTeacherOrAdmin && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md bg-card border border-border">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-500" />
                {editingEntry ? 'Edit Schedule Slot' : 'Add Schedule Slot'}
              </DialogTitle>
              <DialogDescription>
                Fill out the form below to configure a new slot. The system automatically performs overlap checks for the class and teacher.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSaveEntry} className="space-y-4 py-4">
              {/* Day Selection */}
              <div className="space-y-2">
                <Label htmlFor="day">Day of the Week</Label>
                <Select value={formDay} onValueChange={setFormDay}>
                  <SelectTrigger id="day" className="bg-background border-border">
                    <SelectValue placeholder="Select day" />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS.map(day => (
                      <SelectItem key={day.value} value={day.value}>
                        {day.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Subject Selection (Scoped by selected class) */}
              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Select value={formSubjectId} onValueChange={setFormSubjectId}>
                  <SelectTrigger id="subject" className="bg-background border-border">
                    <SelectValue placeholder="Select subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {classSubjects.length === 0 ? (
                      <SelectItem value="__empty__" disabled>
                        No subjects found for this class
                      </SelectItem>
                    ) : (
                      classSubjects.map(sub => (
                        <SelectItem key={sub.id} value={sub.id.toString()}>
                          {sub.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Teacher Selection */}
              <div className="space-y-2">
                <Label htmlFor="teacher">Assigned Teacher (Optional)</Label>
                <Select value={formTeacherId} onValueChange={setFormTeacherId}>
                  <SelectTrigger id="teacher" className="bg-background border-border">
                    <SelectValue placeholder="Select teacher (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Study Hall / No teacher</SelectItem>
                    {configData.teachers.map(t => (
                      <SelectItem key={t.id} value={t.id.toString()}>
                        {t.user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Start & End Times */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startTime">Start Time</Label>
                  <Input 
                    type="time" 
                    id="startTime" 
                    value={formStartTime} 
                    onChange={e => setFormStartTime(e.target.value)}
                    className="bg-background border-border"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endTime">End Time</Label>
                  <Input 
                    type="time" 
                    id="endTime" 
                    value={formEndTime} 
                    onChange={e => setFormEndTime(e.target.value)}
                    className="bg-background border-border"
                    required
                  />
                </div>
              </div>

              {/* Room/Location */}
              <div className="space-y-2">
                <Label htmlFor="room">Room Number / Location (Optional)</Label>
                <Input 
                  type="text" 
                  id="room" 
                  value={formRoom} 
                  placeholder="e.g. Science Lab B, Room 104"
                  onChange={e => setFormRoom(e.target.value)}
                  className="bg-background border-border"
                />
              </div>

              <DialogFooter className="pt-4 border-t border-border/80">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setDialogOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving...
                    </>
                  ) : (
                    'Save Slot'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
