import express from 'express';
import { endAgentSession, sendAgentMessage, startAgentSession } from '../controllers/agentController.js';
import { requireAuth, requireUserMatch } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { endSessionSchema, sendMessageSchema, startSessionSchema } from '../validation/agentSchemas.js';
import { asyncHandler } from '../lib/http.js';

const router = express.Router();

router.post('/start', requireAuth, validateBody(startSessionSchema), requireUserMatch, asyncHandler(startAgentSession));
router.post('/message', requireAuth, validateBody(sendMessageSchema), asyncHandler(sendAgentMessage));
router.post('/end', requireAuth, validateBody(endSessionSchema), asyncHandler(endAgentSession));

export default router;
