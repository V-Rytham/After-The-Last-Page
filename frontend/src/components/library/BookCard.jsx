import React, { memo, useState } from 'react';
import { Link } from 'react-router-dom';
import { buildReadRoute, PLACEHOLDER_COVER } from '../../utils/libraryApi';

const BookCard = ({ book, loading = false }) => {
  const [imageError, setImageError] = useState(false);

  if (loading) {
    return (
      <article className="library-book-card" aria-hidden="true">
        <div className="library-book-cover skeleton" />
        <div className="library-book-title skeleton" />
        <div className="library-book-author skeleton" />
        <div className="library-book-cta skeleton" />
      </article>
    );
  }

  const title = String(book?.title || 'Untitled');
  const author = String(book?.author || 'Unknown author');
  const route = buildReadRoute(book);
  const coverSrc = imageError ? PLACEHOLDER_COVER : (book?.coverImage || PLACEHOLDER_COVER);

  return (
    <article className="library-book-card">
      <Link className="library-cover-link" to={route} aria-label={`Read ${title}`}>
        <div className="library-book-cover">
          <img src={coverSrc} alt={`${title} cover`} loading="lazy" decoding="async" onError={() => setImageError(true)} />
        </div>
      </Link>
      <h3 className="library-book-title" title={title}>{title}</h3>
      <p className="library-book-author">{author}</p>
      <Link className="library-book-cta" to={route}>Read</Link>
    </article>
  );
};

export default memo(BookCard);
