import express from 'express';
import { getRecommendations } from '../controllers/recommenderController.js';

const router = express.Router();

// POST /api/recommender
// Body: { currentBookId?: string, readBookIds?: string[], limitPerShelf?: number }
router.post('/', getRecommendations);

export default router;
