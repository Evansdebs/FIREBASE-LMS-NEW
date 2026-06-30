import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
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

  // --- COMPONENT STATE ---
  const [timetable, setTimetable] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [showWeekends, setShowWeekends] = useState(false);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // Configuration lists (for modals)
  const [configData, setConfigData] = useState<{ classes: any[]; teachers: any[] }>({ classes: [], teachers: [] });

  // Dialog State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);

  // Form Fields — use '__none__' sentinel for the "no teacher" Select option
  // because Radix UI's Select crashes when given an empty-string value.
  const [formDay, setFormDay] = useState('MONDAY');
  const [formSubjectId, setFormSubjectId] = useState('__empty__');
  const [formTeacherId, setFormTeacherId] = useState('__none__');
  const [formStartTime, setFormStartTime] = useState('08:00');
  const [formEndTime, setFormEndTime] = useState('09:00');
  const [formRoom, setFormRoom] = useState('');

  // Keep track of current day of week and current time in minutes
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000); // update every 30 seconds
    return () => clearInterval(timer);
  }, []);

  const currentDayOfWeekStr = useMemo(() => {
    const daysArr = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
    return daysArr[currentTime.getDay()];
  }, [currentTime]);

  const currentTimeInMinutes = useMemo(() => {
    return currentTime.getHours() * 60 + currentTime.getMinutes();
  }, [currentTime]);

  // Check if an entry is happening right now
  const isEntryLive = (entry: any) => {
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
      // Student loads their own class timetable
      fetchStudentTimetable();
    }
  }, [isTeacherOrAdmin]);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/teacher/timetable/config');
      setConfigData(res);
      
      // Auto-select first class if available
      if (res.classes && res.classes.length > 0) {
        setSelectedClassId(res.classes[0].id.toString());
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
      const res = await api.get('/api/student/timetable');
      setTimetable(Array.isArray(res) ? res : []);
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
      const res = await api.get(`/api/teacher/timetable?classId=${classId}`);
      setTimetable(Array.isArray(res) ? res : []);
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

    // Sort each day chronologically
    Object.keys(groups).forEach(day => {
      groups[day].sort((a, b) => a.startTime.localeCompare(b.startTime));
    });

    return groups;
  }, [timetable]);

  // --- CRUD ACTIONS ---
  const handleOpenAddDialog = () => {
    setEditingEntry(null);
    setFormDay('MONDAY');
    setFormSubjectId(classSubjects[0]?.id?.toString() || '__empty__');
    setFormTeacherId('__none__');
    setFormStartTime('08:00');
    setFormEndTime('09:00');
    setFormRoom('');
    setDialogOpen(true);
  };

  const handleOpenEditDialog = (entry: any) => {
    setEditingEntry(entry);
    setFormDay(entry.dayOfWeek);
    setFormSubjectId(entry.subjectId.toString());
    setFormTeacherId(entry.teacherId?.toString() || '__none__');
    setFormStartTime(entry.startTime);
    setFormEndTime(entry.endTime);
    setFormRoom(entry.room || '');
    setDialogOpen(true);
  };

  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSubjectId || formSubjectId === '__empty__') {
      toast.warning('Please select a subject.');
      return;
    }

    try {
      setSaving(true);
      const effectiveTeacherId = formTeacherId && formTeacherId !== '__none__' ? formTeacherId : null;
      const payload = {
        classId: parseInt(selectedClassId),
        subjectId: parseInt(formSubjectId),
        teacherId: effectiveTeacherId ? parseInt(effectiveTeacherId) : null,
        dayOfWeek: formDay,
        startTime: formStartTime,
        endTime: formEndTime,
        room: formRoom || null
      };

      if (editingEntry) {
        await api.put(`/api/teacher/timetable/${editingEntry.id}`, payload);
        toast.success('Timetable period updated successfully!');
      } else {
        await api.post('/api/teacher/timetable', payload);
        toast.success('Timetable period added successfully!');
      }

      setDialogOpen(false);
      fetchClassTimetable(selectedClassId);
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || 'Failed to save timetable slot.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEntry = async (entryId: number) => {
    if (!confirm('Are you sure you want to remove this timetable slot?')) return;
    try {
      await api.delete(`/api/teacher/timetable/${entryId}`);
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

  return (
    <div className="p-6 space-y-6">
      {/* Header section with modern glassmorphism touch */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card/60 backdrop-blur-md p-6 rounded-2xl border border-border/80 shadow-sm">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-indigo-500 to-emerald-500 bg-clip-text text-transparent flex items-center gap-2">
            <Grid className="w-8 h-8 text-indigo-500" />
            Weekly Class Timetable
          </h1>
          <p className="text-muted-foreground mt-1">
            {isTeacherOrAdmin 
              ? 'Schedule and manage class subjects, teachers, and study periods.'
              : 'View your class schedule, room numbers, and subject times.'}
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Class Select Dropdown (Teachers & Admins Only) */}
          {isTeacherOrAdmin && (
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Label className="text-sm font-medium shrink-0 max-md:hidden">Class:</Label>
              <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                <SelectTrigger className="w-full md:w-56 bg-background/50 border-border/85">
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
            className={cn("shrink-0", showWeekends && "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30")}
            onClick={() => setShowWeekends(!showWeekends)}
          >
            {showWeekends ? 'Hide Weekends' : 'Show Weekends'}
          </Button>

          {/* Add Period Button (Teachers & Admins Only) */}
          {isTeacherOrAdmin && (
            <Button onClick={handleOpenAddDialog} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md gap-2 shrink-0">
              <Plus className="w-4 h-4" /> Add Slot
            </Button>
          )}
        </div>
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
        <div className="grid grid-cols-1 md:grid-cols-5 xl:grid-cols-5 gap-6">
          {displayedDays.map(day => {
            const dayEntries = timetableByDay[day.value] || [];
            const isToday = day.value === currentDayOfWeekStr;

            return (
              <Card 
                key={day.value} 
                className={cn(
                  "border border-border/80 rounded-2xl transition-all shadow-sm flex flex-col min-h-[450px]",
                  isToday && "border-indigo-500/40 bg-indigo-500/[0.02]"
                )}
              >
                {/* Day Header */}
                <CardHeader className={cn(
                  "p-4 border-b border-border/80 flex flex-row items-center justify-between",
                  isToday && "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-t-2xl"
                )}>
                  <CardTitle className="text-base font-bold tracking-tight">
                    {day.label}
                  </CardTitle>
                  {isToday && (
                    <Badge variant="outline" className="bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border-none font-semibold text-2xs animate-pulse">
                      TODAY
                    </Badge>
                  )}
                </CardHeader>

                {/* Day Content Slots */}
                <CardContent className="p-4 flex-1 space-y-4 overflow-y-auto">
                  {dayEntries.length === 0 ? (
                    <div className="h-full flex flex-col justify-center items-center text-center text-muted-foreground/50 py-10">
                      <Calendar className="w-8 h-8 opacity-20 mb-2" />
                      <span className="text-xs">No slots</span>
                    </div>
                  ) : (
                    dayEntries.map(entry => {
                      const styles = getSubjectStyles(entry.subject.name);
                      const live = isEntryLive(entry);

                      return (
                        <div 
                          key={entry.id} 
                          className={cn(
                            "relative group p-4 rounded-xl border transition-all duration-200 flex flex-col justify-between",
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

                          <div className="space-y-2">
                            <div className="flex justify-between items-start">
                              <span className={cn("font-bold text-sm leading-tight", styles.text)}>
                                {entry.subject.name}
                              </span>
                              {live && (
                                <span className="text-[10px] uppercase tracking-wider font-extrabold text-emerald-500 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded ml-2">
                                  LIVE NOW
                                </span>
                              )}
                            </div>

                            {/* Time info */}
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Clock className="w-3.5 h-3.5" />
                              <span>{entry.startTime} - {entry.endTime}</span>
                            </div>

                            {/* Room Info */}
                            {entry.room && (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <MapPin className="w-3.5 h-3.5" />
                                <span>{entry.room}</span>
                              </div>
                            )}

                            {/* Teacher Info */}
                            {entry.teacher && (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground/80 pt-1 border-t border-border/40">
                                <User className="w-3.5 h-3.5 text-muted-foreground/60" />
                                <span className="truncate">{entry.teacher.user.name}</span>
                              </div>
                            )}
                          </div>

                          {/* Edit / Delete actions for Teachers/Admins on hover */}
                          {isTeacherOrAdmin && (
                            <div className="flex justify-end gap-1.5 mt-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="w-7 h-7 hover:bg-background/80 hover:text-indigo-600"
                                onClick={() => handleOpenEditDialog(entry)}
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="w-7 h-7 hover:bg-background/80 hover:text-red-600"
                                onClick={() => handleDeleteEntry(entry.id)}
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
