import { success } from '../utils/apiResponse.js';

const buildDummyUser = (payload = {}) => {
  const preferredName = String(payload.name || '').trim();
  const preferredUsername = String(payload.username || '').trim();
  const preferredEmail = String(payload.email || '').trim().toLowerCase();

  return {
    _id: 'dev-user-id',
    name: preferredName || 'Dev Reader',
    username: preferredUsername || 'devreader',
    email: preferredEmail || 'dev@local.test',
    role: 'admin',
    preferences: { theme: 'dark' },
  };
};

export const register = async (req, res) => {
  const user = buildDummyUser(req.body ?? {});
  return success(res, { user }, 201);
};

export const login = async (req, res) => {
  const user = buildDummyUser(req.body ?? {});
  return success(res, { user });
};

export const me = async (req, res) => {
  const user = req.user?._id ? req.user : buildDummyUser();
  return success(res, { user });
};

export const logout = async (_req, res) => success(res, { loggedOut: true });
