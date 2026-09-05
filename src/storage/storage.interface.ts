export interface UploadedFileResult {
  url: string;
  publicId?: string;
}

/**
 * Pluggable storage adapter interface. `local.storage.ts` implements this
 * for dev (writes under uploads/), `cloudinary.storage.ts` implements it
 * for production (when CLOUDINARY_* env vars are present). Swapping the
 * active adapter is a one-line change in `storage/index.ts`.
 */
export interface StorageAdapter {
  upload(file: Express.Multer.File, folder: string): Promise<UploadedFileResult>;
}
