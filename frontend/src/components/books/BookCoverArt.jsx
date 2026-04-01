import React, { useEffect, useMemo, useState } from 'react';
import { fetchGoogleBooksThumbnail, getOpenLibraryCoverCandidates } from '../../utils/openLibraryCovers';

const BookCoverArt = ({
  book,
  alt,
  imgClassName = 'book-cover-image',
  fallbackClassName = 'book-cover-fallback',
  showSpine = true,
  showPattern = false,
  spineClassName = 'book-cover-spine',
  patternClassName = 'book-cover-pattern',
}) => {
  const candidates = useMemo(() => getOpenLibraryCoverCandidates(book), [book]);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [googleThumbnail, setGoogleThumbnail] = useState(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  useEffect(() => {
    let active = true;

    const maybeLoadGoogleThumbnail = async () => {
      if (googleThumbnail || candidateIndex < candidates.length) return;
      const thumbnail = await fetchGoogleBooksThumbnail(book);
      if (!active || !thumbnail) return;
      setGoogleThumbnail(thumbnail);
    };

    maybeLoadGoogleThumbnail();

    return () => {
      active = false;
    };
  }, [book, candidateIndex, candidates.length, googleThumbnail]);

  const activeSrc = candidates[candidateIndex] || googleThumbnail || null;

  if (!activeSrc) {
    return (
      <div className={fallbackClassName}>
        {showSpine && <div className={spineClassName} />}
        {showPattern && <div className={patternClassName} />}
      </div>
    );
  }

  return (
    <>
      {!imgLoaded && <div className="book-cover-skeleton" aria-hidden="true" />}
      <img
        key={activeSrc}
        src={activeSrc}
        alt={alt || `${book?.title || 'Book'} cover`}
        className={imgClassName}
        loading="lazy"
        decoding="async"
        onLoad={() => setImgLoaded(true)}
        onError={() => {
          setImgLoaded(false);
          if (candidateIndex < candidates.length - 1) {
            setCandidateIndex((index) => index + 1);
            return;
          }
          setCandidateIndex(candidates.length);
        }}
      />
    </>
  );
};

export default BookCoverArt;
