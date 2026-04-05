import express from 'express';
import { login, logout, me, register } from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncRoute } from '../middleware/asyncRoute.js';

const router = express.Router();

router.post('/register', asyncRoute(register, 'auth.register'));
router.post('/login', asyncRoute(login, 'auth.login'));
router.post('/logout', asyncRoute(logout, 'auth.logout'));
router.get('/me', requireAuth, asyncRoute(me, 'auth.me'));

export default router;
