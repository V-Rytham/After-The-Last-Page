const getQuestionEngineUrl = () => {
  const baseUrl = String(process.env.QUESTION_ENGINE_URL || '').trim();
  if (!baseUrl) {
    throw new Error('QUESTION_ENGINE_URL is not configured');
  }

  return baseUrl.replace(/\/+$/, '');
};

export const fetchQuestionsByIsbn = async (isbn) => {
  const normalizedIsbn = String(isbn || '').trim();
  if (!normalizedIsbn) {
    throw new Error('ISBN is required to fetch questions.');
  }

  const url = `${getQuestionEngineUrl()}/questions/${encodeURIComponent(normalizedIsbn)}`;
  const response = await fetch(url, { method: 'GET' });

  const payload = await response.json().catch(() => ({}));

  if (payload?.status === 'processing') {
    return { status: 'processing' };
  }

  if (!response.ok) {
    const message = payload?.message || 'Failed to fetch questions from Question Engine.';
    throw new Error(message);
  }

  const questions = Array.isArray(payload?.questions) ? payload.questions : [];
  if (questions.length !== 5) {
    throw new Error('Question Engine did not return 5 questions.');
  }

  return {
    status: 'ready',
    isbn: payload?.isbn || normalizedIsbn,
    questions,
  };
};
