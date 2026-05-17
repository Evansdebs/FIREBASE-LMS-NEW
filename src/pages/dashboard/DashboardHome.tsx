import { useAuth } from '@/lib/auth-context';
import { useBranding } from '@/lib/branding-context';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Users, BookOpen, GraduationCap, Activity, TrendingUp, Clock,
  ClipboardCheck, Calendar, Trophy, Flame, FileText, MessageSquare,
  ArrowRight, CheckCircle, AlertCircle, AlertTriangle, BarChart3, Loader2, Star, Medal, Award, MessageCircle, Download
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
};

export default function DashboardHome() {
  const { user } = useAuth();
  const { settings: globalSettings } = useBranding();
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!user) return null;

  if (user.role === 'super_admin') return <AdminDashboard user={user} globalSettings={globalSettings} currentTime={currentTime} />;
  if (user.role === 'teacher') return <TeacherDashboard user={user} globalSettings={globalSettings} currentTime={currentTime} />;
  return <StudentDashboard user={user} globalSettings={globalSettings} currentTime={currentTime} />;
}

function AdminDashboard({ user, globalSettings, currentTime }: { user: any, globalSettings: any, currentTime: Date }) {
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/admin/dashboard')
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const [riskData, setRiskData] = useState<any[]>([]);
  useEffect(() => {
    api.get('/api/admin/risk-report').then(setRiskData);
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center p-20">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  const stats = [
    { icon: Users, label: 'Total Users', value: (data?.totalStudents || 0) + (data?.totalTeachers || 0), color: 'text-primary', bg: 'bg-primary/10', change: 'Live' },
    { icon: GraduationCap, label: 'Students', value: data?.totalStudents || 0, color: 'text-accent', bg: 'bg-accent/10', change: 'Persisted' },
    { icon: BookOpen, label: 'Active Subjects', value: data?.totalCourses || 0, color: 'text-info', bg: 'bg-info/10', change: 'Syncing' },
    { icon: Activity, label: 'Classes', value: data?.totalClasses || 0, color: 'text-success', bg: 'bg-success/10', change: 'Total' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">
            {getGreeting()}, {user.fullName.split(' ')[0]}
          </h1>
          {globalSettings?.welcomeMessage && (
            <p className="text-primary font-medium animate-pulse mt-1">
              {globalSettings.welcomeMessage}
            </p>
          )}
          <p className="text-muted-foreground mt-1">System overview and quick actions</p>
        </div>
        <div className="bg-muted px-4 py-2 rounded-xl border border-border shadow-sm flex items-center gap-3 animate-in slide-in-from-right-4 duration-500">
           <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <Calendar className="w-5 h-5 text-primary" />
           </div>
           <div className="flex flex-col">
              <span className="text-sm font-bold text-foreground leading-none">
                 {currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mt-1">
                 {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
              </span>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <Card key={s.label} className="border-border hover:shadow-xl hover:scale-[1.02] transition-all duration-300 cursor-default group">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  <p className="font-heading text-2xl font-bold text-card-foreground mt-1">{s.value}</p>
                  <p className="text-xs text-success mt-1">{s.change}</p>
                </div>
                <div className={`w-11 h-11 rounded-xl ${s.bg} flex items-center justify-center`}>
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <Card className="border-border">
        <CardContent className="p-5">
          <h3 className="font-heading font-semibold text-card-foreground mb-3">Quick Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { label: 'Add User', icon: Users, path: '/dashboard/users', permission: 'manage_users' },
              { label: 'Create Subject', icon: BookOpen, path: '/dashboard/courses', permission: 'manage_courses' },
              { label: 'View Analytics', icon: BarChart3, path: '/dashboard/analytics', permission: 'view_analytics' },
              { label: 'Announcements', icon: MessageSquare, path: '/dashboard/announcements', permission: 'send_announcements' },
            ].filter(a => {
              if (user.role === 'super_admin') return true;
              return user.permissions?.[a.permission];
            }).map(a => (
              <Button key={a.label} variant="outline" className="h-auto py-3 flex flex-col gap-1.5 hover:bg-primary hover:text-white transition-all duration-300 group" onClick={() => navigate(a.path)}>
                <a.icon className="w-5 h-5 text-primary group-hover:text-white transition-colors" />
                <span className="text-xs">{a.label}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Risk Detection Section */}
      {riskData.length > 0 && (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
               <div>
                  <h3 className="font-heading font-semibold text-destructive flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" /> Student Risk Alerts
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Automated detection of academic and behavioral risks</p>
               </div>
               <Badge variant="destructive" className="animate-pulse">{riskData.filter(r => r.riskLevel === 'HIGH').length} High Risk</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {riskData.slice(0, 6).map((student, i) => (
                <div key={i} className="p-3 rounded-lg bg-card border border-border hover:shadow-md hover:border-destructive/30 transition-all duration-300">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-sm font-bold text-foreground">{student.name}</p>
                      <p className="text-[10px] text-muted-foreground">{student.class}</p>
                    </div>
                    <Badge variant={student.riskLevel === 'HIGH' ? 'destructive' : 'secondary'} className="text-[10px] py-0 px-1.5">
                      {student.riskLevel}
                    </Badge>
                  </div>
                  <div className="space-y-1.5">
                    {student.reasons.map((reason: string, j: number) => (
                      <div key={j} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <div className="w-1 h-1 rounded-full bg-destructive shadow-[0_0_3px_red]" />
                        {reason}
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-2 border-t border-border flex justify-between items-center text-[10px]">
                    <span>Avg Score: <b className={student.avgScore < 50 ? 'text-destructive' : 'text-foreground'}>{student.avgScore}%</b></span>
                    <span>Strikes: <b className={student.totalStrikes >= 3 ? 'text-destructive' : 'text-foreground'}>{student.totalStrikes}</b></span>
                  </div>
                </div>
              ))}
            </div>
            {riskData.length > 6 && (
              <Button variant="link" className="text-xs text-destructive mt-2 p-0 h-auto" onClick={() => navigate('/dashboard/users')}>
                View all at-risk students <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Demographics Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <GenderChart title="Teacher Demographics" data={data?.genderStats?.teachers} />
        <GenderChart title="Student Demographics" data={data?.genderStats?.students} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading font-semibold text-card-foreground">Recent Activity</h3>
              <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/audit')} className="text-xs gap-1">View All <ArrowRight className="w-3 h-3" /></Button>
            </div>
            <div className="space-y-3">
              {(data?.recentUsers || []).map((u: any, i: number) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                  <CheckCircle className="w-4 h-4 shrink-0 text-success" />
                  <p className="text-sm text-card-foreground flex-1">
                    New {u.role.toLowerCase()} <b>{u.name}</b> joined
                  </p>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
              {(data?.recentUsers || []).length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No recent activity</p>}
            </div>
          </CardContent>
        </Card>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="border-border lg:col-span-2">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading font-semibold text-card-foreground">Student Rankings (Points + Performance)</h3>
              <Badge variant="outline" className="text-[10px] font-bold">Top 5 Students</Badge>
            </div>
            <div className="space-y-4">
               {data?.studentRankings?.map((student: any, i: number) => (
                  <div key={student.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card/50 hover:border-primary/50 hover:bg-primary/5 transition-all duration-300">
                    <div className="flex items-center gap-3">
                       <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm">
                         {i + 1}
                       </div>
                       <div>
                         <p className="text-sm font-bold text-foreground">{student.name}</p>
                         <p className="text-[10px] text-muted-foreground">{student.class}</p>
                       </div>
                    </div>
                    <div className="flex items-center gap-8">
                       <div className="text-center min-w-[60px]">
                         <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Points</p>
                         <p className="text-sm font-bold text-warning">{student.points}</p>
                       </div>
                       <div className="text-center min-w-[60px]">
                         <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Avg Grade</p>
                         <p className="text-sm font-bold text-success">{student.avgGrade}%</p>
                       </div>
                       <div className="text-center min-w-[60px] hidden sm:block">
                         <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Score</p>
                         <Badge variant="secondary" className="text-[10px] leading-tight px-1.5">{student.rankingScore}</Badge>
                       </div>
                    </div>
                  </div>
               ))}
               {(!data?.studentRankings || data?.studentRankings?.length === 0) && (
                 <p className="text-xs text-muted-foreground text-center py-8">No ranking data available yet.</p>
               )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading font-semibold text-card-foreground">System Health</h3>
            </div>
            <div className="space-y-4">
              {[
                { label: 'Server Uptime', value: '99.9%', progress: 99.9, color: 'text-success' },
                { label: 'Storage Used', value: '2.4 / 10 GB', progress: 24, color: 'text-info' },
                { label: 'Active Sessions', value: '5 / 100', progress: 5, color: 'text-primary' },
                { label: 'API Usage', value: '1.2K / 10K', progress: 12, color: 'text-accent' },
              ].map(h => (
                <div key={h.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-card-foreground">{h.label}</span>
                    <span className={cn('text-sm font-medium', h.color)}>{h.value}</span>
                  </div>
                  <Progress value={h.progress} className="h-1.5" />
                </div>
              ))}
              {data?.systemHealth && (
                <div className="pt-2 border-t border-border mt-2 grid grid-cols-2 gap-2">
                  <div className="p-2 rounded bg-muted/30">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Uptime</p>
                    <p className="text-xs font-bold text-foreground">{data.systemHealth.uptime}</p>
                  </div>
                  <div className="p-2 rounded bg-muted/30">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Memory</p>
                    <p className="text-xs font-bold text-foreground">{data.systemHealth.memory}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Teacher Participation Section */}
      <div className="mt-6">
        <Card className="border-border">
          <CardContent className="p-5">
            <h3 className="font-heading font-semibold text-card-foreground mb-4">Teacher Participation</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
               {data?.teacherParticipation?.map((t: any) => (
                 <div key={t.id} className="p-4 rounded-lg border border-border bg-card hover:shadow-xl hover:border-primary/30 transition-all duration-300 group">
                   <div className="flex items-center gap-3 mb-3">
                     <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary">
                       {t.name.charAt(0)}
                     </div>
                     <div>
                       <p className="font-bold text-sm text-foreground">{t.name}</p>
                       <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Activity: {t.totalActivity}</p>
                     </div>
                   </div>
                   <div className="grid grid-cols-3 gap-2 text-center border-t border-border pt-3">
                     <div>
                       <p className="text-xs font-bold text-success">{t.quizzes}</p>
                       <p className="text-[10px] text-muted-foreground truncate">Quizzes</p>
                     </div>
                     <div>
                       <p className="text-xs font-bold text-info">{t.assignments}</p>
                       <p className="text-[10px] text-muted-foreground truncate">Assigns</p>
                     </div>
                     <div>
                       <p className="text-xs font-bold text-warning">{t.liveClasses}</p>
                       <p className="text-[10px] text-muted-foreground truncate">Classes</p>
                     </div>
                   </div>
                 </div>
               ))}
               {(!data?.teacherParticipation || data?.teacherParticipation?.length === 0) && (
                 <p className="text-sm text-muted-foreground col-span-full">No active teachers found.</p>
               )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function TeacherDashboard({ user, globalSettings, currentTime }: { user: any, globalSettings: any, currentTime: Date }) {
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/teacher/dashboard')
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const [riskData, setRiskData] = useState<any[]>([]);
  useEffect(() => {
    api.get('/api/teacher/risk-report').then(setRiskData);
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center p-20">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  const stats = [
    { icon: BookOpen, label: 'My Subjects', value: data?.courses?.length || 0, color: 'text-primary', bg: 'bg-primary/10' },
    { icon: Users, label: 'Total Students', value: data?.totalStudents || 0, color: 'text-accent', bg: 'bg-accent/10' },
    { icon: TrendingUp, label: 'Avg. Performance', value: `${data?.avgPerformance || 0}%`, color: 'text-success', bg: 'bg-success/10' },
    { icon: ClipboardCheck, label: 'Pending Grades', value: data?.pendingSubmissions || 0, color: 'text-warning', bg: 'bg-warning/10' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">
            {getGreeting()}, {user.fullName.split(' ')[0]}
          </h1>
          {globalSettings?.welcomeMessage && (
            <p className="text-primary font-medium animate-pulse mt-1">
              {globalSettings.welcomeMessage}
            </p>
          )}
          <p className="text-muted-foreground mt-1">Manage your subjects and students</p>
        </div>
        <div className="bg-muted px-4 py-2 rounded-xl border border-border shadow-sm flex items-center gap-3 animate-in slide-in-from-right-4 duration-500">
           <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <Calendar className="w-5 h-5 text-primary" />
           </div>
           <div className="flex flex-col">
              <span className="text-sm font-bold text-foreground leading-none">
                 {currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mt-1">
                 {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
              </span>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <Card key={s.label} className="border-border hover:shadow-xl hover:scale-[1.02] transition-all duration-300 cursor-default group">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  <p className="font-heading text-2xl font-bold text-card-foreground mt-1">{s.value}</p>
                </div>
                <div className={`w-11 h-11 rounded-xl ${s.bg} flex items-center justify-center`}>
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <Card className="border-border">
        <CardContent className="p-5">
          <h3 className="font-heading font-semibold text-card-foreground mb-3">Quick Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {[
              { label: 'Create Quiz', icon: ClipboardCheck, path: '/dashboard/quizzes', always: true },
              { label: 'Grade Work', icon: FileText, path: '/dashboard/gradebook', always: true },
              { label: 'Schedule Class', icon: Calendar, path: '/dashboard/live-classes', always: true },
              { label: 'Upload Resource', icon: BookOpen, path: '/dashboard/resources', permission: 'manage_resources' },
              { label: 'Announce', icon: MessageSquare, path: '/dashboard/announcements', permission: 'send_announcements' },
            ].filter(a => a.always || user.permissions?.[a.permission]).map(a => (
              <Button key={a.label} variant="outline" className="h-auto py-3 flex flex-col gap-1.5 hover:bg-primary hover:text-white transition-all duration-300 group" onClick={() => navigate(a.path)}>
                <a.icon className="w-5 h-5 text-primary group-hover:text-white transition-colors" />
                <span className="text-xs">{a.label}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Risk Detection Section */}
      {riskData.length > 0 && (
        <Card className="border-warning/20 bg-warning/5">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
               <div>
                  <h3 className="font-heading font-semibold text-warning flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" /> At-Risk Students
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Students requiring attention in your assigned classes</p>
               </div>
               <Badge variant="outline" className="text-warning border-warning/30">{riskData.length} Active Alerts</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {riskData.slice(0, 6).map((student, i) => (
                <div key={i} className="p-3 rounded-lg bg-card border border-border hover:shadow-md hover:border-warning/30 transition-all duration-300">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-sm font-bold text-foreground">{student.name}</p>
                      <p className="text-[10px] text-muted-foreground">{student.class}</p>
                    </div>
                    <Badge variant={student.riskLevel === 'HIGH' ? 'destructive' : 'secondary'} className="text-[10px] py-0 px-1.5">
                      {student.riskLevel}
                    </Badge>
                  </div>
                  <div className="space-y-1 my-2">
                    {student.reasons.map((reason: string, j: number) => (
                      <div key={j} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <div className="w-1 h-1 rounded-full bg-warning" />
                        {reason}
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-2 border-t border-border flex justify-between items-center text-[10px]">
                    <span>Avg Score: <b className={student.avgScore < 50 ? 'text-destructive' : 'text-foreground'}>{student.avgScore}%</b></span>
                    <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 py-0" onClick={() => navigate(`/dashboard/messages?userId=${student.id}`)}>Message</Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Gender Chart for teacher */}
      <GenderChart title="My Students Demographics" data={data?.genderStats?.students} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border">
          <CardContent className="p-5">
            <h3 className="font-heading font-semibold text-card-foreground mb-4">Pending Submissions</h3>
            <div className="space-y-3">
              {(data?.courses || []).slice(0, 3).map((c: any, i: number) => (
                <div key={i} className="p-3 rounded-lg border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium text-card-foreground">{c.title}</p>
                      <p className="text-xs text-muted-foreground">{c.class?.name || 'No Class'}</p>
                    </div>
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                      {c._count?.quizzes} Quizzes
                    </Badge>
                  </div>
                  <Progress value={0} className="h-1.5" />
                </div>
              ))}
              {(data?.courses || []).length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No subjects yet</p>}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-5">
            <h3 className="font-heading font-semibold text-card-foreground mb-4">Today's Schedule</h3>
            <div className="space-y-3">
              {(data?.upcomingClasses || []).slice(0, 3).map((c: any, i: number) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-card-foreground">{c.title}</p>
                    <p className="text-xs text-muted-foreground">{c.scheduleTime} · {c.class?._count?.students || 0} students</p>
                  </div>
                  <Badge variant="outline" className="bg-info/10 text-info border-info/20 capitalize">Upcoming</Badge>
                </div>
              ))}
              {(data?.upcomingClasses || []).length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No scheduled events</p>}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border lg:col-span-2">
          <CardContent className="p-5">
            <h3 className="font-heading font-semibold text-card-foreground mb-4">Student Performance Overview</h3>
            <div className="grid grid-cols-4 gap-4 text-center">
              <div className="p-3 rounded-lg bg-success/5">
                <p className="font-heading text-xl font-bold text-success">{data?.performanceDistribution?.A || 0}%</p>
                <p className="text-xs text-muted-foreground">A Grade (90+)</p>
              </div>
              <div className="p-3 rounded-lg bg-info/5">
                <p className="font-heading text-xl font-bold text-info">{data?.performanceDistribution?.B || 0}%</p>
                <p className="text-xs text-muted-foreground">B Grade (80-89)</p>
              </div>
              <div className="p-3 rounded-lg bg-warning/5">
                <p className="font-heading text-xl font-bold text-warning">{data?.performanceDistribution?.C || 0}%</p>
                <p className="text-xs text-muted-foreground">C Grade (70-79)</p>
              </div>
              <div className="p-3 rounded-lg bg-destructive/5">
                <p className="font-heading text-xl font-bold text-destructive">{data?.performanceDistribution?.F || 0}%</p>
                <p className="text-xs text-muted-foreground">Below 70</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StudentDashboard({ user, globalSettings, currentTime }: { user: any, globalSettings: any, currentTime: Date }) {
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  if (!user) return null;

  useEffect(() => {
    const fetchData = () => {
      api.get('/api/student/dashboard')
        .then(res => {
           setData(res);
           setLoading(false);
        })
        .catch(err => console.error('Dashboard Error:', err));
    };

    fetchData();

    // 1. WebSocket for instant updates
    const apiBase = import.meta.env.VITE_API_URL || '';
    let wsUrl = '';
    if (apiBase) {
      wsUrl = apiBase.replace(/^http/, 'ws') + '/ws';
    } else {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.hostname === 'localhost' ? 'localhost:5000' : window.location.host;
      wsUrl = `${protocol}//${host}/ws`;
    }
    const token = localStorage.getItem('onereal_token');
    const ws = new WebSocket(`${wsUrl}${token ? `?token=${token}` : ''}`);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'REFRESH_DASHBOARD') {
          console.log('Realtime update received from server');
          fetchData();
        }
      } catch (err) {
        console.error('WS Error:', err);
      }
    };

    // 2. Fallback polling every 15s for "real-time" feel without WS
    const interval = setInterval(fetchData, 15000);

    return () => {
      clearInterval(interval);
      ws.close();
    };
  }, []);

  const downloadGradeReport = () => {
    if (!data) return;
    const doc = new jsPDF();
    const schoolName = globalSettings?.schoolName || data?.settings?.schoolName || 'Onereal LMS';
    
    // Header
    doc.setFontSize(20);
    doc.text(schoolName, 105, 15, { align: 'center' });
    doc.setFontSize(14);
    doc.text('Academic Performance Report', 105, 25, { align: 'center' });
    
    // Student Info
    doc.setFontSize(10);
    doc.text(`Student: ${user.fullName}`, 14, 40);
    doc.text(`Class: ${data.student.class?.name || 'N/A'}`, 14, 45);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 50);
    
    // Table
    const tableData = (data.recentResults || []).map((r: any) => [
      r.quiz.title,
      r.quiz.course?.title || 'N/A',
      `${r.score}/${r.total}`,
      `${Math.round((r.score / (r.total || 1)) * 100)}%`,
      new Date(r.submittedAt).toLocaleDateString()
    ]);
    
    autoTable(doc, {
      startY: 60,
      head: [['Quiz', 'Course', 'Score', 'Percentage', 'Date']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [99, 102, 241] } // Primary color
    });
    
    doc.save(`${user.fullName}_Grade_Report.pdf`);
    toast.success("PDF report generated!");
  };

  if (loading) return (
    <div className="flex items-center justify-center p-20">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  const stats = [
    { icon: BookOpen, label: 'My Subjects', value: data?.subjectCount || data?.courses?.length || 0, color: 'text-primary', bg: 'bg-primary/10' },
    { icon: TrendingUp, label: 'Avg. Grade', value: `${data?.avgGrade || 0}%`, color: 'text-accent', bg: 'bg-accent/10' },
    { icon: Award, label: 'Overall Progress', value: `${data?.overallProgress || 0}%`, color: 'text-success', bg: 'bg-success/10' },
    { icon: Trophy, label: 'Total Points', value: data?.totalPoints || 0, color: 'text-warning', bg: 'bg-warning/10' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">
            {getGreeting()}, {user.fullName.split(' ')[0]}
          </h1>
          {globalSettings?.welcomeMessage && (
            <p className="text-primary font-medium animate-pulse mt-1">
              {globalSettings.welcomeMessage}
            </p>
          )}
          <p className="text-muted-foreground mt-1">Track your learning progress</p>
        </div>
        <div className="bg-muted px-4 py-2 rounded-xl border border-border shadow-sm flex items-center gap-3 animate-in slide-in-from-right-4 duration-500">
           <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <Calendar className="w-5 h-5 text-primary" />
           </div>
           <div className="flex flex-col">
              <span className="text-sm font-bold text-foreground leading-none">
                 {currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mt-1">
                 {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
              </span>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <Card key={s.label} className="border-border hover:shadow-xl hover:scale-[1.02] transition-all duration-300 cursor-default group">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  <p className="font-heading text-2xl font-bold text-card-foreground mt-1">{s.value}</p>
                </div>
                <div className={`w-11 h-11 rounded-xl ${s.bg} flex items-center justify-center`}>
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Course Progress */}
        <Card className="border-border lg:col-span-2">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading font-semibold text-card-foreground">Subject Progress</h3>
              <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/courses')} className="text-xs gap-1">View All <ArrowRight className="w-3 h-3" /></Button>
            </div>
            <div className="space-y-4">
              {(data?.courses || []).map((c: any, i: number) => (
                  <div key={i} className="p-3 rounded-lg border border-border border-t-4 border-t-primary bg-card/50">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-sm font-medium text-card-foreground">{c.title}</p>
                      </div>
                      <div className="text-right flex flex-col items-end gap-1">
                        <Badge variant="outline" className="bg-success/10 text-success border-success/20 font-bold">
                           {c.subject?.name}
                        </Badge>
                        <p className="text-[10px] text-muted-foreground">{c.teacher?.user?.name || 'Instructor'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={c.progress || 0} className="h-2 flex-1" />
                      <span className="text-xs font-medium text-primary">{c.progress || 0}%</span>
                    </div>
                  </div>
              ))}
              {(data?.courses || []).length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No enrolled subjects</p>}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming */}
        <div className="space-y-4">
          <Card className="border-border">
            <CardContent className="p-5">
              <h3 className="font-heading font-semibold text-card-foreground mb-3">Due Soon</h3>
              <div className="space-y-3">
                {(data?.upcomingAssignments || []).map((d: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 py-2 border-b border-border last:border-0 hover:bg-muted/30 transition-colors px-1 rounded-md cursor-pointer" onClick={() => navigate('/dashboard/assignments')}>
                    <div className={cn('w-2 h-2 rounded-full', new Date(d.deadline).getTime() - new Date().getTime() < 86400000 ? 'bg-destructive' : 'bg-warning')} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-card-foreground truncate">{d.title}</p>
                      <p className="text-xs text-muted-foreground">{d.course?.title} · Due {new Date(d.deadline).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
                {(data?.upcomingAssignments || []).length === 0 && (
                   <p className="text-xs text-muted-foreground text-center py-4 italic">No assignments due soon. Rest easy!</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="p-5">
              <h3 className="font-heading font-semibold text-card-foreground mb-3">Next Class</h3>
              {data?.upcomingClasses?.length > 0 ? (
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/10 hover:bg-primary/10 transition-colors cursor-pointer" onClick={() => navigate('/dashboard/live-classes')}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-card-foreground truncate">{data.upcomingClasses[0].title}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(data.upcomingClasses[0].scheduleDate).toLocaleDateString()} at {data.upcomingClasses[0].scheduleTime}
                      </p>
                      <p className="text-xs text-primary font-medium mt-1">
                        With {data.upcomingClasses[0].teacher?.user?.name}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4 italic">No scheduled classes found.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-heading font-semibold text-card-foreground">Recent Quiz Results</h3>
                <Button size="sm" variant="ghost" onClick={downloadGradeReport} className="h-7 text-[10px] gap-1 hover:bg-primary/10 hover:text-primary">
                  <Download className="w-3 h-3" /> PDF Report
                </Button>
              </div>
              <div className="space-y-2">
                {(data?.recentResults || []).map((r: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-card border border-border">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{r.quiz?.title}</p>
                      <p className="text-[10px] text-muted-foreground">{r.quiz?.course?.title}</p>
                    </div>
                    <div className="text-right ml-2">
                      <p className="text-sm font-bold text-success">
                        {Math.round((r.score / (r.total || 100)) * 100)}%
                      </p>
                      <p className="text-[10px] text-muted-foreground">{new Date(r.submittedAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
                {(data?.recentResults || []).length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4 italic">No quiz results yet.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="p-5">
              <h3 className="font-heading font-semibold text-card-foreground mb-3">Recent Achievements</h3>
              <div className="space-y-2">
                {[
                  { title: 'On Fire 🔥', desc: '7-day streak', icon: Flame },
                  { title: 'Quiz Master 🏆', desc: '5 quizzes with 90%+', icon: Trophy },
                ].map((a, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-warning/5">
                    <a.icon className="w-4 h-4 text-warning" />
                    <div>
                      <p className="text-xs font-semibold text-card-foreground">{a.title}</p>
                      <p className="text-[10px] text-muted-foreground">{a.desc}</p>
                    </div>
                  </div>
                ))}
                <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => navigate('/dashboard/participation')}>
                  View All Achievements
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── GENDER CHART COMPONENT ──────────────────────────────
function GenderChart({ title, data }: { title: string; data?: { male: number; female: number; other: number; unknown: number } }) {
  const COLORS = ['hsl(217, 91%, 60%)', 'hsl(330, 81%, 60%)', 'hsl(142, 71%, 45%)', 'hsl(0, 0%, 70%)'];
  const LABELS = ['Male', 'Female', 'Other', 'Unknown'];

  if (!data) return null;

  const chartData = [
    { name: 'Male',    value: data.male    },
    { name: 'Female',  value: data.female  },
    { name: 'Other',   value: data.other   },
    { name: 'Unknown', value: data.unknown },
  ].filter(d => d.value > 0);

  const total = data.male + data.female + data.other + data.unknown;

  if (total === 0) {
    return (
      <Card className="border-border">
        <CardContent className="p-5">
          <h3 className="font-heading font-semibold text-card-foreground mb-4">{title}</h3>
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Users className="w-10 h-10 mb-2 opacity-20" />
            <p className="text-sm">No data available</p>
            <p className="text-xs mt-1">Add users and fill in their gender to see charts</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border">
      <CardContent className="p-5">
        <h3 className="font-heading font-semibold text-card-foreground mb-1">{title}</h3>
        <p className="text-xs text-muted-foreground mb-4">{total} total</p>
        <div className="flex items-center gap-4">
          <div className="w-36 h-36 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={38}
                  outerRadius={64}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={COLORS[LABELS.indexOf(chartData[i].name)]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: number, name: string) => [`${val} (${total > 0 ? Math.round(val / total * 100) : 0}%)`, name]}
                  contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 space-y-2">
            {chartData.map((d, i) => {
              const pct = total > 0 ? Math.round(d.value / total * 100) : 0;
              const color = COLORS[LABELS.indexOf(d.name)];
              return (
                <div key={d.name}>
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="flex items-center gap-1.5 text-xs text-card-foreground">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                      {d.name}
                    </div>
                    <span className="text-xs font-bold text-card-foreground">{pct}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div className="h-1.5 rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
