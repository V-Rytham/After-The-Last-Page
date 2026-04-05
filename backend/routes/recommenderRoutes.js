import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getRecommendations } from '../controllers/recommenderController.js';
import { asyncRoute } from '../middleware/asyncRoute.js';

const router = express.Router();

router.use(requireAuth);

// POST /api/recommender
// Body: { currentBookId?: string, readBookIds?: string[], limitPerShelf?: number }
router.post('/', asyncRoute(getRecommendations, 'recommender.get'));

export default router;
