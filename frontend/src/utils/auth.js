const USER_KEY = 'currentUser';

export const getStoredToken = () => null;

export const getStoredUser = () => {
  const rawUser = localStorage.getItem(USER_KEY);
  if (!rawUser) return null;
  try {
    return JSON.parse(rawUser);
  } catch {
    return null;
  }
};

export const saveAuthSession = (payload) => {
  const user = payload?.user || payload;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  return user;
};

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
