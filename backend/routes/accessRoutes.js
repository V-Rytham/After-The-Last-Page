import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { checkAccess, checkAccessBatch, requestMeetFallback } from '../controllers/accessController.js';

const router = express.Router();

router.use(requireAuth);

router.get('/check', checkAccess);
router.post('/check-batch', checkAccessBatch);
router.post('/fallback/meet', requestMeetFallback);

export default router;
