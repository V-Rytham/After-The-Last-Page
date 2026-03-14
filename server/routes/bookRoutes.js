import express from 'express';
import { getBooks, getBookById, getBookContent } from '../controllers/bookController.js';
import questionRoutes from './questionRoutes.js';

const router = express.Router();

router.get('/', getBooks);
router.get('/:id/content', getBookContent);
router.use('/:id/questions', questionRoutes);
router.get('/:id', getBookById);

export default router;
