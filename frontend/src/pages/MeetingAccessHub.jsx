import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import api from '../utils/api';
import { getFallbackBooks } from '../utils/bookFallback';
import { getFinishedBookIds } from '../utils/readingSession';
import BookCoverArt from '../components/books/BookCoverArt';
import './MeetingAccessHub.css';

const MeetingAccessHub = ({ currentUser }) => {
  const navigate = useNavigate();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [quizAllowedIds, setQuizAllowedIds] = useState(() => new Set());

  const isMember = Boolean(currentUser && !currentUser.isAnonymous);

  useEffect(() => {
    if (!isMember) {
      setBooks([]);
      setLoading(false);
      return;
    }

    const fetchBooks = async () => {
      try {
        const { data } = await api.get('/books');
        setBooks(data);
      } catch (error) {
        console.error('Failed to fetch books for meeting hub, using fallback:', error);
        setBooks(getFallbackBooks());
      } finally {
        setLoading(false);
      }
    };

    fetchBooks();
  }, [isMember]);

  useEffect(() => {
    if (!isMember || loading) {
      setQuizAllowedIds(new Set());
      return;
    }

    const finishedBookIds = getFinishedBookIds();
    if (!finishedBookIds.length) {
      setQuizAllowedIds(new Set());
      return;
    }

    let cancelled = false;
    api.post('/access/check-batch', { bookIds: finishedBookIds })
      .then(({ data }) => {
        if (cancelled) return;
        const allowed = Array.isArray(data?.allowedBookIds) ? data.allowedBookIds : [];
        setQuizAllowedIds(new Set(allowed.map((id) => String(id))));
      })
      .catch((error) => {
        console.error('Failed to fetch quiz access list:', error);
        if (!cancelled) {
          setQuizAllowedIds(new Set());
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isMember, loading]);

  const eligibleBooks = useMemo(() => {
    if (!isMember) {
      return [];
    }

    const finishedSet = new Set(getFinishedBookIds().map((id) => String(id)));
    return books
      .filter((book) => {
        const bookId = String(book._id || book.id || '').trim();
        return Boolean(bookId && finishedSet.has(bookId) && quizAllowedIds.has(bookId));
      });
  }, [books, isMember, quizAllowedIds]);

  const handleEnterBook = async (book) => {
    const bookId = book._id || book.id;
    try {
      const { data } = await api.get(`/access/check?bookId=${encodeURIComponent(bookId)}&context=meet`);
      if (data?.access) {
        navigate(`/meet/${bookId}`);
        return;
      }

      navigate(`/quiz/${encodeURIComponent(bookId)}`, { state: { from: `/meet/${bookId}` } });
    } catch (error) {
      console.error('Failed to check access:', error);
      navigate(`/quiz/${encodeURIComponent(bookId)}`, { state: { from: `/meet/${bookId}` } });
    }
  };

  if (!isMember) {
    return (
      <div className="meeting-access-page is-gated animate-fade-in">
        <section className="meeting-access-gate" aria-label="Meet">
          <h1 className="font-serif">Private discussions for readers who reached the last page.</h1>
          <p>Sign in to access your completed books and join anonymous conversations.</p>

          <div className="meeting-access-gate-actions">
            <button type="button" className="btn-primary" onClick={() => navigate('/auth')}>
              Sign in to join conversations <ArrowRight size={16} />
            </button>
          </div>

          <div className="meeting-access-gate-footnote">
            <ShieldCheck size={16} />
            <span>Only finished books appear here.</span>
          </div>
        </section>

        <div className="meeting-access-gate-ornament" aria-hidden="true">
          <div className="gate-bubble" />
          <div className="gate-bubble is-mid" />
          <div className="gate-bubble is-small" />
        </div>
      </div>
    );
  }

  return (
    <div className="meeting-access-page animate-fade-in">
      <header className="meeting-access-hero" aria-label="Meet">
        <h1 className="font-serif">Talk with readers who finished what you finished.</h1>
        <p>Pick a completed book to enter a private, anonymous discussion room.</p>
      </header>

      {loading ? (
        <div className="meeting-access-loading glass-panel">Loading your meeting rooms...</div>
      ) : eligibleBooks.length > 0 ? (
        <section className="meeting-access-grid">
          {eligibleBooks.map((book, index) => (
            <article key={book._id || book.id} className="meeting-access-card glass-panel" style={{ '--card-order': index }}>
              <div className="meeting-access-mini-cover" style={{ '--book-accent': book.coverColor || '#6f614d' }}>
                <BookCoverArt
                  book={book}
                  imgClassName="meeting-access-mini-image"
                  fallbackClassName="meeting-access-mini-fallback"
                  showSpine
                  showPattern={false}
                  spineClassName="meeting-access-mini-spine"
                />
              </div>

              <div className="meeting-access-body">
                <span className="meeting-access-status">
                  <ShieldCheck size={16} />
                  Verified room
                </span>
                <h2 className="font-serif meeting-access-title">{book.title}</h2>
                <p className="meeting-access-author">{book.author}</p>
              </div>

              <button
                type="button"
                className="btn-primary sm meeting-access-button"
                onClick={() => handleEnterBook(book)}
              >
                Enter <ArrowRight size={16} />
              </button>
            </article>
          ))}
        </section>
      ) : (
        <section className="meeting-access-empty glass-panel">
          <h2 className="font-serif">No meeting rooms yet.</h2>
          <p>Finish a book and pass its quiz to unlock the Meet room.</p>
          <button type="button" className="btn-primary" onClick={() => navigate('/desk')}>
            Open The Desk
          </button>
        </section>
      )}
    </div>
  );
};

export default MeetingAccessHub;
