import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, LockKeyhole, MessageSquare, ShieldCheck } from 'lucide-react';
import api from '../utils/api';
import { getFallbackBooks } from '../utils/bookFallback';
import { getBookAccessState } from '../utils/readingAccess';
import BookCoverArt from '../components/books/BookCoverArt';
import './ThreadAccessHub.css';

const ThreadAccessHub = ({ currentUser }) => {
  const navigate = useNavigate();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState(null);
  const isMember = Boolean(currentUser && !currentUser.isAnonymous);

  const getDisplayTitle = (title) => String(title || '').split(':')[0].split(';')[0].trim();

  useEffect(() => {
    const fetchBooks = async () => {
      try {
        const { data } = await api.get('/books');
        setBooks(data);
      } catch (error) {
        console.error('Failed to fetch books for thread access, using fallback:', error);
        setBooks(getFallbackBooks());
      } finally {
        setLoading(false);
      }
    };

    fetchBooks();
  }, []);

  const bookCards = useMemo(
    () =>
      books.map((book) => {
        const access = getBookAccessState(book._id || book.id);
        return { book, access };
      }),
    [books],
  );

  const handleThreadAccess = (book) => {
    if (!isMember) {
      navigate('/auth');
      return;
    }

    const bookId = book._id || book.id;
    const access = getBookAccessState(bookId);

    if (!access.isRead) {
      setNotice({
        type: 'warning',
        title: 'Read the book first',
        message: `You need to finish ${book.title} before entering its community thread.`,
        actionLabel: 'Start Reading',
        action: () => navigate(`/read/${bookId}`),
      });
      return;
    }

    if (!access.quizPassed) {
      navigate(`/meet/${bookId}`, {
        state: {
          accessMode: 'thread-gate',
          notice: 'Please provide the answer to quiz questions to get access to threads.',
        },
      });
      return;
    }

    navigate(`/thread/${bookId}`, {
      state: {
        notice: `Welcome back. You have full access to ${book.title}'s thread.`,
      },
    });
  };

  return (
    <div className="thread-access-page animate-fade-in">
      <section className="thread-access-hero">
        <div className="thread-access-copy">
          <div className="thread-access-badge glass-panel">
            <MessageSquare size={16} />
            <span>Reader discussion access</span>
          </div>
          <h1 className="font-serif">Step into the reader-only thread.</h1>
          <p>Finish the book, pass the quiz once, and join the calm conversation.</p>
        </div>
      </section>

      {notice && (
        <div className={`thread-access-notice ${notice.type}`}>
          <div className="thread-access-notice-copy">
            <strong>{notice.title}</strong>
            <p>{notice.message}</p>
          </div>
          <div className="thread-access-notice-actions">
            <button className="btn-primary" onClick={notice.action}>
              {notice.actionLabel}
            </button>
            <button className="btn-secondary" onClick={() => setNotice(null)}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      <section className="thread-access-grid">
        {loading ? (
          <div className="thread-access-loading glass-panel">Loading thread rooms...</div>
        ) : (
          bookCards.map(({ book, access }) => {
            const bookId = book._id || book.id;
            const status = access.quizPassed
              ? {
                  label: 'Thread unlocked',
                  icon: <CheckCircle2 size={16} />,
                  className: 'unlocked',
                }
              : access.isRead
                ? {
                    label: 'Quiz required',
                    icon: <ShieldCheck size={16} />,
                    className: 'quiz-required',
                  }
                : {
                    label: 'Read required',
                    icon: <LockKeyhole size={16} />,
                    className: 'read-required',
                  };

            return (
              <article key={bookId} className="thread-access-card glass-panel">
                <div className="thread-access-mini-cover" style={{ '--book-accent': book.coverColor || '#6f614d' }}>
                  <BookCoverArt
                    book={book}
                    imgClassName="thread-access-mini-image"
                    fallbackClassName="thread-access-mini-fallback"
                    showSpine
                    showPattern={false}
                    spineClassName="thread-access-mini-spine"
                  />
                </div>

                <div className="thread-access-card-body">
                  <h2 className="font-serif thread-access-title" title={book.title}>
                    {getDisplayTitle(book.title)}
                  </h2>
                  <p className="thread-access-author" title={book.author}>{book.author}</p>
                </div>

                <div className="thread-access-actions">
                  <span className={`thread-status ${status.className}`}>
                    {status.icon}
                    {status.label}
                  </span>

                  <button className="btn-primary sm thread-access-button" onClick={() => handleThreadAccess(book)}>
                    {!isMember ? 'Sign in' : access.quizPassed ? 'Enter' : access.isRead ? 'Unlock' : 'Read first'}
                  </button>
                </div>
              </article>
            );
          })
        )}
      </section>
    </div>
  );
};

export default ThreadAccessHub;
