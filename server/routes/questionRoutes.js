import express from 'express';
import { getRandomQuestionsByBook, verifyBookAnswers } from '../controllers/questionController.js';

const router = express.Router({ mergeParams: true });

router.get('/', getRandomQuestionsByBook);
router.post('/verify', verifyBookAnswers);

export default router;
