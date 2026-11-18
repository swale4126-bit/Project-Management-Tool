import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

const UPLOAD_ROOT = path.resolve(process.cwd(), env.UPLOAD_DIR || 'uploads');

if (!fs.existsSync(UPLOAD_ROOT)) {
  fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
}

const ALLOWED_MIME_TO_EXT = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
  'text/csv': '.csv',
  'text/plain': '.txt',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_ROOT);
  },
  filename: (_req, file, cb) => {
    const safeExt = ALLOWED_MIME_TO_EXT[file.mimetype] || '.bin';
    cb(null, `${crypto.randomUUID()}${safeExt}`);
  },
});

function fileFilter(_req, file, cb) {
  if (!ALLOWED_MIME_TO_EXT[file.mimetype]) {
    return cb(
      AppError.badRequest(
        `Unsupported file type "${file.mimetype}". Allowed types: JPG, PNG, WEBP, PDF, CSV, TXT, DOCX, XLSX.`,
        'UNSUPPORTED_FILE_TYPE'
      )
    );
  }
  return cb(null, true);
}

export const uploadSingleFile = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: env.MAX_UPLOAD_SIZE_MB * 1024 * 1024,
    files: 1,
  },
});

/**
 * Resolves a stored filename safely inside UPLOAD_ROOT, blocking path traversal (`../`).
 */
export function resolveSafeUploadPath(storedFilename) {
  if (!storedFilename || typeof storedFilename !== 'string') {
    throw AppError.badRequest('Invalid file reference.');
  }
  const baseName = path.basename(storedFilename);
  if (baseName !== storedFilename || baseName.includes('..')) {
    throw AppError.badRequest('Invalid filename detected.', 'INVALID_FILE_PATH');
  }
  const resolved = path.resolve(UPLOAD_ROOT, baseName);
  if (!resolved.startsWith(UPLOAD_ROOT + path.sep)) {
    throw AppError.badRequest('File path outside allowed upload directory.', 'INVALID_FILE_PATH');
  }
  return resolved;
}
