const prisma = require('../config/prisma');

const maintenanceMiddleware = async (req, res, next) => {
  try {
    // Skip lockdown check for specific paths if needed (e.g., auth)
    // But since this is applied globally or selectively, we can be specific.
    
    const settings = await prisma.settings.findFirst();
    
    if (settings && settings.lockdownMode) {
      // If lockdown is active, ONLY Super Admins can proceed
      // We assume req.user is already populated by protect middleware
      if (req.user && req.user.role === 'SUPER_ADMIN') {
        return next();
      }
      
      // Block everyone else
      return res.status(503).json({ 
        error: 'System Maintenance', 
        message: 'The system is currently undergoing maintenance. Please try again later.' 
      });
    }
    
    next();
  } catch (err) {
    console.error('Maintenance middleware error:', err);
    next(); // Proceed if check fails to avoid total lockout on DB error
  }
};

module.exports = maintenanceMiddleware;
