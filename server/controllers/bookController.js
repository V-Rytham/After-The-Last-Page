import { Book } from '../models/Book.js';
import { convertTextToChapters, fetchGutenbergText, getGutenbergBookPageUrl, getGutenbergCoverUrl, stripGutenbergBoilerplate } from '../utils/gutenberg.js';

export const getBooks = async (req, res) => {
  try {
    const books = await Book.find({}).select('-textContent -chapters');
    res.json(books);
  } catch {
    res.status(500).json({ message: 'Server error fetching books' });
  }
};

export const getBookById = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id).select('-textContent -chapters');
    if (book) {
      res.json(book);
    } else {
      res.status(404).json({ message: 'Book not found' });
    }
  } catch {
    res.status(500).json({ message: 'Server error fetching book' });
  }
};

export const getBookContent = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id).select('chapters sourceProvider sourceUrl rights gutenbergId title author coverImage');
    if (!book) {
      res.status(404).json({ message: 'Book not found' });
      return;
    }

    const chapters = Array.isArray(book.chapters) ? book.chapters : [];
    const hasChapters = chapters.length > 0;

    const buildLocalFallbackChapters = () => {
      const synopsis = (book.synopsis || 'Content for this book is not available in this environment yet.').toString();
      const safeSynopsis = synopsis.replace(/[<>]/g, ' ');
      const wordCount = safeSynopsis.trim().split(/\s+/).filter(Boolean).length;

      return [{
        index: 1,
        title: book.title || 'Chapter 1',
        html: `<p>${safeSynopsis}</p>`,
        wordCount,
      }];
    };

    if (!hasChapters && book.gutenbergId) {
      try {
        const rawText = await fetchGutenbergText(book.gutenbergId);
        const mainText = stripGutenbergBoilerplate(rawText);
        const nextChapters = convertTextToChapters(mainText, { fallbackTitle: 'Chapter' });

        book.chapters = nextChapters;
        book.sourceUrl = getGutenbergBookPageUrl(book.gutenbergId);
        book.coverImage = book.coverImage || getGutenbergCoverUrl(book.gutenbergId, 'medium');
        book.rights = book.rights || 'Public domain (Project Gutenberg)';
        book.sourceProvider = book.sourceProvider || 'Project Gutenberg';
        await book.save();

        res.json({
          chapters: nextChapters,
          sourceProvider: book.sourceProvider,
          sourceUrl: book.sourceUrl,
          rights: book.rights,
          gutenbergId: book.gutenbergId,
        });
        return;
      } catch (error) {
        console.error(`[BOOK] Failed to lazily ingest Gutenberg book ${book.title} (${book.gutenbergId}):`, error?.message || error);
        const fallbackChapters = buildLocalFallbackChapters();
        res.json({
          chapters: fallbackChapters,
          sourceProvider: book.sourceProvider || 'Project Gutenberg',
          sourceUrl: book.sourceUrl || getGutenbergBookPageUrl(book.gutenbergId),
          rights: book.rights || 'Public domain (Project Gutenberg)',
          gutenbergId: book.gutenbergId,
        });
        return;
      }
    }

    if (!hasChapters) {
      const fallbackChapters = buildLocalFallbackChapters();
      res.json({
        chapters: fallbackChapters,
        sourceProvider: book.sourceProvider || 'Project Gutenberg',
        sourceUrl: book.sourceUrl || (book.gutenbergId ? getGutenbergBookPageUrl(book.gutenbergId) : undefined),
        rights: book.rights || 'Public domain (Project Gutenberg)',
        gutenbergId: book.gutenbergId,
      });
      return;
    }

    res.json({
      chapters,
      sourceProvider: book.sourceProvider,
      sourceUrl: book.sourceUrl,
      rights: book.rights,
      gutenbergId: book.gutenbergId,
    });
  } catch {
    res.status(500).json({ message: 'Server error fetching book content' });
  }
};
