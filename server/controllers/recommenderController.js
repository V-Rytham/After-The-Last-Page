import { recommendFromDatabase } from '../recommenderSystem/recommenderSystem.js';

const asStringArray = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => (entry == null ? '' : String(entry)))
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const deriveMostRecentReadBookId = (user) => {
  if (!user?.booksRead?.length) {
    return '';
  }

  const sorted = [...user.booksRead]
    .filter((entry) => entry?.bookId)
    .sort((a, b) => new Date(b.completedAt || 0) - new Date(a.completedAt || 0));

  return sorted[0]?.bookId ? String(sorted[0].bookId) : '';
};

export const getRecommendations = async (req, res) => {
  try {
    const currentBookId = req.body?.currentBookId
      ? String(req.body.currentBookId)
      : deriveMostRecentReadBookId(req.user);

    const readBookIds = req.body?.readBookIds?.length
      ? asStringArray(req.body.readBookIds)
      : asStringArray((req.user?.booksRead || []).map((entry) => entry.bookId));

    const limitPerShelf = Number.isFinite(Number(req.body?.limitPerShelf))
      ? Math.max(1, Math.min(20, Number(req.body.limitPerShelf)))
      : 10;

    const recommendations = await recommendFromDatabase({
      currentBookId,
      readBookIds,
      limitPerShelf,
    });

    res.json({
      currentBookId: currentBookId || null,
      recommendations,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error generating recommendations', error: error.message });
  }
};

