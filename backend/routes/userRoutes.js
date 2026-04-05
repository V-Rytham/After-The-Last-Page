import express from 'express';
import {
  getUserProfile,
  updateUserProfile,
  updateUserProfileImage,
  removeUserProfileImage,
  checkUsernameAvailability,
  updateThemePreference,
} from '../controllers/userController.js';
import { requireDatabase } from '../middleware/degradedModeMiddleware.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncRoute } from '../middleware/asyncRoute.js';

const router = express.Router();

router.use(requireAuth);

router.use(requireDatabase({ feature: 'User profile' }));

router.get('/username-availability', asyncRoute(checkUsernameAvailability, 'users.usernameAvailability'));
router.get('/profile', asyncRoute(getUserProfile, 'users.profileGet'));
router.put('/profile', asyncRoute(updateUserProfile, 'users.profileUpdate'));
router.put('/profile/image', asyncRoute(updateUserProfileImage, 'users.profileImageUpdate'));
router.delete('/profile/image', asyncRoute(removeUserProfileImage, 'users.profileImageRemove'));
router.patch('/preferences/theme', asyncRoute(updateThemePreference, 'users.themeUpdate'));

export default router;
