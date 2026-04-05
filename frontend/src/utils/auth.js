const USER_KEY = 'currentUser';

export const DEV_USER = {
  _id: 'dev-user-id',
  name: 'Dev Reader',
  username: 'devreader',
  email: 'dev@local.test',
  bio: 'Reading in local development mode.',
  joinedAt: '2026-01-01T00:00:00.000Z',
  stats: { booksCompleted: 0, discussionsParticipated: 0 },
  preferences: { theme: 'dark' },
};

export const getStoredToken = () => null;

export const getStoredUser = () => {
  const rawUser = localStorage.getItem(USER_KEY);
  if (!rawUser) return null;

  try {
    return JSON.parse(rawUser);
  } catch {
    localStorage.removeItem(USER_KEY);
    return null;
  }
};

export const saveAuthSession = (payload) => {
  const user = payload?.user || payload;
  if (!user) return null;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  return user;
};

export const unwrapApiData = (payload) => payload?.data ?? payload;

export const clearAuthSession = () => {
  localStorage.removeItem(USER_KEY);
};

export const updateStoredUser = (patch) => {
  const current = getStoredUser();
  if (!current) return null;
  const nextUser = { ...current, ...patch };
  localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
  return nextUser;
};
