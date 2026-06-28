const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { protect, admin, authorize } = require('../middleware/authMiddleware');
const maintenanceMiddleware = require('../middleware/maintenanceMiddleware');
const upload = require('../middleware/uploadMiddleware');
const { cacheMiddleware } = require('../middleware/cacheMiddleware');

const simulationController = require('../controllers/simulationController');

// Public branding settings (No auth required)
router.get('/settings/public', adminController.getPublicSettings);

router.use(protect);
router.use(maintenanceMiddleware);
// Removed global router.use(admin) to allow for granular permission checks below

// Simulations (Delegated to manage_courses or manage_resources)
router.get('/simulations', authorize('manage_resources'), simulationController.getAllSimulations);
router.post('/simulations', authorize('manage_resources'), simulationController.createSimulation);
router.put('/simulations/:id', authorize('manage_resources'), simulationController.updateSimulation);
router.delete('/simulations/:id', authorize('manage_resources'), simulationController.deleteSimulation);

// Dashboard & Stats
router.get('/dashboard', authorize('view_analytics'), cacheMiddleware, adminController.getDashboard);
router.get('/analytics', authorize('view_analytics'), cacheMiddleware, adminController.getAnalytics);
router.get('/risk-report', authorize('view_analytics'), adminController.getRiskReport);

// User Management & Roles
router.get('/users', authorize('manage_users', 'manage_roles'), cacheMiddleware, adminController.getUsers);
router.get('/users/export', authorize('manage_users'), adminController.exportUsers);
router.get('/users/:id/details', authorize('manage_users', 'manage_roles'), adminController.getUserDetails);
router.post('/users', authorize('manage_users'), adminController.createUser);
router.put('/users/:id', authorize('manage_users', 'manage_roles'), adminController.updateUser);
router.delete('/users/:id', authorize('manage_users'), adminController.deleteUser);
router.post('/users/:id/reset-password', authorize('manage_users'), adminController.resetPassword);
router.post('/users/bulk-upload', authorize('manage_users'), adminController.bulkUploadUsers);

// Class Management
router.get('/classes', authorize('manage_academic'), cacheMiddleware, adminController.getClasses);
router.post('/classes', authorize('manage_academic'), adminController.createClass);
router.put('/classes/:id', authorize('manage_academic'), adminController.updateClass);
router.delete('/classes/:id', authorize('manage_academic'), adminController.deleteClass);

// Subject Management
router.get('/subjects', authorize('manage_academic'), cacheMiddleware, adminController.getSubjects);
router.post('/subjects', authorize('manage_academic'), adminController.createSubject);
router.put('/subjects/:id', authorize('manage_academic'), adminController.updateSubject);
router.delete('/subjects/:id', authorize('manage_academic'), adminController.deleteSubject);

// Course Management (Admin level)
router.get('/courses', authorize('manage_courses'), cacheMiddleware, adminController.getCourses);
router.post('/courses', authorize('manage_courses'), adminController.createCourse);
router.get('/courses/:id', authorize('manage_courses'), adminController.getCourseById);
router.put('/courses/:id', authorize('manage_courses'), adminController.updateCourse);
router.delete('/courses/:id', authorize('manage_courses'), adminController.deleteCourse);

// Settings
router.get('/settings', authorize('manage_settings'), adminController.getSettings);
router.put('/settings', authorize('manage_settings'), adminController.updateSettings);
router.post('/settings/upload-logo', authorize('manage_settings'), upload.single('logo'), adminController.uploadLogo);
router.post('/verify-password', authorize('manage_settings'), adminController.verifyPassword);

// Quizzes (Admin view & manage)
router.get('/quizzes', authorize('approve_content'), cacheMiddleware, adminController.getQuizzes);
router.get('/quizzes/:id', authorize('approve_content'), cacheMiddleware, adminController.getQuizById);
router.get('/quizzes/:id/export/word', authorize('approve_content'), adminController.exportQuizToWord);
router.get('/quizzes/:id/export/csv', authorize('approve_content'), adminController.exportQuizToCSV);
router.post('/quizzes/:id/import/csv', authorize('approve_content'), upload.single('file'), adminController.importQuizFromCSV);
router.post('/quizzes', authorize('approve_content'), adminController.createQuiz);
router.put('/quizzes/:id', authorize('approve_content'), adminController.updateQuiz);
router.delete('/quizzes/:id', authorize('approve_content'), adminController.deleteQuiz);

// Assignments (Admin view)
router.get('/assignments', authorize('approve_content'), cacheMiddleware, adminController.getAssignments);

// Notifications / Announcements
router.get('/notifications', authorize('send_announcements'), adminController.getNotifications);
router.post('/notifications', authorize('send_announcements'), adminController.createNotification);
router.delete('/notifications/:id', authorize('send_announcements'), adminController.deleteNotification);

// Live Classes (Admin view)
router.get('/live-classes', authorize('manage_courses'), adminController.getLiveClasses);

// Gradebook (Admin view)
router.get('/gradebook', authorize('view_all_grades'), adminController.getGradebook);
router.get('/students/:studentId/report-card', authorize('view_all_grades'), adminController.getStudentReportCardData);

// Materials (Resource Library)
router.get('/materials', authorize('manage_resources'), cacheMiddleware, adminController.getMaterials);
router.post('/materials', authorize('manage_resources'), upload.single('material'), adminController.createMaterial);
router.put('/materials/:id', authorize('manage_resources'), adminController.updateMaterial);
router.delete('/materials/:id', authorize('manage_resources'), adminController.deleteMaterial);

router.get('/audit-logs', authorize('view_audit_logs'), adminController.getAuditLogs);
router.delete('/audit-logs/:id', authorize('view_audit_logs'), adminController.deleteAuditLog);
router.get('/health', admin, adminController.getSystemHealth);
router.get('/backups', admin, adminController.getBackups);
router.post('/backups', admin, adminController.createBackup);
router.get('/backups/:filename', admin, adminController.downloadBackup);
router.delete('/backups/:filename', admin, adminController.deleteBackup);
router.post('/backups/upload-restore', admin, upload.single('backup'), adminController.uploadRestoreBackup);
router.post('/backups/:filename/restore', admin, adminController.restoreBackup);

module.exports = router;
