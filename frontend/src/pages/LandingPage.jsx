import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getBestCoverUrl } from '../utils/openLibraryCovers';
import api from '../utils/api';
import { getReadingSessionsForCurrentUser } from '../utils/readingSession';
import './LandingPage.css';

const libraryHighlights = [
  {
    key: 'focus',
    title: 'Focus on reading',
    description: 'A clean, low-noise interface designed for long reading sessions.',
  },
  {
    key: 'progress',
    title: 'Keep your rhythm',
    description: 'Track where you stopped and continue from the exact same place.',
  },
  {
    key: 'community',
    title: 'Discuss after the last page',
    description: 'Join thoughtful conversations once you complete a book.',
  },
];

const getProgressCandidate = (books, sessions) => {
  if (!Array.isArray(books) || !sessions || typeof sessions !== 'object') return null;

  return books
    .map((book) => {
      const keys = [String(book?._id || ''), String(book?.id || ''), String(book?.gutenbergId || '')].filter(Boolean);
      const session = keys.map((key) => sessions[key]).find(Boolean);
      if (!session) return null;

      const progress = Number(session?.progressPercent || 0);
      if (!Number.isFinite(progress) || progress <= 0 || progress >= 100 || session?.isFinished) return null;

      return {
        book,
        session,
        progress: Math.max(1, Math.min(99, Math.round(progress))),
      };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.session?.lastOpenedAt || 0).getTime() - new Date(a.session?.lastOpenedAt || 0).getTime())[0] || null;
};

export default function LandingPage({ currentUser }) {
  const [books, setBooks] = useState([]);
  const isMember = Boolean(currentUser && !currentUser.isAnonymous);

  useEffect(() => {
    let mounted = true;

    const loadBooks = async () => {
      try {
        const { data } = await api.get('/books');
        if (mounted) setBooks(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('[HOME] Failed to load books', error);
        if (mounted) setBooks([]);
      }
    };

    loadBooks();
    return () => {
      mounted = false;
    };
  }, []);

  const activeProgress = useMemo(() => {
    if (!isMember) return null;
    const sessions = getReadingSessionsForCurrentUser();
    return getProgressCandidate(books, sessions);
  }, [books, isMember]);

  const continueReadingRoute = useMemo(() => {
    const candidate = activeProgress?.book;
    if (!candidate) return '/desk';
    if (candidate?._id || candidate?.id) return `/read/${candidate._id || candidate.id}`;
    if (candidate?.gutenbergId) return `/read/gutenberg/${candidate.gutenbergId}`;
    return '/desk';
  }, [activeProgress]);

  const heroCover = useMemo(() => getBestCoverUrl(activeProgress?.book || books[0] || null), [activeProgress, books]);

  return (
    <div className="home-page animate-fade-in">
      <div className="layout-shell home-shell">
        <section className="layout-content home-hero" aria-label="Home">
          <div className="home-hero-copy">
            <p className="home-eyebrow">Book reading platform</p>
            <h1 className="home-title font-serif">Your calm space to read, resume, and reflect.</h1>
            <p className="home-subtitle">
              Read books with less distraction, track your progress automatically, and join meaningful post-reading conversations.
            </p>
            <div className="home-actions">
              <Link to={isMember ? '/desk' : '/auth'} className="home-btn home-btn-primary">{isMember ? 'Open your desk' : 'Start reading'}</Link>
              <Link to="/library" className="home-btn home-btn-secondary">Browse library</Link>
            </div>
          </div>

          <div className="home-hero-cover" aria-hidden="true">
            {heroCover ? <img src={heroCover} alt="" loading="eager" decoding="async" /> : <div className="home-cover-fallback font-serif">ATLP</div>}
          </div>
        </section>

        {isMember && activeProgress ? (
          <section className="layout-content home-resume" aria-label="Continue reading">
            <div>
              <p className="home-eyebrow">Continue reading</p>
              <h2 className="font-serif">{activeProgress.book?.title || 'Untitled book'}</h2>
              <p>{activeProgress.book?.author || 'Unknown author'}</p>
            </div>
            <div className="home-progress">
              <span>{activeProgress.progress}% complete</span>
              <div className="home-progress-track" role="progressbar" aria-valuenow={activeProgress.progress} aria-valuemin={0} aria-valuemax={100}>
                <div style={{ width: `${activeProgress.progress}%` }} />
              </div>
            </div>
            <Link to={continueReadingRoute} className="home-btn home-btn-secondary">Resume</Link>
          </section>
        ) : null}

        <section className="layout-content home-highlights" aria-label="Highlights">
          {libraryHighlights.map((item) => (
            <article key={item.key} className="home-highlight-card">
              <h3 className="font-serif">{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}
