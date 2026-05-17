require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const compression = require('compression');
const http = require('http');
const { WebSocketServer } = require('ws');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const teacherRoutes = require('./routes/teacherRoutes');
const studentRoutes = require('./routes/studentRoutes');
const messageRoutes = require('./routes/messageRoutes');
const noteRoutes = require('./routes/noteRoutes');
const shopRoutes = require('./routes/shopRoutes');
const forumRoutes = require('./routes/forumRoutes');
const calendarRoutes = require('./routes/calendarRoutes');
const { clearCache } = require('./middleware/cacheMiddleware');

const app = express();
const server = http.createServer(app);

const jwt = require('jsonwebtoken');

// ─── WEBSOCKET SETUP ────────────────────────────────────
const wss = new WebSocketServer({ server, path: '/ws' });
const clients = new Map();

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const token = url.searchParams.get('token');

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      clients.set(decoded.id, ws);
      ws.userId = decoded.id;
    } catch (err) {
      ws.close();
    }
  }

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      if (msg.type === 'auth' && msg.userId) {
        clients.set(msg.userId, ws);
        ws.userId = msg.userId;
      }
    } catch (e) {}
  });

  ws.on('close', () => {
    if (ws.userId) clients.delete(ws.userId);
  });
});

// Broadcast function for real-time updates
app.set('wss', wss);
app.set('wsClients', clients);

// ─── MIDDLEWARE ──────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:8080', 
  'http://localhost:5173', 
  'http://192.168.137.187:8080',
  'http://127.0.0.1:8080'
];

if (process.env.FRONTEND_URL) {
  const feUrl = process.env.FRONTEND_URL.replace(/\/$/, '');
  allowedOrigins.push(feUrl);
  allowedOrigins.push(`${feUrl}/`);
}

app.use(cors({ 
  origin: allowedOrigins, 
  credentials: true 
}));
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(compression());
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ─── RATE LIMITING (Security) ───────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per `window`
  message: { error: 'Too many requests from this IP, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

const loginLimiter = rateLimit({
  windowMs: 30 * 1000, // 30 seconds
  max: 5, // Limit each IP to 5 login attempts per `window`
  message: { error: 'Too many login attempts, please try again after 30 seconds' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply login-specific limiter
app.use('/api/auth/login', loginLimiter);
// Apply global api limiter
app.use('/api/', apiLimiter);

const aiTutorRoutes = require('./routes/aiTutorRoutes');

// Serve uploaded files
const uploadsPath = path.join(__dirname, '../uploads');
app.use('/uploads', express.static(uploadsPath));

// Auto-clear cache on state-changing operations
app.use((req, res, next) => {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    clearCache();
  }
  next();
});

// ─── API ROUTES ─────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/forums', forumRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/ai-tutor', aiTutorRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'ONEREAL LMS API is running', timestamp: new Date().toISOString() });
});

// ─── ERROR HANDLING ─────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error.',
  });
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

// ─── START SERVER ───────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 ONEREAL LMS Backend (PostgreSQL) running on port ${PORT}`);
});
