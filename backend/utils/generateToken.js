import jwt from 'jsonwebtoken';

export const issueAuthToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, {
  expiresIn: '7d',
});

// Backward compatibility.
export const generateToken = issueAuthToken;
