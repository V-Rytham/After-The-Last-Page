import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getThreadsByBook, createThread, addComment, likeThread, likeComment } from '../controllers/threadController.js';

const router = express.Router();

router.use(requireAuth);

router.get('/:bookId', getThreadsByBook);
router.post('/', createThread);
router.post('/:id/comments', addComment);
router.post('/:id/like', likeThread);
router.post('/:threadId/comments/:commentId/like', likeComment);

export default router;
