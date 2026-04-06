import express from 'express';
import passport from 'passport';
import {
  googleAuthFailure,
  googleCallbackSuccess,
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
  res.status(200).json({ authUrl: '/api/auth/google/start' });
});
router.get('/google/start', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));
router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/api/auth/google/failure', session: false }), googleCallbackSuccess);
router.get('/google/failure', googleAuthFailure);

export default router;
