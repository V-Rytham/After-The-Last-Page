import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Search, ShieldCheck } from 'lucide-react';
import useGlobalSearch from '../hooks/useGlobalSearch';
import { useSocketConnection } from '../context/SocketContext';
import api from '../utils/api';
import './MeetingAccessHub.css';

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

export default function MeetingAccessHub({ currentUser }) {
  const navigate = useNavigate();
  const isMember = Boolean(currentUser && !currentUser.isAnonymous);
  const { socketConnected, socketConnecting, socketError, ensureConnected } = useSocketConnection();

  const [searchTerm, setSearchTerm] = useState('');
  const [joiningKey, setJoiningKey] = useState('');
  const [joinNotice, setJoinNotice] = useState('');
  const { books, loading, error, query } = useGlobalSearch(searchTerm);

  const hasQuery = Boolean(query);
  const visibleBooks = useMemo(
    () => (Array.isArray(books) ? books : []).map(normalizeBook).filter(Boolean),
    [books],
  );

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
      <section className="meeting-access-hero">
        <div className="meeting-access-hero-copy">
          <h1 className="font-serif">Find a book. Start a chat.</h1>
          <p>Search for a book, select it, then begin your private conversation.</p>
          {!socketConnected ? <p className="meeting-access-live-state">{socketConnecting ? 'Connecting...' : 'Connecting...'}</p> : null}
          {!socketConnected && socketError ? <p className="meeting-access-live-error">{socketError}</p> : null}
          {joinNotice ? <p className="meeting-access-live-error">{joinNotice}</p> : null}
        </div>
      </section>

      <label className="meeting-access-search" htmlFor="meeting-search-input">
        <Search size={16} aria-hidden="true" />
        <input
          id="meeting-search-input"
          type="search"
          value={searchTerm}
          placeholder="Search by title or author"
          onChange={(event) => setSearchTerm(event.target.value)}
          aria-label="Search books to meet"
        />
      </label>

      {hasQuery && loading ? <p className="meeting-access-inline-status">Searching...</p> : null}

      {error && hasQuery ? (
        <section className="meeting-access-empty glass-panel">
          <h2 className="font-serif">Unable to load books right now.</h2>
          <p>{error}</p>
        </section>
      ) : null}

      {!loading && visibleBooks.length > 0 ? (
        <section className="meeting-access-results" aria-label="Meet books">
          {visibleBooks.map((book) => {
            const key = `${book.source}:${book.source_book_id}`;
            const isJoining = joiningKey === key;
            return (
              <article key={key} className="meeting-book-card glass-panel">
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
          <p>Try a different title</p>
        </section>
      ) : null}
    </div>
  );
}
