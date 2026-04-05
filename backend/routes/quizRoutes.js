import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getQuizQuestions, submitQuiz } from '../controllers/quizController.js';
import { getQuizJobResult, getQuizJobStatus, startQuizJob } from '../controllers/quizJobController.js';
import { asyncRoute } from '../middleware/asyncRoute.js';

const router = express.Router();

router.use(requireAuth);

router.post('/start', asyncRoute(startQuizJob, 'quiz.start'));
router.get('/status/:jobId', asyncRoute(getQuizJobStatus, 'quiz.status'));
router.get('/result/:jobId', asyncRoute(getQuizJobResult, 'quiz.result'));
router.get('/questions', asyncRoute(getQuizQuestions, 'quiz.questions'));
router.post('/submit', asyncRoute(submitQuiz, 'quiz.submit'));

export default router;
