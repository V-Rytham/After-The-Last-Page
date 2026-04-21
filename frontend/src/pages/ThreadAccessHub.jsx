import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, LockKeyhole, Search } from 'lucide-react';
import useGlobalSearch from '../hooks/useGlobalSearch';
import './ThreadAccessHub.css';

const normalizeBooks = (books) => (Array.isArray(books) ? books : []).map((book) => {
  const source = String(book?.source || '').trim().toLowerCase();
  const sourceId = String(book?.sourceId || '').trim();
  if (!source || !sourceId) return null;

  return {
    ...book,
    source,
    sourceId,
    compositeId: `${source}:${sourceId}`,
  };
}).filter(Boolean);

const getArchiveBadge = (book) => {
  const isArchive = book.source === 'archive' || book.source === 'internetarchive';
  if (!isArchive) return '';
  return book?.isPublicDomain ? 'Open Access' : 'External';
};

export default function ThreadAccessHub({ currentUser }) {
  const navigate = useNavigate();
  const isMember = Boolean(currentUser && !currentUser.isAnonymous);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBook, setSelectedBook] = useState(null);
  const { books, loading, error, query } = useGlobalSearch(searchTerm);

  const hasQuery = Boolean(query);
  const results = useMemo(() => normalizeBooks(books), [books]);

  if (!isMember) {
    return (
      <div className="thread-access-page animate-fade-in">
        <section className="thread-access-grid">
          <div className="thread-access-loading glass-panel">
            <LockKeyhole size={18} />
            <p>Sign in to join book threads.</p>
            <button className="btn-primary sm thread-access-button" onClick={() => navigate('/auth')}>
              Sign in
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="thread-access-page animate-fade-in">
      <section className="thread-access-hero">
        <div className="thread-access-copy">
          <h1 className="font-serif">Discuss books with other readers</h1>
          <p>Search for a book, select it, and open the thread room.</p>
        </div>
      </section>

      <label className="thread-access-search" htmlFor="thread-search-input">
        <Search size={16} aria-hidden="true" />
        <input
          id="thread-search-input"
          type="search"
          value={searchTerm}
          placeholder="Type a book title or author"
          onChange={(event) => setSearchTerm(event.target.value)}
          aria-label="Search thread books"
        />
      </label>

      {hasQuery && loading ? (
        <p className="thread-access-inline-status" role="status" aria-live="polite">Searching...</p>
      ) : null}

      {hasQuery && !loading && error ? (
        <div className="thread-access-loading glass-panel">
          <p>{error}</p>
        </div>
      ) : null}

      {hasQuery && !loading && !error && results.length === 0 ? (
        <div className="thread-access-loading glass-panel">
          <h2 className="font-serif">No books found</h2>
          <p>Try a different title</p>
        </div>
      ) : null}

      <section className="thread-access-grid" aria-label="Thread search results">
        {!loading && !error && results.map((book) => (
          <article
            key={book.compositeId}
            className={`thread-access-card glass-panel${selectedBook?.compositeId === book.compositeId ? ' is-selected' : ''}`}
          >
            <div className="thread-access-card-body">
              <h3 className="thread-access-title font-serif">{book.title}</h3>
              <p className="thread-access-author">{book.author}</p>
              {getArchiveBadge(book) ? <p className="thread-access-author">{getArchiveBadge(book)}</p> : null}
            </div>
            <div className="thread-access-actions">
              <button
                className="btn-primary sm thread-access-button"
                onClick={() => {
                  setSelectedBook(book);
                  navigate(`/thread/${book.compositeId}`, { state: { book } });
                }}
              >
                Open thread <ArrowRight size={14} />
              </button>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
