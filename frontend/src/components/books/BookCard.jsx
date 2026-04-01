import React, { memo, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import BookCoverArt from './BookCoverArt';
import { getOpenLibraryCoverUrl } from '../../utils/openLibraryCovers';
import './BookCard.css';

const BookCard = ({
  book,
  to,
  className = '',
  compact = false,
  actionLabel,
  actionHref,
}) => {
  const coverUrl = useMemo(() => getOpenLibraryCoverUrl(book), [book]);
  const [loadedUrl, setLoadedUrl] = useState(null);
  const [failedUrls, setFailedUrls] = useState(() => new Set());

  const showFallback = !coverUrl || failedUrls.has(coverUrl);
  const imgLoaded = coverUrl && loadedUrl === coverUrl;

  return (
    <article className={`book-card ${compact ? 'book-card--compact' : ''} ${className}`.trim()}>
      <div className="card-inner">
        <Link className="book-card__cover-link" to={to} aria-label={`Open ${book?.title || 'book'}`}>
          <div className="book-card__cover-wrap">
            {!imgLoaded && !showFallback && <div className="book-cover-skeleton" aria-hidden="true" />}

            {!showFallback ? (
              <img
                src={coverUrl}
                alt={`${book?.title || 'Book'} cover`}
                className="book-card__cover-image"
                loading="lazy"
                decoding="async"
                onLoad={() => setLoadedUrl(coverUrl)}
                onError={() => setFailedUrls((previous) => new Set(previous).add(coverUrl))}
              />
            ) : (
              <BookCoverArt
                book={book}
                fallbackClassName="book-card__cover-fallback"
                showPattern
              />
            )}
          </div>
        </Link>

        <div className="book-card__info">
          <h3 className="book-card__title">{book?.title || 'Untitled'}</h3>
          <p className="book-card__author">{book?.author || 'Unknown author'}</p>
        </div>

        {actionLabel && actionHref && (
          <Link className="book-card__action" to={actionHref}>
            {actionLabel}
          </Link>
        )}
      </div>
    </article>
  );
};

export default memo(BookCard);
