import { checkMeetAccess, checkQuizAccess, grantMeetFallback } from '../services/accessService.js';
import mongoose from 'mongoose';
import { UserProgress } from '../models/UserProgress.js';
import { buildSafeErrorBody } from '../utils/runtime.js';
import { success, error } from '../utils/apiResponse.js';
import { getDegradedAllowedBookIds, getDegradedQuizProgress, isDegradedMode } from '../utils/degradedMode.js';

export const checkAccess = async (req, res) => {
  try {
    const bookId = String(req.query?.bookId || '').trim();
    if (!bookId) {
      return error(res, 'bookId is required.', 'VALIDATION_ERROR', 400);
    }

    const context = String(req.query?.context || '').trim().toLowerCase();

    if (isDegradedMode()) {
      if (context === 'meet') {
        return success(res, { access: false, mode: 'degraded', fallback: true, message: 'Meet is unavailable in degraded mode.' });
      }

      const progress = getDegradedQuizProgress({ userId: req.user?._id, bookId });
      return success(res, { access: Boolean(progress?.quizPassed), mode: progress?.quizPassed ? 'quiz' : 'none', fallback: true });
    }

    if (context === 'meet') {
      const result = await checkMeetAccess({ userId: req.user?._id, bookId });
      return success(res, { access: result.access, mode: result.mode });
    }

    const result = await checkQuizAccess({ userId: req.user?._id, bookId });
    return success(res, { access: result.access, mode: result.access ? 'quiz' : 'none' });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json(buildSafeErrorBody('Failed to check access.', error));
  }
};

export const requestMeetFallback = async (req, res) => {
  try {
    const bookId = String(req.body?.bookId || '').trim();
    if (!bookId) {
      return error(res, 'bookId is required.', 'VALIDATION_ERROR', 400);
    }

    if (isDegradedMode()) {
      return success(res, { ok: false, fallback: true, message: 'Meet is unavailable in degraded mode.' });
    }

    await grantMeetFallback({ userId: req.user?._id, bookId, reason: req.body?.reason });
    return success(res, { ok: true });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json(buildSafeErrorBody('Failed to grant fallback.', error));
  }
};

export const checkAccessBatch = async (req, res) => {
  try {
    const bookIds = Array.isArray(req.body?.bookIds) ? req.body.bookIds : [];
    const context = String(req.body?.context || '').trim().toLowerCase();
    if (!bookIds.length) {
      return res.status(400).json({ message: 'bookIds must be a non-empty array.' });
    }

    if (bookIds.length > 120) {
      return res.status(400).json({ message: 'Too many bookIds in one request.' });
    }

    const normalized = bookIds.map((id) => String(id || '').trim());
    if (normalized.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
      return res.status(400).json({ message: 'One or more bookIds are invalid.' });
    }

    if (isDegradedMode()) {
      if (context === 'meet') {
        return success(res, { allowedBookIds: [], fallback: true, message: 'Meet is unavailable in degraded mode.' });
      }

      return success(res, {
        allowedBookIds: getDegradedAllowedBookIds({ userId: req.user?._id, bookIds: normalized }),
        fallback: true,
      });
    }

    let allowedBookIds = [];

    if (context === 'meet') {
      const checks = await Promise.allSettled(
        normalized.map(async (bookId) => {
          const result = await checkMeetAccess({ userId: req.user?._id, bookId });
          return result?.access ? bookId : null;
        }),
      );

      allowedBookIds = checks
        .map((entry) => (entry.status === 'fulfilled' ? entry.value : null))
        .filter(Boolean);
    } else {
      const records = await UserProgress.find({
        userId: req.user?._id,
        bookId: { $in: normalized },
        quizAttempted: true,
        quizPassed: true,
      }).select('bookId');

      allowedBookIds = records.map((rec) => String(rec.bookId));
    }

    return success(res, { allowedBookIds });
  } catch (error) {
    return res.status(500).json(buildSafeErrorBody('Failed to check access.', error));
  }
};
