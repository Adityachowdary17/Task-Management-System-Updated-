import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');

export function ensureUploadsDir(): string {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  return UPLOADS_DIR;
}

const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/json',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const EXT_MAP: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'application/pdf': '.pdf',
  'text/plain': '.txt',
  'text/csv': '.csv',
  'application/json': '.json',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, ensureUploadsDir());
  },
  filename: (_req, file, cb) => {
    const ext = EXT_MAP[file.mimetype] || '.bin';
    const randomName = `${Date.now()}-${crypto.randomUUID()}${ext}`;
    cb(null, randomName);
  },
});

export const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB max
    files: 3,
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new Error('Unsupported file type. Allowed: PNG, JPG, WEBP, GIF, PDF, TXT, CSV, DOCX, XLSX.'));
      return;
    }
    cb(null, true);
  },
});

export function resolveSafeUploadPath(filename: string): string | null {
  if (!filename || !/^[a-zA-Z0-9._-]+$/.test(filename)) {
    return null;
  }
  const baseDir = ensureUploadsDir();
  const resolved = path.resolve(baseDir, filename);
  if (!resolved.startsWith(baseDir + path.sep)) {
    return null;
  }
  return resolved;
}
