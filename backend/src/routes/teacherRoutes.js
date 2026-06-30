const express = require('express');
const router = express.Router();
const teacherController = require('../controllers/teacherController');
const { protect, teacher, authorize } = require('../middleware/authMiddleware');
const maintenanceMiddleware = require('../middleware/maintenanceMiddleware');
const upload = require('../middleware/uploadMiddleware');
const { cacheMiddleware } = require('../middleware/cacheMiddleware');

const simulationController = require('../controllers/simulationController');

router.use(protect);
router.use(maintenanceMiddleware);
router.use(teacher);

// Simulations (Read-only for teachers)
router.get('/simulations', simulationController.getAllSimulations);

// Dashboard
router.get('/dashboard', cacheMiddleware, teacherController.getDashboard);
router.get('/analytics', cacheMiddleware, teacherController.getAnalytics);
router.get('/risk-report', teacherController.getRiskReport);

// Gradebook
router.get('/gradebook', cacheMiddleware, teacherController.getGradebook);
router.get('/students/:studentId/report-card', teacherController.getStudentReportCardData);

// Courses & Topics
router.get('/my-courses', cacheMiddleware, teacherController.getMyCourses);
router.get('/courses/:id', cacheMiddleware, teacherController.getCourseDetails);
router.get('/courses/:id/overview', cacheMiddleware, teacherController.getCourseOverview);
router.post('/topics', teacherController.createTopic);
router.put('/topics/:id', teacherController.updateTopic);
router.delete('/topics/:id', teacherController.deleteTopic);

// Materials
router.get('/materials', cacheMiddleware, teacherController.getMyMaterials);
router.post('/materials', upload.single('material'), teacherController.uploadMaterial);
router.put('/materials/:id', teacherController.updateMaterial);
router.delete('/materials/:id', teacherController.deleteMaterial);

// Quiz System
router.get('/quizzes', cacheMiddleware, teacherController.getMyQuizzes);
router.post('/quizzes', teacherController.createQuiz);
router.put('/quizzes/:id', teacherController.updateQuiz);
router.delete('/quizzes/:id', teacherController.deleteQuiz);
router.get('/quizzes/:id', teacherController.getQuizById);
router.get('/quizzes/:id/results', teacherController.getQuizResults);

// Quiz Export
router.get('/quizzes/:id/export/word', teacherController.exportQuizToWord);
router.get('/quizzes/:id/export/csv', teacherController.exportQuizToCSV);
router.post('/quizzes/:id/import/csv', upload.single('file'), teacherController.importQuizFromCSV);

// Quiz Retake Grants
router.get('/quizzes/:id/grants', teacherController.getRetakeGrants);
router.post('/quizzes/:id/grants', teacherController.grantRetake);
router.delete('/quizzes/:id/grants/:grantId', teacherController.revokeRetake);

// Timetable System
router.get('/timetable', teacherController.getTimetable);
router.get('/timetable/config', teacherController.getTimetableConfig);
router.post('/timetable', teacherController.createTimetableEntry);
router.put('/timetable/:id', teacherController.updateTimetableEntry);
router.delete('/timetable/:id', teacherController.deleteTimetableEntry);

// Assignments
router.get('/assignments', cacheMiddleware, teacherController.getMyAssignments);
router.post('/assignments', upload.single('file'), teacherController.createAssignment);
router.put('/assignments/:id', upload.single('file'), teacherController.updateAssignment);
router.delete('/assignments/:id', teacherController.deleteAssignment);
router.get('/assignments/:id/export-grades', teacherController.exportAssignmentGrades);
router.get('/assignments/:id/submissions', teacherController.getAssignmentSubmissions);
router.put('/submissions/:id/grade', teacherController.gradeSubmission);

// Attendance
router.get('/attendance', teacherController.getAttendance);
router.post('/attendance', teacherController.markAttendance);

// Live Classes
router.get('/live-classes', teacherController.getMyLiveClasses);
router.post('/live-classes', teacherController.createLiveClass);
router.put('/live-classes/:id', teacherController.updateLiveClass);
router.delete('/live-classes/:id', teacherController.deleteLiveClass);

// Notes
router.get('/notes', cacheMiddleware, teacherController.getMyNotes);
router.post('/notes', teacherController.createNote);
router.put('/notes/:id', teacherController.updateNote);
router.delete('/notes/:id', teacherController.deleteNote);

module.exports = router;
