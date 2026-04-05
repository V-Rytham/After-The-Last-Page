import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { createMatchmakingController } from '../controllers/matchmakingController.js';

export const buildMatchmakingRoutes = (sessionManager) => {
  const router = express.Router();

  router.use(requireAuth);
  const controller = createMatchmakingController(sessionManager);

  router.post('/join', controller.join);
  router.post('/leave', controller.leave);

  return router;
};
