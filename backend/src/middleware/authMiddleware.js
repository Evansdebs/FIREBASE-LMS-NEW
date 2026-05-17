const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const prisma = require('../config/prisma');

const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.query.token) {
    token = req.query.token;
  }

  if (token) {
    try {

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      req.user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, name: true, email: true, role: true, isActive: true, permissions: true },
      });

      if (!req.user) {
        return res.status(401).json({ error: 'Not authorized, user not found' });
      }

      if (!req.user.isActive) {
        return res.status(401).json({ error: 'User account is deactivated' });
      }

      next();
    } catch (error) {
      console.error(error);
      res.status(401).json({ error: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    res.status(401).json({ error: 'Not authorized, no token' });
  }
});

const admin = (req, res, next) => {
  if (req.user && (req.user.role === 'SUPER_ADMIN' || req.user.role === 'super_admin' || req.user.role === 'ADMIN' || req.user.role === 'admin')) {
    next();
  } else {
    res.status(401).json({ error: 'Not authorized as an admin' });
  }
};

const teacher = (req, res, next) => {
  if (req.user && (req.user.role === 'TEACHER' || req.user.role === 'teacher' || req.user.role === 'SUPER_ADMIN' || req.user.role === 'super_admin')) {
    next();
  } else {
    res.status(401).json({ error: 'Not authorized as a teacher' });
  }
};

const student = (req, res, next) => {
  if (req.user && (req.user.role === 'STUDENT' || req.user.role === 'student')) {
    next();
  } else {
    res.status(401).json({ error: 'Not authorized as a student' });
  }
};

const authorize = (...permissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authorized, no user found' });
    }

    const isSuperAdmin = ['SUPER_ADMIN', 'super_admin', 'ADMIN', 'admin'].includes(req.user.role);
    
    if (isSuperAdmin) {
      return next();
    }

    // Check custom permissions for non-admins
    try {
      const userPerms = typeof req.user.permissions === 'string' 
        ? JSON.parse(req.user.permissions || '{}') 
        : (req.user.permissions || {});
      
      const hasAny = permissions.some(p => userPerms[p] === true);
      
      if (hasAny) {
        return next();
      }
    } catch (err) {
      console.error('Permission parse error:', err);
    }

    res.status(403).json({ error: `Forbidden: Missing one of required permissions [${permissions.join(', ')}]` });
  };
};

module.exports = { protect, admin, teacher, student, authorize };
