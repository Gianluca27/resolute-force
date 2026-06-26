import { v2 as cloudinary } from 'cloudinary';
import { env } from '../env.js';

cloudinary.config({ cloud_name: env.CLOUDINARY_CLOUD_NAME, api_key: env.CLOUDINARY_API_KEY, api_secret: env.CLOUDINARY_API_SECRET });

export async function uploadImage(buffer: Buffer, folder = 'resolute-force'): Promise<{ url: string; publicId: string }> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder, resource_type: 'image' }, (err, result) => {
      if (err || !result) return reject(err ?? new Error('Cloudinary upload failed'));
      resolve({ url: result.secure_url, publicId: result.public_id });
    });
    stream.end(buffer);
  });
}

export async function deleteImage(publicId: string): Promise<void> {
  try { await cloudinary.uploader.destroy(publicId); } catch { /* best effort */ }
}
