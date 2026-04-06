import express from 'express';
import passport from 'passport';
import { login, logout, me, signup, verifyOtp, googleSuccess, googleFailure } from '../controllers/authController.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { rateLimit } from '../middleware/rateLimit.js';

const router = express.Router();

router.post('/signup', rateLimit({ windowMs: 60_000, max: 5, message: 'Too many signup attempts. Try later.' }), signup);
router.post('/verify-otp', rateLimit({ windowMs: 60_000, max: 10, message: 'Too many OTP attempts. Try later.' }), verifyOtp);
router.post('/login', rateLimit({ windowMs: 60_000, max: 20, message: 'Too many login attempts. Try later.' }), login);
router.post('/google', (_req, res) => res.redirect('/api/auth/google'));
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));
router.get('/google/callback', passport.authenticate('google', { session: false, failureRedirect: '/api/auth/google/failure' }), googleSuccess);
router.get('/google/failure', googleFailure);
router.post('/logout', logout);
router.get('/me', requireAuth, me);

export default router;
