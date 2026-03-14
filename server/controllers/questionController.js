import mongoose from 'mongoose';
import { BookQuestion } from '../models/BookQuestion.js';

const OPTION_KEYS = ['A', 'B', 'C', 'D'];

const shuffle = (values) => {
  const cloned = [...values];
  for (let i = cloned.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [cloned[i], cloned[j]] = [cloned[j], cloned[i]];
  }
  return cloned;
};

const toObjectId = (id) => {
  if (mongoose.isValidObjectId(id)) {
    return new mongoose.Types.ObjectId(id);
  }
  return id;
};

const formatQuestion = (question) => {
  const options = shuffle([
    { key: 'A', text: question.optionA },
    { key: 'B', text: question.optionB },
    { key: 'C', text: question.optionC },
    { key: 'D', text: question.optionD },
  ]);

  return {
    questionId: question._id,
    question: question.question,
    options: options.map((option, index) => ({
      id: OPTION_KEYS[index],
      text: option.text,
      isCorrect: option.text === question.correctAnswer,
    })),
  };
};

export const getRandomQuestionsByBook = async (req, res) => {
  try {
    const bookId = toObjectId(req.params.id);
    const limit = Math.max(1, Math.min(10, Number.parseInt(req.query.limit, 10) || 5));

    const questions = await BookQuestion.aggregate([
      { $match: { bookId } },
      { $sample: { size: limit } },
    ]);

    if (!questions.length) {
      res.status(404).json({ message: 'Questions are not available for this book yet.' });
      return;
    }

    const payload = questions.map((question) => {
      const formatted = formatQuestion(question);
      return {
        questionId: formatted.questionId,
        question: formatted.question,
        options: formatted.options.map(({ id, text }) => ({ id, text })),
      };
    });

    res.json({ bookId: req.params.id, questions: payload });
  } catch (error) {
    console.error('[QUESTION] Failed to fetch questions:', error?.message || error);
    res.status(500).json({ message: 'Failed to load questions.' });
  }
};

export const verifyBookAnswers = async (req, res) => {
  try {
    const bookId = toObjectId(req.params.id);
    const answers = Array.isArray(req.body?.answers) ? req.body.answers : [];

    if (!answers.length) {
      res.status(400).json({ message: 'answers payload is required.' });
      return;
    }

    const questionIds = answers
      .map((answer) => answer.questionId)
      .filter((id) => mongoose.isValidObjectId(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    const questionDocs = await BookQuestion.find({
      _id: { $in: questionIds },
      bookId,
    }).lean();

    const byId = new Map(questionDocs.map((doc) => [String(doc._id), doc]));

    let score = 0;
    const breakdown = answers.map((answer) => {
      const doc = byId.get(String(answer.questionId));
      if (!doc) {
        return { questionId: answer.questionId, isCorrect: false, expected: null };
      }

      const optionMap = {
        A: doc.optionA,
        B: doc.optionB,
        C: doc.optionC,
        D: doc.optionD,
      };

      const selectedText = optionMap[String(answer.selectedOption || '').toUpperCase()] || null;
      const isCorrect = selectedText === doc.correctAnswer;
      if (isCorrect) {
        score += 1;
      }

      return {
        questionId: answer.questionId,
        isCorrect,
        expected: doc.correctAnswer,
      };
    });

    const total = breakdown.length;
    const passThreshold = Math.max(3, Math.ceil(total * 0.6));
    const passed = score >= passThreshold;

    res.json({
      score,
      total,
      passThreshold,
      passed,
      breakdown,
    });
  } catch (error) {
    console.error('[QUESTION] Failed to verify answers:', error?.message || error);
    res.status(500).json({ message: 'Failed to verify answers.' });
  }
};
