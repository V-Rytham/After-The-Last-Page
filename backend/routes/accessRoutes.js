import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { checkAccess, checkAccessBatch, requestMeetFallback } from '../controllers/accessController.js';
import { asyncRoute } from '../middleware/asyncRoute.js';

const router = express.Router();

router.use(requireAuth);

router.get('/check', asyncRoute(checkAccess, 'access.check'));
router.post('/check-batch', asyncRoute(checkAccessBatch, 'access.checkBatch'));
router.post('/fallback/meet', asyncRoute(requestMeetFallback, 'access.requestMeetFallback'));

export default router;
