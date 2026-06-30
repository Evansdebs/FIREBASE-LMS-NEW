const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const { protect, student } = require('../middleware/authMiddleware');
const maintenanceMiddleware = require('../middleware/maintenanceMiddleware');
const upload = require('../middleware/uploadMiddleware');
const { cacheMiddleware } = require('../middleware/cacheMiddleware');

const simulationController = require('../controllers/simulationController');

router.use(protect);
router.use(maintenanceMiddleware);
router.use(student);

// Dashboard
router.get('/dashboard', cacheMiddleware, studentController.getDashboard);

// Simulations
router.get('/simulations', simulationController.getAllSimulations);
router.post('/simulations/:id/access', simulationController.recordSimulationAccess);

// Courses & Materials
router.get('/my-courses', cacheMiddleware, studentController.getMyCourses);
router.get('/courses/:id', studentController.getCourseDetails);
router.get('/materials', cacheMiddleware, studentController.getMyMaterials);
router.post('/materials/:id/progress', studentController.updateMaterialProgress);

// Quiz System
router.get('/quizzes', cacheMiddleware, studentController.getAvailableQuizzes);
router.get('/quizzes/:id/start', studentController.startQuiz);
router.post('/quizzes/:id/submit', studentController.submitQuiz);
router.post('/quizzes/:id/terminate', studentController.terminateQuiz);
router.post('/quizzes/:id/strike', studentController.recordStrike);
router.get('/quizzes/attempts/:attemptId', studentController.getAttemptReview);

// Assignments
router.get('/my-assignments', cacheMiddleware, studentController.getMyAssignments);
router.get('/assignments', cacheMiddleware, studentController.getMyAssignments);
router.post('/assignments/:id/submit', upload.single('submission'), studentController.submitAssignment);

const participationController = require('../controllers/participationController');

// Performance & Gamification
router.get('/my-results', cacheMiddleware, studentController.getMyResults);
router.get('/my-attendance', cacheMiddleware, studentController.getMyAttendance);
router.get('/leaderboard', cacheMiddleware, participationController.getLeaderboard);
router.get('/participation/stats', cacheMiddleware, participationController.getStudentStats);
router.get('/participation/history', cacheMiddleware, participationController.getPointHistory);
router.get('/my-achievements', cacheMiddleware, studentController.getMyAchievements);
router.post('/pomodoro/complete', studentController.addPomodoroPoints);
router.get('/academic-reports', studentController.getAcademicReports);

// Live Classes
router.get('/live-classes', studentController.getMyLiveClasses);

// Timetable
router.get('/timetable', studentController.getTimetable);

module.exports = router;
