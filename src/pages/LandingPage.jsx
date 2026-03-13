import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, MessageSquare, MoveRight, Users } from 'lucide-react';
import api from '../utils/api';
import { getFallbackBooks } from '../utils/bookFallback';
import { getLibraryState } from '../utils/readingSession';
import BookCoverArt from '../components/books/BookCoverArt';
import './LandingPage.css';

const getBookId = (book) => book._id || book.id;

const countReplies = (comments = []) => comments.reduce(
  (sum, comment) => sum + 1 + countReplies(comment.replies || []),
  0,
);

const renderCover = (book) => (
  <BookCoverArt
    book={book}
    imgClassName="home-cover-image compact"
    fallbackClassName="home-cover-fallback compact"
    showSpine
    showPattern={false}
    spineClassName="home-cover-spine"
    patternClassName="home-cover-pattern"
  />
);

const FeaturedBook = ({ book, isMember }) => (
  <Link to={isMember ? `/read/${getBookId(book)}` : "/auth"} className="home-featured-link" aria-label={`Open ${book.title}`}>
    <article className="home-featured-book">
      <div className="home-featured-cover" style={{ '--book-accent': book.coverColor || '#6f614d' }}>
        {renderCover(book)}
      </div>
      <div className="home-featured-copy">
        <h3 className="font-serif">{book.title}</h3>
        <p>{book.author}</p>
      </div>
    </article>
  </Link>
);

const DiscussionEntry = ({ thread }) => (
  <Link to={`/thread/${thread.bookId}#${thread._id}`} className="home-discussion-link">
    <article className="home-discussion">
      <div className="home-discussion-context">
        <span>{thread.bookTitle}</span>
        <span className="home-discussion-divider" aria-hidden="true">/</span>
        <span>{thread.replyCount} replies</span>
      </div>
      <h3 className="font-serif">{thread.title}</h3>
      <p>{thread.chapterReference?.trim() || 'Whole book'}</p>
    </article>
  </Link>
);

export default function LandingPage({ currentUser }) {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sampleThreads, setSampleThreads] = useState([]);
  const [threadError, setThreadError] = useState(false);

  const isMember = Boolean(currentUser && !currentUser.isAnonymous);
  const threadPreviewCount = isMember ? 2 : 6;

  useEffect(() => {
    const fetchBooks = async () => {
      try {
        const { data } = await api.get('/books');
        setBooks(data);
      } catch (error) {
        console.error('Failed to fetch books, using local fallback:', error);
        setBooks(getFallbackBooks());
      } finally {
        setLoading(false);
      }
    };

    fetchBooks();
  }, []);

  const featuredBooks = useMemo(() => books.slice(0, 8), [books]);

  const resumeBook = useMemo(() => {
    if (!isMember || books.length === 0) {
      return null;
    }

    const libraryState = getLibraryState(books);
    return libraryState.continueReading[0] || libraryState.recentlyOpened[0] || null;
  }, [books, isMember]);

  useEffect(() => {
    if (!books.length) {
      setSampleThreads([]);
      setThreadError(false);
      return;
    }

    const seedBooks = books.slice(0, 4);
    let isCancelled = false;

    const fetchThreads = async () => {
      try {
        const results = await Promise.allSettled(
          seedBooks.map((book) => api.get(`/threads/${getBookId(book)}?sort=hot`)),
        );

        if (isCancelled) {
          return;
        }

        const nextThreads = results.flatMap((result, index) => {
          if (result.status !== 'fulfilled') {
            return [];
          }

          const book = seedBooks[index];
          return (result.value.data || []).map((thread) => ({
            ...thread,
            bookId: getBookId(book),
            bookTitle: book.title,
            replyCount: countReplies(thread.comments || []),
          }));
        });

        nextThreads.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
        setSampleThreads(nextThreads.slice(0, threadPreviewCount));
        setThreadError(results.every((result) => result.status !== 'fulfilled'));
      } catch (error) {
        if (!isCancelled) {
          console.error('Failed to fetch sample discussions:', error);
          setSampleThreads([]);
          setThreadError(true);
        }
      }
    };

    fetchThreads();

    return () => {
      isCancelled = true;
    };
  }, [books, threadPreviewCount]);

  if (loading) {
    return (
      <div className="home-page animate-fade-in">
        <div className="home-shell">
          <p className="home-status">Preparing the reading desk...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="home-page animate-fade-in">
      <div className="home-shell">
        <header className="home-hero" aria-label="Home">
          <div className="home-hero-copy">
            <h1 className="home-title font-serif">
              <span className="home-title-line">Close the cover.</span>
              <span className="home-title-line">Open the conversation.</span>
            </h1>

            <p className="home-subtitle">
              Read books in a calm, distraction-free space, then meet other readers for text, voice, or video so ideas can
              keep unfolding beyond the final page.
            </p>

            <div className="home-hero-actions">
              <Link
                to={isMember ? (resumeBook ? `/read/${getBookId(resumeBook)}` : '/desk') : '/auth'}
                className="btn-primary"
              >
                Start Reading <MoveRight size={16} />
              </Link>
              <Link to="/threads" className="btn-secondary">Join the Conversation</Link>
            </div>

            {!isMember && (
              <p className="home-signin-hint">
                Want to keep your place and unlock reader-only rooms? <Link to="/auth">Sign in</Link>.
              </p>
            )}
          </div>

          <aside className="home-hero-visual" aria-hidden="true">
            <div className="home-visual-surface">
              <div className="home-visual-page">
                <div className="home-visual-kicker">Reading Room</div>
                <div className="home-visual-lines">
                  <span className="home-visual-line is-title">The Quiet Shelf</span>
                  <span className="home-visual-line is-body">Chapter 3: the river scene</span>
                  <span className="home-visual-line is-body">Saved note: “the light moves…”</span>
                  <span className="home-visual-line is-body">Next: Page 84</span>
                </div>
              </div>

              <div className="home-visual-thread">
                <div className="home-visual-kicker">Discussion</div>
                <div className="home-visual-lines">
                  <span className="home-visual-line is-title">After the last page</span>
                  <span className="home-visual-line is-body">What changed for you at the end?</span>
                  <span className="home-visual-line is-body">A few notes from the room</span>
                </div>
                <div className="home-visual-bubble">
                  <span className="home-visual-bubble-text">“The last sentence feels like a door.”</span>
                </div>
                <div className="home-visual-bubble is-me">
                  <span className="home-visual-bubble-text">“I reread the final chapter twice.”</span>
                </div>
                <div className="home-visual-bubble is-small">
                  <span className="home-visual-bubble-text">“Anyone else notice the refrain?”</span>
                </div>
              </div>
            </div>
          </aside>
        </header>

        {isMember && resumeBook && (
          <section className="home-resume" aria-label="Resume reading">
            <div className="home-resume-copy">
              <span className="home-resume-kicker">Resume</span>
              <h2 className="font-serif">Continue with {resumeBook.title}</h2>
              <p>Return to the page you last left open.</p>
            </div>
            <Link to={`/read/${getBookId(resumeBook)}`} className="btn-secondary sm">
              Continue <MoveRight size={16} />
            </Link>
          </section>
        )}

        <section className="home-intro" aria-label="What happens here">
          <div className="home-intro-head">
            <h2 className="font-serif">Reading should not end when the book ends.</h2>
            <p>The real conversation begins after the last page.</p>
          </div>

          <div className="home-intro-grid" role="list">
            <article className="home-intro-card" role="listitem">
              <div className="home-intro-icon"><BookOpen size={18} /></div>
              <h3 className="font-serif">Read</h3>
              <p>A quiet, single-column interface that keeps the book in front of you.</p>
            </article>
            <article className="home-intro-card" role="listitem">
              <div className="home-intro-icon"><Users size={18} /></div>
              <h3 className="font-serif">Meet</h3>
              <p>Find readers who just finished the same book, with text, voice, or video.</p>
            </article>
            <article className="home-intro-card" role="listitem">
              <div className="home-intro-icon"><MessageSquare size={18} /></div>
              <h3 className="font-serif">Discuss</h3>
              <p>Leave threads that feel like margin notes: thoughtful, slow, and spoiler-safe.</p>
            </article>
          </div>
        </section>

        <section className="home-section" aria-labelledby="featured-heading">
          <div className="home-section-head">
            <div className="home-section-copy">
              <h2 id="featured-heading" className="font-serif">A small shelf to begin</h2>
              <p>Open a book, then return when you reach the end.</p>
            </div>
            <Link to={isMember ? "/desk" : "/auth"} className="home-section-link">Open The Desk</Link>
          </div>

          <div className="home-featured" role="list" aria-label="Featured books">
            {featuredBooks.map((book) => (
              <FeaturedBook key={getBookId(book)} book={book} isMember={isMember} />
            ))}
          </div>
        </section>

        <section className="home-section home-discussion-preview" aria-labelledby="sample-discussions-heading">
          <div className="home-section-head">
            <div className="home-section-copy">
              <h2 id="sample-discussions-heading" className="font-serif">From the discussion rooms</h2>
              <p>Ideas readers are carrying forward right now.</p>
            </div>
            <Link to="/threads" className="home-section-link">Browse threads</Link>
          </div>

          {sampleThreads.length > 0 ? (
            <div className="home-discussions" role="list" aria-label="Sample discussions">
              {sampleThreads.map((thread) => (
                <DiscussionEntry key={thread._id} thread={thread} />
              ))}
            </div>
          ) : (
            <div className="home-empty">
              <MessageSquare size={18} />
              <p>
                {threadError
                  ? 'Discussion rooms are unavailable right now.'
                  : 'Open a book and return after you finish to see active discussions.'}
              </p>
            </div>
          )}
        </section>

        {!isMember && (
          <section className="home-callout" aria-label="Sign in">
            <div className="home-callout-copy">
              <h2 className="font-serif">Keep your place.</h2>
              <p>Sign in to save progress and unlock reader-only conversation rooms after you finish.</p>
            </div>
            <Link to="/auth" className="btn-primary sm">Sign in</Link>
          </section>
        )}
      </div>
    </div>
  );
}
