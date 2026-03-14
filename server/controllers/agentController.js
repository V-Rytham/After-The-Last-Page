const getBookFriendBaseUrl = () => (process.env.BOOKFRIEND_SERVER_URL || 'http://127.0.0.1:5050').replace(/\/$/, '');

const forwardToBookFriend = async (path, payload) => {
  const response = await fetch(`${getBookFriendBaseUrl()}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data?.message || 'BookFriend agent request failed.';
    const error = new Error(message);
    error.statusCode = response.status;
    error.payload = data;
    throw error;
  }

  return data;
};

export const startAgentSession = async (req, res) => {
  try {
    const { book_id: explicitBookId, chapter_progress: chapterProgress } = req.body || {};
    const userId = req.user?._id?.toString() || req.user?.anonymousId;
    const bookId = explicitBookId;

    if (!userId || !bookId) {
      return res.status(400).json({ message: 'book_id is required.' });
    }

    const data = await forwardToBookFriend('/agent/start', {
      user_id: userId,
      book_id: bookId,
      chapter_progress: chapterProgress,
    });

    res.status(201).json(data);
  } catch (error) {
    const status = error.statusCode || 502;
    res.status(status).json({
      message: error.message || 'Unable to start BookFriend session.',
      details: error.payload,
    });
  }
};

export const sendAgentMessage = async (req, res) => {
  try {
    const data = await forwardToBookFriend('/agent/message', req.body || {});
    res.json(data);
  } catch (error) {
    const status = error.statusCode || 502;
    res.status(status).json({
      message: error.message || 'Unable to fetch BookFriend response.',
      details: error.payload,
    });
  }
};

export const endAgentSession = async (req, res) => {
  try {
    const data = await forwardToBookFriend('/agent/end', req.body || {});
    res.json(data);
  } catch (error) {
    const status = error.statusCode || 502;
    res.status(status).json({
      message: error.message || 'Unable to end BookFriend session.',
      details: error.payload,
    });
  }
};
