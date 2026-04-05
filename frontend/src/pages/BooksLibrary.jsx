import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getReadingHistoryForCurrentUser, getReadingSessionsForCurrentUser } from '../utils/readingSession';
import { buildReadRoute } from '../utils/libraryApi';
import './BooksLibrary.css';

const BooksLibrary = ({ currentUser }) => {
  const [history, setHistory] = useState([]);
  const [sessions, setSessions] = useState({});

  useEffect(() => {
    const refresh = () => {
      setHistory(getReadingHistoryForCurrentUser());
      setSessions(getReadingSessionsForCurrentUser());
    };

    refresh();
    window.addEventListener('storage', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [currentUser?._id]);

  const continueReading = useMemo(() => history.find((entry) => {
    const session = sessions[entry.key];
    return session && Number(session.lastChapterIndex || 0) < Math.max(1, Number(session.chapterCount || 1));
  }) || null, [history, sessions]);

  return (
    <div className="desk-page editorial-theme">
      <div className="desk-shell">
        <section className="desk-hero" aria-label="Continue reading">
          <h2>Your Desk</h2>
          {continueReading ? (
            <article className="current-reading-card">
              <div className="current-reading-card__content">
                <div className="current-reading-card__meta">
                  <p className="current-reading-card__eyebrow">CONTINUE READING</p>
                  <h3>{continueReading.title}</h3>
                  <p>{continueReading.author}</p>
                </div>
                <div className="current-reading-card__footer">
                  <Link className="current-reading-card__resume" to={buildReadRoute(continueReading)}>Resume</Link>
                </div>
              </div>
            </article>
          ) : (
            <article className="current-reading-card current-reading-card--empty">
              <p>No active read yet. Open a book in Library to start.</p>
              <Link to="/library" className="desk-btn desk-btn--secondary">Browse books</Link>
            </article>
          )}
        </section>

        <section className="desk-section" aria-label="Recently opened">
          <div className="desk-section__heading">
            <h2>Recently opened</h2>
          </div>
          <div className="card-row card-row--recent" role="list">
            {history.map((entry) => (
              <Link key={entry.key} to={buildReadRoute(entry)} className="editorial-book-card">
                <div className="editorial-book-card__cover">
                  {entry.coverImage ? (
                    <img src={entry.coverImage} alt={`${entry.title} cover`} loading="lazy" decoding="async" />
                  ) : (
                    <div className="editorial-book-card__fallback" aria-hidden="true">{entry.title.slice(0, 1)}</div>
                  )}
                </div>
                <h3>{entry.title}</h3>
                <p>{entry.author}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default BooksLibrary;
