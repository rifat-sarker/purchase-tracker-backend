import { Request } from 'express';
import multer, { FileFilterCallback } from 'multer';
import httpStatus from 'http-status';
import AppError from '../utils/AppError';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_RECEIPT_IMAGES = 5;

const fileFilter = (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(new AppError(httpStatus.BAD_REQUEST, `Unsupported file type: ${file.mimetype}. Allowed: jpeg, png, webp.`));
  }
  cb(null, true);
};

// Memory storage — the buffer is handed to whichever storage adapter
// (local disk or Cloudinary) is active, see src/storage/index.ts.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: MAX_RECEIPT_IMAGES + 1 },
  fileFilter,
});

export const productImageUpload = upload.fields([
  { name: 'referenceImage', maxCount: 1 },
  { name: 'receiptImages', maxCount: MAX_RECEIPT_IMAGES },
]);

export { MAX_RECEIPT_IMAGES, MAX_FILE_SIZE_BYTES, ALLOWED_MIME_TYPES };
