import express from 'express';
import { getBooks, getBookById, getBookContent } from '../controllers/bookController.js';
import { getBookQuizQuestions, verifyBookQuizAnswers } from '../controllers/bookQuizController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', getBooks);
router.get('/:id/content', getBookContent);
router.get('/:id/questions', protect, getBookQuizQuestions);
router.post('/:id/questions/verify', protect, verifyBookQuizAnswers);
router.get('/:id', getBookById);

export default router;
