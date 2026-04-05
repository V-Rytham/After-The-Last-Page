import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncRoute } from '../middleware/asyncRoute.js';
import {
  getBooks,
  getBookById,
  searchBooksController,
  readBookController,
} from '../controllers/bookController.js';

const router = express.Router();

router.use(requireAuth);

router.get('/', asyncRoute(getBooks, 'books.list'));
router.get('/search', asyncRoute(searchBooksController, 'books.search'));
router.get('/read', asyncRoute(readBookController, 'books.read'));
router.get('/:id', asyncRoute(getBookById, 'books.byId'));

export default router;
