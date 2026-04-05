import { v2 as cloudinary } from 'cloudinary';

const required = [process.env.CLOUDINARY_CLOUD_NAME, process.env.CLOUDINARY_API_KEY, process.env.CLOUDINARY_API_SECRET].every(Boolean);
if (required) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

const validateDataUri = (dataUri) => {
  const normalized = String(dataUri || '').trim();
  if (!normalized) {
    throw new Error('Profile image data is required.');
  }

  if (!/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(normalized)) {
    throw new Error('Unsupported image format. Use JPG, PNG, WEBP, or GIF data URI.');
  }

  return normalized;
};

export const uploadProfileImage = async ({ dataUri, file } = {}) => {
  if (!required) {
    throw new Error('Cloudinary configuration missing. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.');
  }

  let payloadDataUri = String(dataUri || '').trim();
  if (!payloadDataUri && file?.buffer && file?.mimetype) {
    const encoded = file.buffer.toString('base64');
    payloadDataUri = `data:${file.mimetype};base64,${encoded}`;
  }

  const normalizedDataUri = validateDataUri(payloadDataUri);

  const uploaded = await cloudinary.uploader.upload(normalizedDataUri, {
    folder: 'after-the-last-page/profiles',
    transformation: [{ width: 320, height: 320, crop: 'fill', gravity: 'face' }],
  });

  return uploaded.secure_url;
};
