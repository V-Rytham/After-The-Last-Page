import express from 'express';
import {
  getBooks,
  getBookById,
  readBook,
  readGutenbergBook,
  getGutenbergPreview,
  searchGutenbergBooks,
  searchBooks,
  readBookBySource,
} from '../controllers/bookController.js';

const router = express.Router();

router.get('/', getBooks);
router.get('/search', searchBooks);
router.get('/gutenberg/search', searchGutenbergBooks);
router.get('/gutenberg/:gutenbergId/preview', getGutenbergPreview);
router.get('/gutenberg/:gutenbergId/read', readGutenbergBook);
router.get('/read', readBookBySource);
router.get('/:id/read', readBook);
router.get('/:id', getBookById);

export default router;
