import fs from 'fs';
import path from 'path';
import { StorageAdapter, UploadedFileResult } from './storage.interface';

const UPLOADS_ROOT = path.join(process.cwd(), 'uploads');

// Extension is derived from the already-validated MIME type (see
// upload.ts's fileFilter), never from the client-supplied original
// filename. Trusting `file.originalname`'s extension would let a
// disguised upload (e.g. named "x.png" but sent with a spoofed
// image/png Content-Type while actually containing HTML/JS) get saved
// with an attacker-chosen extension and later served back — by
// express.static's mime-type-by-extension lookup — as text/html,
// executing as a stored XSS payload from this origin.
const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

/**
 * Local-disk storage adapter for dev — writes the uploaded file's buffer
 * under uploads/<folder>/ and returns a relative URL served by app.ts's
 * static file middleware.
 */
export class LocalStorageAdapter implements StorageAdapter {
  async upload(file: Express.Multer.File, folder: string): Promise<UploadedFileResult> {
    const dir = path.join(UPLOADS_ROOT, folder);
    fs.mkdirSync(dir, { recursive: true });

    const ext = EXTENSION_BY_MIME[file.mimetype] ?? '.bin';
    const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    const filePath = path.join(dir, filename);
    fs.writeFileSync(filePath, file.buffer);

    return { url: `/uploads/${folder}/${filename}` };
  }
}
