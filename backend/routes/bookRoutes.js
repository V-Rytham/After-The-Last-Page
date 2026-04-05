import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncRoute } from '../middleware/asyncRoute.js';
import {
  getBooks,
  getBookById,
  readBook,
  readGutenbergBook,
  getGutenbergPreview,
  searchGutenbergBooks,
  searchBooksUnifiedController,
} from '../controllers/bookController.js';

const router = express.Router();

router.use(requireAuth);

router.get('/', asyncRoute(getBooks, 'books.list'));
router.get('/search', asyncRoute(searchBooksUnifiedController, 'books.search'));
router.get('/gutenberg/search', asyncRoute(searchGutenbergBooks, 'books.gutenberg.search'));
router.get('/gutenberg/:gutenbergId/preview', asyncRoute(getGutenbergPreview, 'books.gutenberg.preview'));
router.get('/gutenberg/:gutenbergId/read', asyncRoute(readGutenbergBook, 'books.gutenberg.read'));
router.get('/:id/read', asyncRoute(readBook, 'books.read'));
router.get('/:id', asyncRoute(getBookById, 'books.byId'));

export default router;
