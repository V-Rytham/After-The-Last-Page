import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { createSessionController } from '../controllers/sessionController.js';
import { asyncRoute } from '../middleware/asyncRoute.js';

export const buildSessionRoutes = (sessionManager) => {
  const router = express.Router();
  const controller = createSessionController(sessionManager);

  router.use(requireAuth);

  router.get('/status', asyncRoute(controller.getStatus, 'session.status'));
  router.post('/start', asyncRoute(controller.startSession, 'session.start'));
  router.post('/end', asyncRoute(controller.endSession, 'session.end'));

  return router;
};
