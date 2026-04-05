import { z } from 'zod';
import { error, success } from '../utils/apiResponse.js';
import { SESSION_STATES } from '../utils/sessionStates.js';

const startSessionSchema = z.object({
  state: z.enum(Object.values(SESSION_STATES)).optional(),
  bookId: z.string().trim().min(1).optional(),
  prefType: z.string().trim().min(1).optional(),
  roomId: z.string().trim().min(1).optional(),
});

const endSessionSchema = z.object({ reason: z.string().trim().max(120).optional() });

export const createSessionController = (sessionManager) => {
  if (!sessionManager) {
    throw new Error('sessionManager is required');
  }

  const startSession = async (req, res) => {
    try {
      const userId = req.auth?.sub || req.user?._id;
      if (!userId) return error(res, 'Unauthorized.', 'UNAUTHORIZED', 401);

      const payload = startSessionSchema.parse(req.body ?? {});
      const patch = {};
      if (payload.bookId) patch.bookId = payload.bookId;
      if (payload.prefType) patch.prefType = payload.prefType;
      if (payload.roomId) patch.roomId = payload.roomId;

      sessionManager.ensureSession(userId, patch);
      if (payload.state) {
        sessionManager.setState(userId, payload.state, patch);
      }

      return success(res, { session: sessionManager.getSession(userId) });
    } catch (err) {
      if (err?.name === 'ZodError') return error(res, 'Invalid session payload.', 'VALIDATION_ERROR', 400);
      return error(res, 'Failed to start session.', err?.code || 'SESSION_START_FAILED', err?.statusCode || 500);
    }
  };

  const endSession = async (req, res) => {
    try {
      const userId = req.auth?.sub || req.user?._id;
      if (!userId) return error(res, 'Unauthorized.', 'UNAUTHORIZED', 401);

      const payload = endSessionSchema.parse(req.body ?? {});
      await sessionManager.endSession(userId, { reason: payload.reason || 'ended' });
      return success(res, { session: sessionManager.getSession(userId) });
    } catch (err) {
      if (err?.name === 'ZodError') return error(res, 'Invalid session payload.', 'VALIDATION_ERROR', 400);
      return error(res, 'Failed to end session.', err?.code || 'SESSION_END_FAILED', err?.statusCode || 500);
    }
  };

  const getStatus = async (req, res) => {
    try {
      const userId = req.auth?.sub || req.user?._id;
      if (!userId) return error(res, 'Unauthorized.', 'UNAUTHORIZED', 401);
      return success(res, { session: sessionManager.getSession(userId) });
    } catch (err) {
      return error(res, 'Failed to fetch session status.', err?.code || 'SESSION_STATUS_FAILED', err?.statusCode || 500);
    }
  };

  return { startSession, endSession, getStatus };
};
