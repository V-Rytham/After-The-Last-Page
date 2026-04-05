import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getThreadsByBook, createThread, addComment, likeThread, likeComment } from '../controllers/threadController.js';
import { asyncRoute } from '../middleware/asyncRoute.js';

const router = express.Router();

router.use(requireAuth);

router.get('/:bookId', asyncRoute(getThreadsByBook, 'threads.byBook'));
router.post('/', asyncRoute(createThread, 'threads.create'));
router.post('/:id/comments', asyncRoute(addComment, 'threads.comment'));
router.post('/:id/like', asyncRoute(likeThread, 'threads.likeThread'));
router.post('/:threadId/comments/:commentId/like', asyncRoute(likeComment, 'threads.likeComment'));

export default router;
