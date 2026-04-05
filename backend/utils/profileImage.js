import { v2 as cloudinary } from 'cloudinary';

const required = [process.env.CLOUDINARY_CLOUD_NAME, process.env.CLOUDINARY_API_KEY, process.env.CLOUDINARY_API_SECRET].every(Boolean);
if (required) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

export const uploadProfileImage = async (dataUri) => {
  if (!required) {
    throw new Error('Cloudinary configuration missing. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.');
  }

  const uploaded = await cloudinary.uploader.upload(dataUri, {
    folder: 'after-the-last-page/profiles',
    transformation: [{ width: 320, height: 320, crop: 'fill', gravity: 'face' }],
  });

  return uploaded.secure_url;
};
