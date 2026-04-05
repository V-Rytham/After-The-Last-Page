import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { readBook } from '../utils/libraryApi';
import { trackBookOpened, updateReadingSession } from '../utils/readingSession';
import './ReadingRoom.css';

const FALLBACK_CHAPTER = {
  index: 1,
  title: 'Unavailable',
  html: '<p>This book is currently unavailable.</p>',
};

const ReadingRoom = () => {
  const { source, sourceId } = useParams();

  const [book, setBook] = useState({ title: 'Loading...', author: '', source, sourceId });
  const [chapters, setChapters] = useState([FALLBACK_CHAPTER]);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setCurrentChapterIndex(0);

      try {
        const payload = await readBook({ source, sourceId });
        const safeChapters = Array.isArray(payload?.chapters) && payload.chapters.length > 0
          ? payload.chapters
          : [FALLBACK_CHAPTER];

        setBook({
          title: String(payload?.title || 'Unavailable'),
          author: String(payload?.author || 'Unknown author'),
          source,
          sourceId,
        });
        setChapters(safeChapters);
        setCurrentChapterIndex(0);

        trackBookOpened({
          source,
          sourceId,
          title: payload?.title,
          author: payload?.author,
        });
      } catch {
        setBook({ title: 'Unavailable', author: 'Unknown author', source, sourceId });
        setChapters([FALLBACK_CHAPTER]);
        setCurrentChapterIndex(0);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [source, sourceId]);

  useEffect(() => {
    if (currentChapterIndex >= chapters.length) {
      setCurrentChapterIndex(0);
    }
  }, [currentChapterIndex, chapters.length]);

  useEffect(() => {
    updateReadingSession({
      source,
      sourceId,
      currentChapterIndex,
      chapterCount: chapters.length,
    });
  }, [source, sourceId, currentChapterIndex, chapters.length]);

  const safeIndex = useMemo(() => (
    currentChapterIndex >= 0 && currentChapterIndex < chapters.length ? currentChapterIndex : 0
  ), [currentChapterIndex, chapters.length]);
  const activeChapter = chapters[safeIndex] || FALLBACK_CHAPTER;

  return (
    <div className="reading-room-page">
      <header className="reading-room-header">
        <Link to="/library">← Back to library</Link>
        <h1>{book.title}</h1>
        <p>{book.author}</p>
      </header>

      <main className="reader-shell" aria-busy={loading}>
        <h2>{activeChapter.title || `Chapter ${safeIndex + 1}`}</h2>
        <article dangerouslySetInnerHTML={{ __html: activeChapter.html || FALLBACK_CHAPTER.html }} />
      </main>

      <footer className="reading-room-footer">
        <button type="button" disabled={safeIndex <= 0} onClick={() => setCurrentChapterIndex((value) => Math.max(0, value - 1))}>Previous</button>
        <span>Chapter {safeIndex + 1} of {Math.max(1, chapters.length)}</span>
        <button
          type="button"
          disabled={safeIndex >= chapters.length - 1}
          onClick={() => setCurrentChapterIndex((value) => Math.min(chapters.length - 1, value + 1))}
        >
          Next
        </button>
      </footer>
    </div>
  );
};

export default ReadingRoom;
