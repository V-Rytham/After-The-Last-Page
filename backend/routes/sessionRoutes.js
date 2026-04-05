import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { createSessionController } from '../controllers/sessionController.js';

export const buildSessionRoutes = (sessionManager) => {
  const router = express.Router();
  const controller = createSessionController(sessionManager);

  router.get('/status', protect, controller.getStatus);
  router.post('/start', protect, controller.startSession);
  router.post('/end', protect, controller.endSession);

  return router;
};
