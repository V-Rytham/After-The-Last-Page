import express from 'express';
import { endAgentSession, sendAgentMessage, startAgentSession } from '../controllers/agentController.js';
import { asyncRoute } from '../middleware/asyncRoute.js';

const router = express.Router();

router.post('/start', asyncRoute(startAgentSession, 'agent.start'));
router.post('/message', asyncRoute(sendAgentMessage, 'agent.message'));
router.post('/end', asyncRoute(endAgentSession, 'agent.end'));

export default router;
