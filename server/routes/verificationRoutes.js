import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  getBookVerificationByBookId,
  getVerificationStatus,
  startVerificationByBookId,
  startVerificationByIsbn,
  submitVerificationAttempt,
} from '../controllers/verificationController.js';

const router = express.Router();

router.get('/status/isbn/:isbn', protect, getVerificationStatus);
router.get('/status/book/:bookId', protect, getBookVerificationByBookId);
router.post('/start/book/:bookId', protect, startVerificationByBookId);
router.post('/start/:isbn', protect, startVerificationByIsbn);
router.post('/submit', protect, submitVerificationAttempt);

export default router;
