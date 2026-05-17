const prisma = require('../config/prisma');

// ─── LEADERBOARD ────────────────────────────────────────
const getLeaderboard = async (req, res) => {
  try {
    // Aggregate achievement points per user
    const usersWithPoints = await prisma.user.findMany({
      where: { role: 'STUDENT' },
      select: {
        id: true,
        name: true,
        avatar: true,
        achievements: {
          select: { points: true }
        }
      }
    });

    const leaderboard = usersWithPoints.map(u => ({
      userId: u.id,
      name: u.name,
      avatar: (u.name || '?').charAt(0).toUpperCase(),
      points: u.achievements.reduce((sum, a) => sum + a.points, 0)
    })).sort((a, b) => b.points - a.points).slice(0, 10);

    // Add rank
    const rankedLeaderboard = leaderboard.map((entry, index) => ({
      ...entry,
      rank: index + 1,
      isCurrentUser: entry.userId === req.user.id
    }));

    res.json(rankedLeaderboard);
  } catch (err) {
    console.error('getLeaderboard error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

// ─── STUDENT STATS ──────────────────────────────────────
const getStudentStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const student = await prisma.student.findUnique({
      where: { userId },
      include: {
        achievements: true,
        user: { select: { loginCount: true } }
      }
    });

    if (!student) return res.status(404).json({ error: 'Student not found.' });

    const totalPoints = student.achievements.reduce((sum, a) => sum + (a.points || 0), 0);
    const achievementCount = student.achievements.length;
    
    // Simplistic streak based on login count and recent activity (mocked for now)
    const streak = Math.min(student.user.loginCount, 7); 

    res.json({ totalPoints, streak, achievementCount, achievements: student.achievements });
  } catch (err) {
    console.error('getStudentStats error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

// ─── POINT HISTORY ──────────────────────────────────────
const getPointHistory = async (req, res) => {
  try {
    const achievements = await prisma.achievement.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    const history = achievements.map(a => ({
      action: a.title,
      points: a.points,
      time: a.createdAt
    }));

    res.json(history);
  } catch (err) {
    console.error('getPointHistory error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

module.exports = { getLeaderboard, getStudentStats, getPointHistory };
