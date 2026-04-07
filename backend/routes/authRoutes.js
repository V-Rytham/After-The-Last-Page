import express from 'express';
import {
  googleAuthFailure,
  login,
  logout,
  me,
  signup,
  verifyOtp,
} from '../controllers/authController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/signup', signup);
router.post('/verify-otp', verifyOtp);
router.post('/login', login);
router.post('/logout', logout);
router.get('/me', requireAuth, me);

// POST route required by API contract.
router.post('/google', (_req, res) => {
  res.status(410).json({ message: 'Google authentication is disabled.' });
});
router.get('/google/start', (_req, res) => {
  res.status(410).json({ message: 'Google authentication is disabled.' });
});
router.get('/google/callback', (_req, res) => {
  res.status(410).json({ message: 'Google authentication is disabled.' });
});
router.get('/google/failure', googleAuthFailure);

export default router;
