import express from 'express';
import { checkAccess, checkAccessBatch, requestMeetFallback } from '../controllers/accessController.js';

const router = express.Router();

router.get('/check', checkAccess);
router.post('/check-batch', checkAccessBatch);
router.post('/fallback/meet', requestMeetFallback);

export default router;
