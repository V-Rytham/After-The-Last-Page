import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { createSessionController } from '../controllers/sessionController.js';

export const buildSessionRoutes = (sessionManager) => {
  const router = express.Router();
  const controller = createSessionController(sessionManager);

  router.use(requireAuth);

  router.get('/status', controller.getStatus);
  router.post('/start', controller.startSession);
  router.post('/end', controller.endSession);

  return router;
};
