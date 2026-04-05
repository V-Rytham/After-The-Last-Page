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
  if (!rawUser) return { ...DEV_USER };
  try {
    return { ...DEV_USER, ...JSON.parse(rawUser) };
  } catch {
    return { ...DEV_USER };
  }
};

export const saveAuthSession = (payload) => {
  const user = payload?.user || payload;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  return user;
};

export const unwrapApiData = (payload) => payload?.data ?? payload;

export const clearAuthSession = () => {
  localStorage.setItem(USER_KEY, JSON.stringify(DEV_USER));
};

export const updateStoredUser = (patch) => {
  const current = getStoredUser();
  if (!current) return null;
  const nextUser = { ...current, ...patch };
  localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
  return nextUser;
};
