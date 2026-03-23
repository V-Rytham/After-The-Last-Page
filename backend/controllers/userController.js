import { User } from '../models/User.js';
import { generateToken } from '../utils/generateToken.js';
import { buildSafeErrorBody } from '../utils/runtime.js';

const buildUserResponse = (user) => ({
  _id: user._id,
  anonymousId: user.anonymousId,
  name: user.name || '',
  email: user.email || '',
  isAnonymous: Boolean(user.isAnonymous),
  rating: user.rating,
  preferences: user.preferences,
  token: generateToken(user._id),
});

const generateAnonymousId = async () => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const anonymousId = `Reader #${randomSuffix}`;
    const existingUser = await User.findOne({ anonymousId });
    if (!existingUser) {
      return anonymousId;
    }
  }

  return `Reader #${Date.now().toString().slice(-6)}`;
};

export const registerAnonymousUser = async (req, res) => {
  try {
    const anonymousId = await generateAnonymousId();

    const user = await User.create({
      anonymousId,
      isAnonymous: true,
      rating: 5.0,
      preferences: {
        theme: 'dark',
        defaultMatchMedium: 'text',
      },
    });

    res.status(201).json(buildUserResponse(user));
  } catch (error) {
    res.status(500).json(buildSafeErrorBody('Server error', error));
  }
};

export const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ message: 'An account with that email already exists.' });
    }

    const anonymousId = await generateAnonymousId();
    const user = await User.create({
      anonymousId,
      name: name.trim(),
      email: normalizedEmail,
      password,
      isAnonymous: false,
      rating: 5.0,
      preferences: {
        theme: 'dark',
        defaultMatchMedium: 'text',
      },
    });

    res.status(201).json(buildUserResponse(user));
  } catch (error) {
    res.status(500).json(buildSafeErrorBody('Server error', error));
  }
};

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user || user.isAnonymous || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    res.json(buildUserResponse(user));
  } catch (error) {
    res.status(500).json(buildSafeErrorBody('Server error', error));
  }
};

export const getUserProfile = async (req, res) => {
  try {
    if (req.user) {
      res.json({
        _id: req.user._id,
        anonymousId: req.user.anonymousId,
        name: req.user.name || '',
        email: req.user.email || '',
        isAnonymous: Boolean(req.user.isAnonymous),
        rating: req.user.rating,
        preferences: req.user.preferences,
      });
      return;
    }

    res.status(404).json({ message: 'User not found' });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

