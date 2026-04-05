import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getRecommendations } from '../controllers/recommenderController.js';

const router = express.Router();

router.use(requireAuth);

// POST /api/recommender
// Body: { currentBookId?: string, readBookIds?: string[], limitPerShelf?: number }
router.post('/', getRecommendations);

export default router;
