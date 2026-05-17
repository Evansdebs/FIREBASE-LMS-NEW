const prisma = require('../config/prisma');

const getAllSimulations = async (req, res) => {
  try {
    const simulations = await prisma.simulation.findMany({
      orderBy: { createdAt: 'desc' },
      include: { uploader: { select: { name: true } } }
    });
    res.json(simulations);
  } catch (err) {
    console.error('Get simulations error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

const createSimulation = async (req, res) => {
  try {
    const { title, description, category, iframeUrl, thumbnail, isGlobal } = req.body;
    
    if (!title || !iframeUrl) {
      return res.status(400).json({ error: 'Title and Iframe URL are required.' });
    }

    const simulation = await prisma.simulation.create({
      data: {
        title,
        description,
        category,
        iframeUrl,
        thumbnail,
        isGlobal: isGlobal === undefined ? true : isGlobal,
        uploadedBy: req.user.id
      }
    });

    res.status(201).json(simulation);
  } catch (err) {
    console.error('Create simulation error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

const updateSimulation = async (req, res) => {
  try {
    const { title, description, category, iframeUrl, thumbnail, isGlobal } = req.body;
    const id = parseInt(req.params.id);

    const simulation = await prisma.simulation.update({
      where: { id },
      data: {
        title,
        description,
        category,
        iframeUrl,
        thumbnail,
        isGlobal
      }
    });

    res.json(simulation);
  } catch (err) {
    console.error('Update simulation error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

const deleteSimulation = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.simulation.delete({ where: { id } });
    res.json({ message: 'Simulation deleted.' });
  } catch (err) {
    console.error('Delete simulation error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

const recordSimulationAccess = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.user.id;

    // Award points only to students
    if (req.user.role === 'STUDENT' || req.user.role === 'student') {
      const student = await prisma.student.findUnique({
        where: { userId }
      });

      if (student) {
        // Daily Anti-Spam Check: Limit to 3 simulation point awards per day
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const dailyCount = await prisma.achievement.count({
          where: {
            userId,
            title: { startsWith: 'Simulation:' },
            createdAt: { gte: today }
          }
        });

        if (dailyCount >= 3) {
          console.log(`Daily simulation point limit reached for student ${userId}`);
          return res.json({ message: 'Daily limit reached', awarded: 0 });
        }

        const sim = await prisma.simulation.findUnique({ where: { id } });
        const simTitle = sim ? sim.title : 'Scientific Lab';

        // Award points
        await prisma.student.update({
          where: { id: student.id },
          data: { points: { increment: 3 } }
        });

        // Record achievement for participation and history
        await prisma.achievement.create({
          data: {
            studentId: student.id,
            userId,
            title: `Simulation: ${simTitle}`,
            description: `Explored the interactive lab: ${simTitle}`,
            points: 3,
            badge: 'Flask'
          }
        });
        
        console.log(`Awarded 3 points to student ${student.id} for accessing simulation ${id}. (Daily count: ${dailyCount + 1})`);
        
        // Broadcast point update if wss is available
        const wss = req.app.get('wss');
        const clients = req.app.get('wsClients');
        if (wss && clients && clients.has(userId)) {
          console.log(`Broadcasting dashboard update to user ${userId}`);
          clients.get(userId).send(JSON.stringify({ type: 'REFRESH_DASHBOARD', reason: 'POINTS_AWARDED' }));
        }

        return res.json({ message: 'Points awarded', awarded: 3 });
      }
    }
    
    res.json({ message: 'Access recorded' });
  } catch (err) {
    console.error('Record simulation access error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

module.exports = {
  getAllSimulations,
  createSimulation,
  updateSimulation,
  deleteSimulation,
  recordSimulationAccess
};
