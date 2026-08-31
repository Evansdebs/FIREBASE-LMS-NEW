import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Users, BookOpen, Award, Loader2 } from 'lucide-react';
import { getAnalyticsStats } from '@/lib/services/dashboardService';
import { toast } from 'sonner';

export default function AnalyticsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'super_admin';
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const res = await getAnalyticsStats();
      setData(res);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !data) {
    return <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  const statCards = [
    { icon: Users, label: 'Total Enrollments', value: data.statCards.totalEnrollments, change: '+12%', color: 'text-primary', bg: 'bg-primary/10' },
    { icon: BookOpen, label: 'Subjects Active', value: data.statCards.coursesActive, change: '+1', color: 'text-accent', bg: 'bg-accent/10' },
    { icon: Award, label: 'Avg Grade', value: data.statCards.avgGrade, change: '+3%', color: 'text-success', bg: 'bg-success/10' },
    { icon: TrendingUp, label: 'Completion Rate', value: data.statCards.completionRate, change: 'N/A', color: 'text-info', bg: 'bg-info/10' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Analytics</h1>
          <p className="text-muted-foreground mt-1">Performance insights and reports</p>
        </div>
        <Select defaultValue="this_month">
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="this_week">This Week</SelectItem>
            <SelectItem value="this_month">This Month</SelectItem>
            <SelectItem value="this_term">This Term</SelectItem>
            <SelectItem value="all_time">All Time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(s => (
          <Card key={s.label} className="border-border">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  <p className="font-heading text-2xl font-bold text-card-foreground mt-1">{s.value}</p>
                  <p className="text-xs text-success mt-1">Real-time DB aggregate</p>
                </div>
                <div className={`w-11 h-11 rounded-xl ${s.bg} flex items-center justify-center`}>
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border">
          <CardContent className="p-5">
            <h3 className="font-heading font-semibold text-card-foreground mb-4">Average Scores by Subject</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.studentPerformance}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 88%)" />
                <XAxis dataKey="subject" tick={{ fontSize: 12, fill: 'hsl(220, 10%, 45%)' }} />
                <YAxis tick={{ fontSize: 12, fill: 'hsl(220, 10%, 45%)' }} domain={[0, 100]} />
                <Tooltip contentStyle={{ borderRadius: '0.5rem', border: '1px solid hsl(220, 15%, 88%)' }} />
                <Bar dataKey="score" fill="hsl(250, 85%, 60%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-5">
            <h3 className="font-heading font-semibold text-card-foreground mb-4">Enrollment Trend</h3>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={data.enrollmentTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 88%)" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'hsl(220, 10%, 45%)' }} />
                <YAxis tick={{ fontSize: 12, fill: 'hsl(220, 10%, 45%)' }} />
                <Tooltip contentStyle={{ borderRadius: '0.5rem', border: '1px solid hsl(220, 15%, 88%)' }} />
                <Line type="monotone" dataKey="students" stroke="hsl(170, 75%, 42%)" strokeWidth={2} dot={{ fill: 'hsl(170, 75%, 42%)', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-5">
            <h3 className="font-heading font-semibold text-card-foreground mb-4">Grade Distribution</h3>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={data.gradeDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                  {data.gradeDistribution.map((entry: any, idx: number) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-5">
            <h3 className="font-heading font-semibold text-card-foreground mb-4">Teacher Activity</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-xs font-semibold text-muted-foreground py-2">Teacher</th>
                    <th className="text-center text-xs font-semibold text-muted-foreground py-2">Classes</th>
                    <th className="text-center text-xs font-semibold text-muted-foreground py-2">Quizzes</th>
                    <th className="text-center text-xs font-semibold text-muted-foreground py-2">Lessons</th>
                  </tr>
                </thead>
                <tbody>
                  {data.teacherActivity.length > 0 ? data.teacherActivity.map((t: any) => (
                    <tr key={t.name} className="border-b border-border">
                      <td className="py-2.5 text-sm font-medium text-card-foreground">{t.name}</td>
                      <td className="py-2.5 text-sm text-center text-card-foreground">{t.classes}</td>
                      <td className="py-2.5 text-sm text-center text-card-foreground">{t.quizzes}</td>
                      <td className="py-2.5 text-sm text-center text-card-foreground">{t.lessons}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={4} className="py-4 text-center text-sm text-muted-foreground">No teachers registered</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
