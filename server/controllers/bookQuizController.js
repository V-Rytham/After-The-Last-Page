import mongoose from 'mongoose';
import { Book } from '../models/Book.js';
import { BookQuestion } from '../models/BookQuestion.js';

const parseRouteBookId = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  const gutenbergMatch = raw.match(/^g?(\d+)$/);
  if (gutenbergMatch) {
    return { gutenbergId: Number.parseInt(gutenbergMatch[1], 10) };
  }

  if (mongoose.Types.ObjectId.isValid(raw)) {
    return { _id: raw };
  }

  return null;
};

const resolveBookId = async (routeBookId) => {
  const query = parseRouteBookId(routeBookId);
  if (!query) {
    return null;
  }

  const book = await Book.findOne(query).select('_id').lean();
  return book?._id ? String(book._id) : null;
};

const shuffleInPlace = (array) => {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

const normalizeOption = (value) => String(value || '').trim().toLowerCase();

export const getBookQuizQuestions = async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(10, Number.parseInt(req.query.limit || '5', 10) || 5));
    const bookId = await resolveBookId(req.params.id);
    if (!bookId) {
      return res.status(404).json({ message: 'Book not found.' });
    }

    const sampled = await BookQuestion.aggregate([
      { $match: { bookId: new mongoose.Types.ObjectId(bookId) } },
      { $sample: { size: limit } },
      { $project: { question: 1, optionA: 1, optionB: 1, optionC: 1, optionD: 1 } },
    ]);

    if (!sampled.length) {
      return res.status(404).json({ message: 'No quiz questions available for this book yet.' });
    }

    const questions = sampled.map((item) => {
      const options = shuffleInPlace([
        { option: 'a', text: item.optionA },
        { option: 'b', text: item.optionB },
        { option: 'c', text: item.optionC },
        { option: 'd', text: item.optionD },
      ]);

      return {
        question_id: String(item._id),
        question: item.question,
        options,
      };
    });

    return res.json({ questions });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch quiz questions.', error: error.message });
  }
};

export const verifyBookQuizAnswers = async (req, res) => {
  try {
    const bookId = await resolveBookId(req.params.id);
    if (!bookId) {
      return res.status(404).json({ message: 'Book not found.' });
    }

    const answers = Array.isArray(req.body?.answers) ? req.body.answers : [];
    if (!answers.length) {
      return res.status(400).json({ message: 'answers are required.' });
    }

    const threshold = Number(req.body?.pass_threshold);
    const passThreshold = Number.isFinite(threshold) ? Math.max(0, Math.min(1, threshold)) : 0.6;

    const ids = answers
      .map((item) => item?.question_id)
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    if (!ids.length) {
      return res.status(400).json({ message: 'No valid question IDs provided.' });
    }

    const questions = await BookQuestion.find({
      _id: { $in: ids },
      bookId: new mongoose.Types.ObjectId(bookId),
    }).select('_id correctAnswer').lean();

    const answerMap = new Map(answers.map((item) => [String(item.question_id), normalizeOption(item.selected_option)]));

    let correctCount = 0;
    for (const question of questions) {
      const userAnswer = answerMap.get(String(question._id));
      const expected = normalizeOption(question.correctAnswer);
      if (userAnswer && userAnswer === expected) {
        correctCount += 1;
      }
    }

    const total = questions.length;
    const score = total ? correctCount / total : 0;

    return res.json({
      passed: score >= passThreshold,
      score,
      correct_count: correctCount,
      total,
      pass_threshold: passThreshold,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to verify quiz answers.', error: error.message });
  }
};
