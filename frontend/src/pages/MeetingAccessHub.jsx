import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import useGlobalSearch from '../hooks/useGlobalSearch';
import { useSocketConnection } from '../context/SocketContext';
import MeetingSearchBar from '../components/meeting/MeetingSearchBar';
import api from '../utils/api';
import './MeetingAccessHub.css';

const RECENT_SEARCHES_STORAGE_KEY = 'meetRecentSearches';
const MAX_RECENT_SEARCHES = 6;

const normalizeBook = (book) => {
  const source = String(book?.source || '').trim().toLowerCase();
  const sourceBookId = String(book?.sourceId || '').trim();
  if (!source || !sourceBookId) return null;

  return {
    title: String(book?.title || 'Untitled').trim() || 'Untitled',
    author: String(book?.author || 'Unknown author').trim() || 'Unknown author',
    source,
    source_book_id: sourceBookId,
  };
};

const loadRecentSearches = () => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENT_SEARCHES_STORAGE_KEY);
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string' && item.trim()) : [];
  } catch {
    return [];
  }
};

export default function MeetingAccessHub({ currentUser }) {
  const navigate = useNavigate();
  const isMember = Boolean(currentUser && !currentUser.isAnonymous);
  const { socketConnected, socketConnecting, socketError, ensureConnected } = useSocketConnection();

  const [searchTerm, setSearchTerm] = useState('');
  const [joiningKey, setJoiningKey] = useState('');
  const [joinNotice, setJoinNotice] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState(loadRecentSearches);
  const { books, loading, error, query } = useGlobalSearch(searchTerm);

  const hasQuery = Boolean(query);
  const visibleBooks = useMemo(
    () => (Array.isArray(books) ? books : []).map(normalizeBook).filter(Boolean),
    [books],
  );

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [query, visibleBooks.length]);

  const saveRecentSearch = (value) => {
    const normalized = String(value || '').trim();
    if (!normalized) return;

    setRecentSearches((prev) => {
      const next = [normalized, ...prev.filter((item) => item.toLowerCase() !== normalized.toLowerCase())]
        .slice(0, MAX_RECENT_SEARCHES);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(next));
      }
      return next;
    });
  };

  const handleJoinDiscussion = async (book) => {
    const key = `${book.source}:${book.source_book_id}`;
    if (joiningKey) return;

    if (!socketConnected) {
      setJoinNotice(socketConnecting ? 'Connecting...' : 'Connecting to chat...');
      return;
    }

    setJoiningKey(key);
    setJoinNotice('');

    const attemptJoin = async () => api.post('/meet/join', {
      source: book.source,
      source_book_id: book.source_book_id,
      prefType: 'text',
    });

    try {
      saveRecentSearch(query || searchTerm);
      const { data } = await attemptJoin();
      const roomId = String(data?.room_id || data?.canonical_book_id || '').trim();
      if (!roomId) throw new Error('Could not start chat.');

      navigate(`/meet/${encodeURIComponent(roomId)}`, {
        state: {
          meetRoom: {
            room_id: roomId,
            canonical_book_id: roomId,
            source: book.source,
            source_book_id: book.source_book_id,
            title: String(data?.book?.title || book.title || 'Untitled'),
            author: String(data?.book?.author || book.author || 'Unknown author'),
          },
        },
      });
    } catch (joinError) {
      const statusCode = Number(joinError?.response?.status || 0);
      const serverMessage = String(joinError?.response?.data?.message || joinError?.response?.data?.error || '').trim();
      const socketMismatch = statusCode === 409
        && (/no active socket connection/i.test(serverMessage) || serverMessage === 'SOCKET_NOT_CONNECTED');

      if (socketMismatch) {
        setJoinNotice('Reconnecting...');
        try {
          await ensureConnected({ forceReconnect: true });
          const { data } = await attemptJoin();
          const roomId = String(data?.room_id || data?.canonical_book_id || '').trim();
          if (roomId) {
            navigate(`/meet/${encodeURIComponent(roomId)}`, {
              state: {
                meetRoom: {
                  room_id: roomId,
                  canonical_book_id: roomId,
                  source: book.source,
                  source_book_id: book.source_book_id,
                  title: String(data?.book?.title || book.title || 'Untitled'),
                  author: String(data?.book?.author || book.author || 'Unknown author'),
                },
              },
            });
            return;
          }
        } catch {
          // fall through
        }
      }

      setJoinNotice('Could not start this chat right now. Please try again in a moment.');
    } finally {
      setJoiningKey('');
    }
  };

  const handleSearchKeyDown = (event) => {
    if (!hasQuery || visibleBooks.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % visibleBooks.length);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex((prev) => (prev <= 0 ? visibleBooks.length - 1 : prev - 1));
      return;
    }

    if (event.key === 'Enter' && highlightedIndex >= 0 && visibleBooks[highlightedIndex]) {
      event.preventDefault();
      handleJoinDiscussion(visibleBooks[highlightedIndex]);
    }
  };

  if (!isMember) {
    return (
      <div className="meeting-access-page is-gated animate-fade-in">
        <section className="meeting-access-gate" aria-label="Meet">
          <h1 className="font-serif">Start a private chat beyond the final page.</h1>
          <p>Sign in to chat one-on-one with another reader around a real verified book.</p>

          <div className="meeting-access-gate-actions">
            <button type="button" className="btn-primary" onClick={() => navigate('/auth')}>
              Sign in to start chatting <ArrowRight size={16} />
            </button>
          </div>

          <div className="meeting-access-gate-footnote">
            <ShieldCheck size={16} />
            <span>Anonymous by default. No identity shared from our end.</span>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="meeting-access-page animate-fade-in">
      <section className="meeting-access-container" onKeyDown={handleSearchKeyDown}>
        <h1 className="font-serif">Find a book. Start a chat.</h1>
        <p>Search for a book, select it, then begin your private conversation.</p>

        <MeetingSearchBar
          id="meeting-search-input"
          value={searchTerm}
          placeholder="Search by title or author"
          onChange={(event) => setSearchTerm(event.target.value)}
          autoFocus
        />

        {hasQuery && loading ? (
          <div className="meeting-access-loading" aria-live="polite">
            <span className="meeting-access-loading-spinner" aria-hidden="true" />
            <p>Searching...</p>
          </div>
        ) : null}

        {!socketConnected ? <p className="meeting-access-live-state">{socketConnecting ? 'Connecting...' : 'Connecting...'}</p> : null}
        {!socketConnected && socketError ? <p className="meeting-access-live-error">{socketError}</p> : null}
        {joinNotice ? <p className="meeting-access-live-error">{joinNotice}</p> : null}

        <section className="meeting-access-interaction-layer" aria-label="Search interaction layer">
          {error && hasQuery ? (
            <section className="meeting-access-empty glass-panel">
              <h2 className="font-serif">Unable to load books right now.</h2>
              <p>{error}</p>
            </section>
          ) : null}

          {!loading && visibleBooks.length > 0 ? (
            <section className="meeting-access-results" aria-label="Meet books">
              {visibleBooks.map((book, index) => {
                const key = `${book.source}:${book.source_book_id}`;
                const isJoining = joiningKey === key;
                const isHighlighted = highlightedIndex === index;
                return (
                  <article key={key} className={`meeting-book-card glass-panel ${isHighlighted ? 'is-highlighted' : ''}`}>
                    <div className="meeting-book-main">
                      <h3 className="meeting-book-title" title={book.title}>{book.title}</h3>
                      <p className="meeting-book-author" title={book.author}>{book.author}</p>
                    </div>
                    <button
                      type="button"
                      className="meeting-book-cta"
                      disabled={Boolean(joiningKey) || !socketConnected}
                      onClick={() => handleJoinDiscussion(book)}
                    >
                      {isJoining ? <span className="meeting-cta-spinner" aria-hidden="true" /> : null}
                      {isJoining ? 'Starting...' : (socketConnected ? 'Start Chat' : 'Connecting...')}
                    </button>
                  </article>
                );
              })}
            </section>
          ) : null}

          {!loading && !error && hasQuery && visibleBooks.length === 0 ? (
            <section className="meeting-access-empty glass-panel">
              <h2 className="font-serif">No books found</h2>
              <p>Try a different title.</p>
            </section>
          ) : null}

          {!hasQuery && recentSearches.length > 0 ? (
            <section className="meeting-access-recent" aria-label="Recent searches">
              <h2 className="font-serif">Recent searches</h2>
              <div className="meeting-access-recent-list">
                {recentSearches.map((item) => (
                  <button key={item} type="button" className="meeting-access-recent-chip" onClick={() => setSearchTerm(item)}>
                    {item}
                  </button>
                ))}
              </div>
            </section>
          ) : null}
        </section>
      </section>
    </div>
  );
}
