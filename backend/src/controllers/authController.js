const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { schoolCode, email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    // Validate school code or fallback to default
    let settings;
    if (schoolCode) {
      settings = await prisma.settings.findUnique({ where: { schoolCode } });
    } else {
      settings = await prisma.settings.findFirst(); // Default to first school
    }

    if (!settings) {
      return res.status(400).json({ error: 'System configuration missing (invalid school).' });
    }

    // Find user
    const user = await prisma.user.findUnique({ 
      where: { email },
      include: {
        student: true,
        teacher: true
      }
    });

    if (!user) {
      await prisma.auditLog.create({
        data: {
          action: 'LOGIN_FAILED',
          details: `Failed login attempt for non-existent email: ${email}`,
          ipAddress: req.ip || req.headers['x-forwarded-for'] || null
        }
      });
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Check lockdown mode (except for Super Admin)
    if (settings.lockdownMode && user.role !== 'SUPER_ADMIN') {
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'LOGIN_BLOCKED',
          details: `Login blocked: platform in maintenance mode`,
          ipAddress: req.ip || req.headers['x-forwarded-for'] || null
        }
      });
      return res.status(503).json({ error: 'System is in maintenance mode.' });
    }

    if (!user.isActive) {
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'LOGIN_BLOCKED',
          details: `Login blocked: account is deactivated`,
          ipAddress: req.ip || req.headers['x-forwarded-for'] || null
        }
      });
      return res.status(403).json({ error: 'Account is deactivated.' });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'LOGIN_FAILED',
          details: `Failed login attempt (incorrect password)`,
          ipAddress: req.ip || req.headers['x-forwarded-for'] || null
        }
      });
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Update login stats
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLogin: new Date(),
        isOnline: true,
        loginCount: { increment: 1 }
      }
    });

    // Create successful login audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'LOGIN',
        details: `${user.role} logged in successfully`,
        ipAddress: req.ip || req.headers['x-forwarded-for'] || null
      }
    });

    // Check if user must change password
    if (user.mustChangePassword) {
      return res.status(200).json({ 
        mustChangePassword: true, 
        email: user.email,
        message: 'Password change required before access.' 
      });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        permissions: user.permissions,
      },
      school: {
        name: settings.schoolName,
        logo: settings.logo,
        primaryColor: settings.primaryColor,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login.' });
  }
};

// POST /api/auth/register
const register = async (req, res) => {
  try {
    const { name, email, password, role, classId } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered.' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    
    // ACID: wrap user + profile creation in a transaction
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          role: role || 'STUDENT',
        },
      });

      if (user.role === 'STUDENT') {
        await tx.student.create({
          data: {
            userId: user.id,
            classId: classId ? parseInt(classId) : null,
          },
        });
      } else if (user.role === 'TEACHER') {
        await tx.teacher.create({
          data: {
            userId: user.id,
          },
        });
      }
    });

    res.status(201).json({ message: 'User registered' });
  } catch (err) {
    res.status(500).json({ error: 'Register error' });
  }
};

// GET /api/auth/me
const getMe = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true, name: true, email: true, role: true, avatar: true, permissions: true,
        student: { include: { class: true } },
        teacher: true,
      },
    });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
};

// POST /api/auth/logout
const logout = async (req, res) => {
  try {
    if (req.user && req.user.id) {
      await prisma.user.update({
        where: { id: req.user.id },
        data: { isOnline: false }
      });
      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'LOGOUT',
          details: `User logged out`,
          ipAddress: req.ip || req.headers['x-forwarded-for'] || null
        }
      });
    }
    res.json({ message: 'Logged out' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// POST /api/auth/change-forced-password
const changeForcedPassword = async (req, res) => {
  try {
    const { email, password, newPassword } = req.body;
    if (!email || !password || !newPassword) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid current password.' });

    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashed,
        mustChangePassword: false,
        lastLogin: new Date(),
        isOnline: true,
        loginCount: { increment: 1 }
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'PASSWORD_RESET_FORCED',
        details: `User completed forced password reset`,
        ipAddress: req.ip || req.headers['x-forwarded-for'] || null
      }
    });

    const settings = await prisma.settings.findFirst();
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar, permissions: user.permissions },
      school: { name: settings?.schoolName, primaryColor: settings?.primaryColor }
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error during password change.' });
  }
};

module.exports = { login, register, getMe, logout, changeForcedPassword };
