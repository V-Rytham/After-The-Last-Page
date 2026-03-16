import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import QuestionCard from '../components/verification/QuestionCard';
import ProgressBar from '../components/verification/ProgressBar';
import './VerifyReading.css';

const PROCESSING_MESSAGE = 'Questions for this book are being generated. Please try again shortly.';
const FAIL_MESSAGE = 'You need at least 3 correct answers to unlock discussions for this book.';
const verificationApi = axios.create({
  baseURL: 'https://deterministic-question-engine.onrender.com',
  headers: {
    'Content-Type': 'application/json',
  },
});

const VerifyReading = () => {
  const { isbn, bookId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [attemptId, setAttemptId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const redirectTarget = location.state?.from || (bookId ? `/meet/${bookId}` : '/threads');

  const getStartPath = useCallback(() => {
    if (bookId) {
      return `/verification/start/book/${encodeURIComponent(bookId)}`;
    }

    return `/verification/start/${encodeURIComponent(String(isbn || ''))}`;
  }, [bookId, isbn]);

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await verificationApi.post(`/verification/start/${isbn}`);
      if (data.alreadyVerified) {
        navigate(redirectTarget, { replace: true });
        return;
      }
      setAttemptId(data.attemptId);
      setQuestions(data.questions || []);
      setAnswers(new Array((data.questions || []).length).fill(null));
      setIndex(0);
    } catch (err) {
      if (err?.response?.status === 202 || err?.response?.data?.status === 'processing') {
        setError(PROCESSING_MESSAGE);
      } else {
        setError(err?.response?.data?.message || 'Failed to load verification questions.');
      }
    } finally {
      setLoading(false);
    }
  }, [getStartPath, navigate, redirectTarget]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  const onSelect = (selected) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[index] = selected;
      return next;
    });
  };

  const onNext = () => setIndex((prev) => Math.min(prev + 1, questions.length - 1));

  const onSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const { data } = await verificationApi.post('/verification/submit', {
        attemptId,
        answers,
      });

      if (data.passed) {
        navigate(redirectTarget, { replace: true });
        return;
      }

      setError(data.message || FAIL_MESSAGE);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to submit answers.');
    } finally {
      setSubmitting(false);
    }
  };

  const canAdvance = useMemo(() => answers[index] !== null && answers[index] !== undefined, [answers, index]);
  const isFinalQuestion = index === questions.length - 1;

  return (
    <div className="verify-page animate-fade-in">
      <div className="verify-shell">
        <h1 className="font-serif">Verify your reading</h1>
        <p>Answer at least 3 of 5 questions correctly to unlock discussion features.</p>

        {loading ? (
          <div className="verify-message glass-panel">Loading questions...</div>
        ) : error && questions.length === 0 ? (
          <div className="verify-message glass-panel">
            <p>{error}</p>
            <button className="btn-primary" onClick={loadQuestions}>Retry</button>
          </div>
        ) : (
          <>
            <ProgressBar current={index + 1} total={questions.length} />
            <QuestionCard question={questions[index]} selectedIndex={answers[index]} onSelect={onSelect} />

            {error && <p className="verify-error">{error}</p>}

            <div className="verify-actions">
              {!isFinalQuestion ? (
                <button className="btn-primary" disabled={!canAdvance} onClick={onNext}>Next</button>
              ) : (
                <button className="btn-primary" disabled={!canAdvance || submitting} onClick={onSubmit}>
                  {submitting ? 'Submitting...' : 'Submit'}
                </button>
              )}
              <button className="btn-secondary" onClick={loadQuestions}>Retry with new questions</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default VerifyReading;
