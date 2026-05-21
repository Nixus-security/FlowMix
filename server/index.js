import express   from 'express';
import cors      from 'cors';
import morgan    from 'morgan';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import tracksRouter    from './routes/tracks.js';
import analysisRouter  from './routes/analysis.js';
import playlistsRouter from './routes/playlists.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const PORT  = parseInt(process.env.PORT ?? '3001', 10);

const app = express();

// ── MIDDLEWARE ────────────────────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// ── STATIC: serve uploaded audio files ───────────────────────────────────
app.use('/uploads', express.static(join(__dir, 'uploads')));

// ── ROUTES ────────────────────────────────────────────────────────────────
app.use('/api/tracks',    tracksRouter);
app.use('/api/analysis',  analysisRouter);
app.use('/api/playlists', playlistsRouter);

// ── HEALTH ────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() });
});

// ── ERROR HANDLING ────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── START ─────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  Flow Mix API  →  http://localhost:${PORT}/api`);
  console.log(`  Health        →  http://localhost:${PORT}/api/health\n`);
});

export default app;
