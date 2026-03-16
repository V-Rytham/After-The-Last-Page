import mongoose from 'mongoose';
import { Thread } from '../models/Thread.js';
import { resolveBookAndIsbn, isUserVerifiedForIsbn } from '../utils/verification.js';

const buildSortQuery = (sort) => {
  if (sort === 'top' || sort === 'hot') {
    return { likes: -1, updatedAt: -1, createdAt: -1 };
  }

  return { updatedAt: -1, createdAt: -1 };
};

const findCommentById = (comments, commentId) => {
  for (const comment of comments) {
    if (String(comment._id) === String(commentId)) {
      return comment;
    }

    const nestedMatch = findCommentById(comment.replies || [], commentId);
    if (nestedMatch) {
      return nestedMatch;
    }
  }

  return null;
};


const ensureVerifiedAccess = async ({ userId, bookId }) => {
  const { book, isbn } = await resolveBookAndIsbn(bookId);
  if (!book) {
    return { ok: false, status: 404, message: 'Book not found.' };
  }

  if (!isbn) {
    return { ok: true };
  }

  const isVerified = await isUserVerifiedForIsbn(userId, isbn);
  if (!isVerified) {
    return { ok: false, status: 403, message: 'Complete and pass reading verification to access this discussion.' };
  }

  return { ok: true };
};

const toggleLike = (entity, actorId) => {
  if (!actorId) {
    return { liked: false };
  }

  if (!Array.isArray(entity.likedBy)) {
    entity.likedBy = [];
  }

  const actorKey = String(actorId);
  const existingIndex = entity.likedBy.findIndex((value) => String(value) === actorKey);
  const currentLikes = Number(entity.likes || 0);

  if (existingIndex >= 0) {
    entity.likedBy.splice(existingIndex, 1);
    entity.likes = Math.max(0, currentLikes - 1);
    return { liked: false };
  }

  entity.likedBy.push(actorKey);
  entity.likes = currentLikes + 1;
  return { liked: true };
};

export const getThreadsByBook = async (req, res) => {
  try {
    const threads = await Thread.find({ bookId: req.params.bookId })
      .sort(buildSortQuery(req.query.sort))
      .limit(50);

    res.json(threads);
  } catch {
    res.status(500).json({ message: 'Error fetching threads' });
  }
};

export const createThread = async (req, res) => {
  try {
    const { bookId, title, content, chapterReference } = req.body;

    if (!bookId || !title?.trim() || !content?.trim()) {
      return res.status(400).json({ message: 'Book, title, and content are required.' });
    }

    if (!mongoose.Types.ObjectId.isValid(bookId)) {
      return res.status(400).json({ message: 'Invalid book reference.' });
    }

    const accessCheck = await ensureVerifiedAccess({ userId: req.user?._id, bookId });
    if (!accessCheck.ok) {
      return res.status(accessCheck.status).json({ message: accessCheck.message });
    }

    const authorAnonId = req.user ? req.user.anonymousId : 'Anonymous Reader';

    const thread = await Thread.create({
      bookId,
      authorAnonId,
      title: title.trim(),
      chapterReference: chapterReference?.trim() || '',
      content: content.trim(),
      likes: 0,
      likedBy: [],
      comments: [],
    });

    res.status(201).json(thread);
  } catch {
    res.status(500).json({ message: 'Error creating thread' });
  }
};

export const addComment = async (req, res) => {
  try {
    const thread = await Thread.findById(req.params.id);
    if (!thread) {
      return res.status(404).json({ message: 'Thread not found' });
    }

    const accessCheck = await ensureVerifiedAccess({ userId: req.user?._id, bookId: thread.bookId });
    if (!accessCheck.ok) {
      return res.status(accessCheck.status).json({ message: accessCheck.message });
    }

    const content = req.body.content?.trim();
    if (!content) {
      return res.status(400).json({ message: 'Comment content is required.' });
    }

    const newComment = {
      authorAnonId: req.user ? req.user.anonymousId : 'Anonymous Reader',
      content,
      likes: 0,
      likedBy: [],
      replies: [],
    };

    if (req.body.parentId) {
      const parentComment = findCommentById(thread.comments, req.body.parentId);
      if (!parentComment) {
        return res.status(404).json({ message: 'Parent comment not found.' });
      }

      parentComment.replies.push(newComment);
    } else {
      thread.comments.push(newComment);
    }

    await thread.save();
    res.status(201).json(thread);
  } catch {
    res.status(500).json({ message: 'Error adding comment' });
  }
};

export const likeThread = async (req, res) => {
  try {
    const thread = await Thread.findById(req.params.id);
    if (!thread) {
      return res.status(404).json({ message: 'Thread not found' });
    }

    const accessCheck = await ensureVerifiedAccess({ userId: req.user?._id, bookId: thread.bookId });
    if (!accessCheck.ok) {
      return res.status(accessCheck.status).json({ message: accessCheck.message });
    }

    toggleLike(thread, req.user?._id);
    await thread.save();

    res.json(thread);
  } catch {
    res.status(500).json({ message: 'Error liking thread' });
  }
};

export const likeComment = async (req, res) => {
  try {
    const thread = await Thread.findById(req.params.threadId);
    if (!thread) {
      return res.status(404).json({ message: 'Thread not found' });
    }

    const accessCheck = await ensureVerifiedAccess({ userId: req.user?._id, bookId: thread.bookId });
    if (!accessCheck.ok) {
      return res.status(accessCheck.status).json({ message: accessCheck.message });
    }

    const comment = findCommentById(thread.comments, req.params.commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    toggleLike(comment, req.user?._id);
    await thread.save();

    res.json(thread);
  } catch {
    res.status(500).json({ message: 'Error liking comment' });
  }
};
