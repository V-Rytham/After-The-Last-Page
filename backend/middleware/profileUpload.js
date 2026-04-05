import multer from 'multer';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file?.mimetype?.startsWith('image/')) {
      cb(new Error('Only image files are allowed.'));
      return;
    }
    cb(null, true);
  },
});

export const profileImageUpload = upload.single('profileImage');
