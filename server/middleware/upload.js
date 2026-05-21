import multer    from 'multer';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir      = dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = process.env.UPLOADS_DIR ?? join(__dir, '..', 'uploads');

const ALLOWED_MIME = new Set([
  'audio/mpeg', 'audio/mp3',
  'audio/wav', 'audio/x-wav', 'audio/wave',
  'audio/flac', 'audio/x-flac',
  'audio/ogg', 'audio/vorbis',
  'audio/aac', 'audio/x-aac', 'audio/mp4',
  'audio/webm',
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename:    (_req, file, cb) => {
    const ts   = Date.now();
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${ts}_${safe}`);
  },
});

const fileFilter = (_req, file, cb) => {
  if (ALLOWED_MIME.has(file.mimetype)) cb(null, true);
  else cb(new Error(`Type non supporté: ${file.mimetype}`));
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB max per file
});
