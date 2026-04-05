import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getQuizQuestions, submitQuiz } from '../controllers/quizController.js';
import { getQuizJobResult, getQuizJobStatus, startQuizJob } from '../controllers/quizJobController.js';

const router = express.Router();

router.use(requireAuth);

router.post('/start', startQuizJob);
router.get('/status/:jobId', getQuizJobStatus);
router.get('/result/:jobId', getQuizJobResult);
router.get('/questions', getQuizQuestions);
router.post('/submit', submitQuiz);

export default router;
