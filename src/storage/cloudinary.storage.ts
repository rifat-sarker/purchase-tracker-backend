import cloudinary from '../config/cloudinary.config';
import { StorageAdapter, UploadedFileResult } from './storage.interface';

/**
 * Cloudinary storage adapter — used when CLOUDINARY_* env vars are present.
 * Uploads the in-memory buffer via an upload_stream.
 */
export class CloudinaryStorageAdapter implements StorageAdapter {
  upload(file: Express.Multer.File, folder: string): Promise<UploadedFileResult> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: `gadget-tracker/${folder}` },
        (error, result) => {
          if (error || !result) {
            return reject(error ?? new Error('Cloudinary upload failed'));
          }
          resolve({ url: result.secure_url, publicId: result.public_id });
        },
      );
      stream.end(file.buffer);
    });
  }
}
