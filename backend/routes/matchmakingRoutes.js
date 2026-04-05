import express from 'express';
import { createMatchmakingController } from '../controllers/matchmakingController.js';

export const buildMatchmakingRoutes = (sessionManager) => {
  const router = express.Router();
  const controller = createMatchmakingController(sessionManager);

  router.post('/join', controller.join);
  router.post('/leave', controller.leave);

  return router;
};
