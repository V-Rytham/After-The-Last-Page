import mongoose from 'mongoose';
import { VerificationAttempt } from '../models/VerificationAttempt.js';
import { UserBookVerification } from '../models/UserBookVerification.js';
import { fetchQuestionsByIsbn } from '../services/questionService.js';
import { resolveBookAndIsbn, isUserVerifiedForBook, isUserVerifiedForIsbn } from '../utils/verification.js';

const REQUIRED_CORRECT = 3;

const toPublicQuestions = (questions) => questions.map((q) => ({
  question: q.question,
  options: q.options,
}));

export const getVerificationStatus = async (req, res) => {
  try {
    const { isbn } = req.params;
    const normalizedIsbn = String(isbn || '').trim();
    if (!normalizedIsbn) {
      return res.status(400).json({ message: 'ISBN is required.' });
    }

    const verified = await isUserVerifiedForIsbn(req.user._id, normalizedIsbn);
    return res.json({ isbn: normalizedIsbn, verified });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch verification status.', error: error.message });
  }
};

export const startVerificationByIsbn = async (req, res) => {
  try {
    const normalizedIsbn = String(req.params.isbn || '').trim();
    if (!normalizedIsbn) {
      return res.status(400).json({ message: 'ISBN is required.' });
    }

    const alreadyVerified = await isUserVerifiedForIsbn(req.user._id, normalizedIsbn);
    if (alreadyVerified) {
      return res.json({ isbn: normalizedIsbn, verified: true, alreadyVerified: true });
    }

    const questionPayload = await fetchQuestionsByIsbn(normalizedIsbn);
    if (questionPayload.status === 'processing') {
      return res.status(202).json({ status: 'processing' });
    }

    const questions = questionPayload.questions.map((q) => ({
      question: q.question,
      options: q.options,
      correctIndex: q.correct_index,
    }));

    const attempt = await VerificationAttempt.create({
      userId: req.user._id,
      isbn: normalizedIsbn,
      questions,
    });

    return res.status(201).json({
      isbn: normalizedIsbn,
      attemptId: attempt._id,
      questions: toPublicQuestions(questions),
      totalQuestions: questions.length,
      requiredCorrect: REQUIRED_CORRECT,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to start verification.', error: error.message });
  }
};

export const startVerificationByBookId = async (req, res) => {
  try {
    const { bookId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(bookId)) {
      return res.status(400).json({ message: 'Invalid book reference.' });
    }

    const { book, isbn } = await resolveBookAndIsbn(bookId);
    if (!book) {
      return res.status(404).json({ message: 'Book not found.' });
    }

    const alreadyVerified = await isUserVerifiedForBook({ userId: req.user._id, bookId: book._id, isbn });
    if (alreadyVerified) {
      return res.json({ bookId: String(book._id), isbn, verified: true, alreadyVerified: true });
    }

    const questionKey = isbn || `book-${book._id}`;
    const questionPayload = await fetchQuestionsByIsbn(questionKey);
    if (questionPayload.status === 'processing') {
      return res.status(202).json({ status: 'processing' });
    }

    const questions = questionPayload.questions.map((q) => ({
      question: q.question,
      options: q.options,
      correctIndex: q.correct_index,
    }));

    const attempt = await VerificationAttempt.create({
      userId: req.user._id,
      bookId: book._id,
      isbn: questionKey,
      questions,
    });

    return res.status(201).json({
      bookId: String(book._id),
      isbn,
      attemptId: attempt._id,
      questions: toPublicQuestions(questions),
      totalQuestions: questions.length,
      requiredCorrect: REQUIRED_CORRECT,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to start verification.', error: error.message });
  }
};

export const submitVerificationAttempt = async (req, res) => {
  try {
    const { attemptId, answers } = req.body;

    if (!mongoose.Types.ObjectId.isValid(attemptId)) {
      return res.status(400).json({ message: 'Valid attemptId is required.' });
    }

    if (!Array.isArray(answers) || answers.length !== 5) {
      return res.status(400).json({ message: 'Exactly 5 answers are required.' });
    }

    const attempt = await VerificationAttempt.findOne({ _id: attemptId, userId: req.user._id });
    if (!attempt) {
      return res.status(404).json({ message: 'Verification attempt not found or expired.' });
    }

    const score = attempt.questions.reduce((total, question, index) => {
      return total + (Number(answers[index]) === Number(question.correctIndex) ? 1 : 0);
    }, 0);

    const passed = score >= REQUIRED_CORRECT;

    if (passed) {
      await UserBookVerification.findOneAndUpdate(
        { userId: req.user._id, ...(attempt.bookId ? { bookId: attempt.bookId } : { isbn: attempt.isbn }) },
        {
          $set: {
            bookId: attempt.bookId || undefined,
            isbn: attempt.isbn,
            verified: true,
            verifiedAt: new Date(),
          },
        },
        { upsert: true, new: true },
      );
    }

    await VerificationAttempt.deleteOne({ _id: attempt._id });

    return res.json({
      isbn: attempt.isbn,
      score,
      totalQuestions: attempt.questions.length,
      requiredCorrect: REQUIRED_CORRECT,
      passed,
      message: passed
        ? 'Verification passed. Discussion features unlocked.'
        : 'You need at least 3 correct answers to unlock discussions for this book.',
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to submit verification attempt.', error: error.message });
  }
};

export const getBookVerificationByBookId = async (req, res) => {
  try {
    const { bookId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(bookId)) {
      return res.status(400).json({ message: 'Invalid book reference.' });
    }

    const { book, isbn } = await resolveBookAndIsbn(bookId);
    if (!book) {
      return res.status(404).json({ message: 'Book not found.' });
    }

    const verified = await isUserVerifiedForBook({ userId: req.user._id, bookId: book._id, isbn });
    return res.json({ verified, isbn, bookId: String(book._id) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to get book verification.', error: error.message });
  }
};
