import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Trophy, Star, Flame, Target, Zap, Award, Medal, Crown, TrendingUp, Loader2, FlaskConical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface Achievement {
  id: number;
  title: string;
  description: string;
  points: number;
  createdAt: string;
}

interface LeaderboardEntry {
  rank: number;
  userId: number;
  name: string;
  points: number;
  avatar: string;
  isCurrentUser?: boolean;
}

export default function ParticipationPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsData, lbData, histData] = await Promise.all([
        api.get('/api/student/participation/stats'),
        api.get('/api/student/leaderboard'),
        api.get('/api/student/participation/history')
      ]);
      setStats(statsData);
      setLeaderboard(lbData);
      setHistory(histData);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const currentUserEntry = leaderboard.find(l => l.isCurrentUser);

  const getAchievementIcon = (title: string) => {
    const icons: Record<string, any> = {
      'First Steps': Star,
      'Quiz Master': Trophy,
      'On Fire': Flame,
      'Sharpshooter': Target,
      'Speed Demon': Zap,
      'Scholar': Award,
      'Consistent': Medal,
      'Top of the Class': Crown,
      'Simulation': FlaskConical,
      'Flask': FlaskConical,
    };
    return icons[title] || icons[title.split(':')[0]] || Star;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">Participation & Rewards</h1>
        <p className="text-muted-foreground mt-1">Track your progress and earn achievements</p>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="border-border bg-gradient-to-br from-primary/5 to-primary/10">
          <CardContent className="p-4 text-center">
            <Trophy className="w-6 h-6 text-primary mx-auto mb-1" />
            <p className="font-heading text-2xl font-bold text-primary">{stats?.totalPoints || 0}</p>
            <p className="text-xs text-muted-foreground">Total Points</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4 text-center">
            <Flame className="w-6 h-6 text-destructive mx-auto mb-1" />
            <p className="font-heading text-2xl font-bold text-card-foreground">{stats?.streak || 0}</p>
            <p className="text-xs text-muted-foreground">Day Streak</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4 text-center">
            <Award className="w-6 h-6 text-warning mx-auto mb-1" />
            <p className="font-heading text-2xl font-bold text-card-foreground">{stats?.achievementCount || 0}</p>
            <p className="text-xs text-muted-foreground">Achievements</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4 text-center">
            <TrendingUp className="w-6 h-6 text-success mx-auto mb-1" />
            <p className="font-heading text-2xl font-bold text-card-foreground">#{currentUserEntry?.rank || '-'}</p>
            <p className="text-xs text-muted-foreground">Leaderboard Rank</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Achievements */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="font-heading text-lg font-semibold text-foreground">Achievements</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {loading ? (
              <div className="col-span-2 py-10 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : (stats?.achievements || []).map((ach: any) => {
              const Icon = getAchievementIcon(ach.title);
              return (
                <Card key={ach.id} className={cn('border-border transition-all hover:shadow-md')}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-warning/10')}>
                        <Icon className={cn('w-5 h-5 text-warning')} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-semibold text-card-foreground">{ach.title}</h4>
                          <Badge className="bg-success/10 text-success border-success/20 text-[10px]">Earned</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{ach.description}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">Earned on {new Date(ach.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
           {(stats?.achievements?.length === 0 && !loading) && <p className="col-span-2 text-center text-muted-foreground py-10">No achievements yet. Keep learning!</p>}
          </div>

          {/* Points History */}
          <h2 className="font-heading text-lg font-semibold text-foreground mt-6">Recent Points</h2>
          <Card className="border-border">
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {history.map((p, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm text-card-foreground">{p.action}</p>
                      <p className="text-xs text-muted-foreground">{new Date(p.time).toLocaleString()}</p>
                    </div>
                    <Badge className="bg-success/10 text-success border-success/20 font-semibold">+{p.points}</Badge>
                  </div>
                ))}
                {(history.length === 0 && !loading) && <p className="text-center text-muted-foreground py-6">No point history found.</p>}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Leaderboard */}
        <div className="space-y-4">
          <h2 className="font-heading text-lg font-semibold text-foreground">Leaderboard</h2>
          <Card className="border-border">
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {leaderboard.map(entry => (
                  <div
                    key={entry.userId}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 transition-colors',
                      entry.isCurrentUser && 'bg-primary/5'
                    )}
                  >
                    <span className={cn(
                      'w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs',
                      entry.rank === 1 ? 'bg-warning/20 text-warning' :
                      entry.rank === 2 ? 'bg-muted-foreground/20 text-muted-foreground' :
                      entry.rank === 3 ? 'bg-warning/10 text-warning/70' :
                      'bg-muted text-muted-foreground'
                    )}>
                      {entry.rank <= 3 ? ['🥇', '🥈', '🥉'][entry.rank - 1] : entry.rank}
                    </span>
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs">
                      {entry.avatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm font-medium truncate', entry.isCurrentUser ? 'text-primary' : 'text-card-foreground')}>
                        {entry.name} {entry.isCurrentUser && '(You)'}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-card-foreground">{entry.points.toLocaleString()}</span>
                  </div>
                ))}
                {(leaderboard.length === 0 && !loading) && <p className="text-center text-muted-foreground py-10">No scores yet.</p>}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
