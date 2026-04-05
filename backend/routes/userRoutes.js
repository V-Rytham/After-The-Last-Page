import express from 'express';
import {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
  updateUserProfileImage,
  removeUserProfileImage,
  checkUsernameAvailability,
  verifySignupOtp,
  resendOtp,
  refreshSession,
  logoutUser,
  updateThemePreference,
  loginWithGoogle,
  loginGuestUser,
} from '../controllers/userController.js';
import { protect, requireRole } from '../middleware/authMiddleware.js';
import { profileImageUpload } from '../middleware/profileUpload.js';

const router = express.Router();

router.get('/username-availability', checkUsernameAvailability);
router.post('/signup', registerUser);
router.post('/verify-otp', verifySignupOtp);
router.post('/resend-otp', resendOtp);
router.post('/login', loginUser);
router.post('/oauth/google', loginWithGoogle);
router.post('/guest-login', loginGuestUser);
router.post('/refresh', refreshSession);
router.post('/logout', logoutUser);
router.get('/profile', protect, requireRole(['user']), getUserProfile);
router.put('/profile', protect, requireRole(['user']), updateUserProfile);
router.put('/profile/image', protect, requireRole(['user']), profileImageUpload, updateUserProfileImage);
router.delete('/profile/image', protect, requireRole(['user']), removeUserProfileImage);
router.patch('/preferences/theme', protect, requireRole(['user']), updateThemePreference);

export default router;
