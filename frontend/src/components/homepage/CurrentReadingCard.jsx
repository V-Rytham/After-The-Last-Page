import React from 'react';
import { Link } from 'react-router-dom';
import { Clock3 } from 'lucide-react';
import { getBestCoverUrl } from '../../utils/openLibraryCovers';

const toReadRoute = (book) => {
  if (!book) return '/desk';
  if (book?._id || book?.id) return `/read/${book._id || book.id}`;
  if (book?.gutenbergId) return `/read/gutenberg/${book.gutenbergId}`;
  return '/desk';
};

const CurrentReadingCard = ({ book, progress, timeLeft }) => {
  if (!book) {
    return (
      <article className="home2-card home2-current-card home2-current-card-empty">
        <div>
          <p className="home2-kicker">Currently Reading</p>
          <h2 className="font-serif">No active book yet</h2>
          <p className="home2-muted">Pick a book from your desk to begin tracking progress.</p>
        </div>
        <Link to="/desk" className="home2-btn home2-btn-secondary">Go to Your Desk</Link>
      </article>
    );
  }

  const safeProgress = Math.max(0, Math.min(100, Number(progress || 0)));
  const cover = getBestCoverUrl(book);

  return (
    <article className="home2-card home2-current-card">
      <p className="home2-kicker">Currently Reading</p>
      <div className="home2-current-main">
        <div className="home2-current-cover" aria-hidden="true">
          {cover ? <img src={cover} alt="" loading="lazy" decoding="async" /> : <span>{String(book?.title || 'B').charAt(0)}</span>}
        </div>
        <div className="home2-current-copy">
          <h2 className="font-serif">{book?.title || 'Untitled Book'}</h2>
          <p className="home2-muted">{book?.author || 'Unknown author'}</p>

          <div className="home2-progress-row">
            <div className="home2-progress-track" role="progressbar" aria-valuenow={Math.round(safeProgress)} aria-valuemin="0" aria-valuemax="100" aria-label="Reading progress">
              <span style={{ width: `${safeProgress}%` }} />
            </div>
            <strong>{Math.round(safeProgress)}%</strong>
          </div>

          <p className="home2-timeleft"><Clock3 size={14} /> {timeLeft || 'Time left unavailable'}</p>
          <Link to={toReadRoute(book)} className="home2-btn home2-btn-primary home2-btn-inline">Resume Reading</Link>
        </div>
      </div>
    </article>
  );
};

export default CurrentReadingCard;
