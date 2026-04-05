import mongoose from 'mongoose';
import { success, error } from '../utils/apiResponse.js';

export const checkAccess = async (req, res) => {
  try {
    const bookId = String(req.query?.bookId || '').trim();
    if (!bookId) {
      return error(res, 'bookId is required.', 'VALIDATION_ERROR', 400);
    }

    return success(res, { access: true, mode: 'open' });
  } catch (apiError) {
    return res.status(500).json({ message: apiError.message || 'Failed to check access.' });
  }
};

export const requestMeetFallback = async (_req, res) => success(res, { ok: true });

export const checkAccessBatch = async (req, res) => {
  try {
    const bookIds = Array.isArray(req.body?.bookIds) ? req.body.bookIds : [];
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

    return success(res, { allowedBookIds: normalized });
  } catch (apiError) {
    return res.status(500).json({ message: apiError.message || 'Failed to check access.' });
  }
};
