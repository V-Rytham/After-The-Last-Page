import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { createMatchmakingController } from '../controllers/matchmakingController.js';
import { asyncRoute } from '../middleware/asyncRoute.js';

export const buildMatchmakingRoutes = (sessionManager) => {
  const router = express.Router();

  router.use(requireAuth);
  const controller = createMatchmakingController(sessionManager);

  router.post('/join', asyncRoute(controller.join, 'matchmaking.join'));
  router.post('/leave', asyncRoute(controller.leave, 'matchmaking.leave'));

  return router;
};
