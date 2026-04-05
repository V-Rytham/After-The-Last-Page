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

const router = express.Router();

router.use(requireDatabase({ feature: 'User profile' }));

router.get('/username-availability', checkUsernameAvailability);
router.get('/profile', getUserProfile);
router.put('/profile', updateUserProfile);
router.put('/profile/image', updateUserProfileImage);
router.delete('/profile/image', removeUserProfileImage);
router.patch('/preferences/theme', updateThemePreference);

export default router;
