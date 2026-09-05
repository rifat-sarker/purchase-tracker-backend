import fs from 'fs';
import path from 'path';
import { StorageAdapter, UploadedFileResult } from './storage.interface';

const UPLOADS_ROOT = path.join(process.cwd(), 'uploads');

/**
 * Local-disk storage adapter for dev — writes the uploaded file's buffer
 * under uploads/<folder>/ and returns a relative URL served by app.ts's
 * static file middleware.
 */
export class LocalStorageAdapter implements StorageAdapter {
  async upload(file: Express.Multer.File, folder: string): Promise<UploadedFileResult> {
    const dir = path.join(UPLOADS_ROOT, folder);
    fs.mkdirSync(dir, { recursive: true });

    const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    const filePath = path.join(dir, filename);
    fs.writeFileSync(filePath, file.buffer);

    return { url: `/uploads/${folder}/${filename}` };
  }
}
