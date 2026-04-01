import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import BookCard from '../components/books/BookCard';
import api from '../utils/api';
import './BooksLibrary.css';

const getRecommendationsFromResponse = (payload) => {
  const recommendations = payload?.recommendations;
  if (!recommendations) return [];

  if (Array.isArray(recommendations)) return recommendations;

  if (typeof recommendations === 'object') {
    return Object.values(recommendations)
      .flatMap((shelf) => (Array.isArray(shelf) ? shelf : []));
  }

  return [];
};

const deskDataCache = {
  books: null,
  recommendations: null,
};

const getBookKey = (book) => String(book?._id || book?.gutenbergId || `${book?.title || 'book'}-${book?.author || 'unknown'}`);

const getLastAccessedBook = (allBooks) => {
  if (!Array.isArray(allBooks) || allBooks.length === 0) return null;

  return [...allBooks].sort((a, b) => {
    const aDate = new Date(a?.lastAccessed || a?.updatedAt || a?.createdAt || 0).getTime();
    const bDate = new Date(b?.lastAccessed || b?.updatedAt || b?.createdAt || 0).getTime();
    return bDate - aDate;
  })[0] || null;
};

const BooksLibrary = () => {
  const [books, setBooks] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const loadedRef = useRef(false);
  const cache = useRef(null);

  useEffect(() => {
    let mounted = true;

    const fetchDeskData = async () => {
      if (cache.current) return cache.current;

      const { data } = await api.get('/books');
      const allBooks = Array.isArray(data) ? data : [];
      const readBookIds = allBooks.map((book) => book?._id).filter(Boolean);

      let recBooks = [];
      if (readBookIds.length) {
        try {
          const { data: recData } = await api.post('/recommender', {
            readBookIds,
            currentBookId: readBookIds[0] || undefined,
            limitPerShelf: 6,
          });

          const deduped = [];
          const seen = new Set(readBookIds.map(String));
          getRecommendationsFromResponse(recData).forEach((book) => {
            const key = getBookKey(book);
            if (!seen.has(key)) {
              seen.add(key);
              deduped.push(book);
            }
          });
          recBooks = deduped.slice(0, 8);
        } catch (recommendationError) {
          if (recommendationError?.statusCode === 404) {
            console.warn('[DESK] Recommender endpoint unavailable (404). Continuing without recommendations.');
          } else {
            console.warn('[DESK] Recommender request failed. Continuing without recommendations.', recommendationError);
          }
        }
      }

      const payload = { books: allBooks, recommendations: recBooks };
      cache.current = payload;
      deskDataCache.books = allBooks;
      deskDataCache.recommendations = recBooks;
      return payload;
    };

    const loadDesk = async () => {
      try {
        if (deskDataCache.books && deskDataCache.recommendations) {
          setBooks(deskDataCache.books);
          setRecommendations(deskDataCache.recommendations);
          setLoading(false);
          return;
        }

        const payload = await fetchDeskData();
        if (!mounted) return;
        setBooks(payload.books);
        setRecommendations(payload.recommendations);
      } catch (error) {
        console.error('[DESK] Failed to load desk data:', error);
        if (!mounted) return;

        setBooks(Array.isArray(deskDataCache.books) ? deskDataCache.books : []);
        setRecommendations(Array.isArray(deskDataCache.recommendations) ? deskDataCache.recommendations : []);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    if (loadedRef.current) return undefined;
    loadedRef.current = true;
    loadDesk();

    return () => {
      mounted = false;
    };
  }, []);

  const continueBook = useMemo(() => getLastAccessedBook(books), [books]);
  const shelfBooks = useMemo(() => books.slice(0, 12), [books]);

  return (
    <div className="desk-page">
      <div className="content-container desk-shell">
        <header className="desk-header">
          <h1>Your Desk</h1>
          <p>Your active reading space, shelf, and recommendations.</p>
        </header>

        <section className="desk-section" aria-label="Continue reading">
          <div className="section-heading">
            <h2>Continue Reading</h2>
          </div>
          {loading ? (
            <div className="loading">Loading your desk…</div>
          ) : continueBook ? (
            <article className="continue-card">
              <div className="continue-cover">
                <BookCard book={continueBook} to={`/read/gutenberg/${continueBook.gutenbergId}`} compact />
              </div>
              <div className="continue-copy">
                <h3>{continueBook.title}</h3>
                <p>{continueBook.author || 'Unknown author'}</p>
                <span className="continue-progress">Progress: In progress</span>
              </div>
              <Link className="btn-resume" to={`/read/gutenberg/${continueBook.gutenbergId}`}>Resume</Link>
            </article>
          ) : (
            <div className="no-results">
              <BookOpen size={24} />
              <p>No recent books yet.</p>
            </div>
          )}
        </section>

        <section className="desk-section" aria-label="Your shelf">
          <div className="section-heading">
            <h2>Your Shelf</h2>
          </div>
          <div className="books-grid">
            {shelfBooks.map((book) => (
              <BookCard key={getBookKey(book)} book={book} to={`/read/gutenberg/${book.gutenbergId}`} />
            ))}
          </div>
        </section>

        <section className="desk-section" aria-label="Recommendations">
          <div className="section-heading">
            <h2>Recommendations</h2>
          </div>
          {recommendations.length === 0 ? (
            <div className="no-results"><p>No recommendations yet.</p></div>
          ) : (
            <div className="recommendations-row">
              {recommendations.map((book) => (
                <BookCard
                  key={getBookKey(book)}
                  book={book}
                  to={book.gutenbergId ? `/read/gutenberg/${book.gutenbergId}` : '/library'}
                  compact
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default BooksLibrary;
