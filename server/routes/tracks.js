import { Router }         from 'express';
import { createReadStream, statSync } from 'fs';
import { unlink }         from 'fs/promises';
import { v4 as uuidv4 }   from 'uuid';
import db                 from '../db/database.js';
import { upload }         from '../middleware/upload.js';
import { analyzeAudioFile } from '../services/audioAnalysis.js';

const router = Router();

// ── POST /api/tracks/import ───────────────────────────────────────────────
// Upload + analyze one or more audio files
router.post('/import', upload.array('files', 50), async (req, res, next) => {
  if (!req.files?.length) {
    return res.status(400).json({ error: 'Aucun fichier reçu' });
  }

  const results = [];

  for (const file of req.files) {
    try {
      const analysis = await analyzeAudioFile(file.path);
      const id       = uuidv4();

      const insert = db.prepare(`
        INSERT INTO tracks
          (id, filename, filepath, title, artist, album, genre,
           bpm, key_note, duration, energy, danceability, valence,
           camelot, file_size, mime_type)
        VALUES
          (@id, @filename, @filepath, @title, @artist, @album, @genre,
           @bpm, @key_note, @duration, @energy, @danceability, @valence,
           @camelot, @file_size, @mime_type)
        ON CONFLICT(filepath) DO UPDATE SET
          title        = excluded.title,
          artist       = excluded.artist,
          bpm          = excluded.bpm,
          key_note     = excluded.key_note,
          duration     = excluded.duration,
          energy       = excluded.energy,
          danceability = excluded.danceability,
          valence      = excluded.valence,
          camelot      = excluded.camelot
      `);

      insert.run({
        id,
        filename:     file.originalname,
        filepath:     file.path,
        title:        analysis.title    ?? file.originalname.replace(/\.[^.]+$/, ''),
        artist:       analysis.artist   ?? null,
        album:        analysis.album    ?? null,
        genre:        analysis.genre    ?? null,
        bpm:          analysis.bpm,
        key_note:     analysis.key_note ?? null,
        duration:     analysis.duration ?? null,
        energy:       analysis.energy,
        danceability: analysis.danceability,
        valence:      analysis.valence,
        camelot:      analysis.camelot  ?? null,
        file_size:    file.size,
        mime_type:    file.mimetype,
      });

      const track = db.prepare('SELECT * FROM tracks WHERE filepath = ?').get(file.path);
      results.push(track);
    } catch (err) {
      // Cleanup file on analysis failure
      await unlink(file.path).catch(() => {});
      results.push({ error: err.message, filename: file.originalname });
    }
  }

  res.status(201).json({ imported: results.length, tracks: results });
});

// ── GET /api/tracks ────────────────────────────────────────────────────────
// List all tracks, optional ?q= search + ?sort= ordering
router.get('/', (req, res) => {
  const { q, sort = 'imported_at', order = 'desc', limit = 200, offset = 0 } = req.query;

  const ALLOWED_SORT  = ['title', 'artist', 'bpm', 'energy', 'duration', 'imported_at', 'genre'];
  const ALLOWED_ORDER = ['asc', 'desc'];

  const safeSort  = ALLOWED_SORT.includes(sort)   ? sort  : 'imported_at';
  const safeOrder = ALLOWED_ORDER.includes(order) ? order : 'desc';

  let sql    = 'SELECT * FROM tracks';
  const params = [];

  if (q) {
    sql += ' WHERE title LIKE ? OR artist LIKE ? OR genre LIKE ?';
    const like = `%${q}%`;
    params.push(like, like, like);
  }

  sql += ` ORDER BY ${safeSort} ${safeOrder} LIMIT ? OFFSET ?`;
  params.push(parseInt(limit), parseInt(offset));

  const tracks = db.prepare(sql).all(...params);
  const total  = db.prepare('SELECT COUNT(*) as n FROM tracks').get().n;

  res.json({ total, tracks });
});

// ── GET /api/tracks/:id ────────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const track = db.prepare('SELECT * FROM tracks WHERE id = ?').get(req.params.id);
  if (!track) return res.status(404).json({ error: 'Track introuvable' });
  res.json(track);
});

// ── GET /api/tracks/:id/stream ─────────────────────────────────────────────
// Stream audio file with Range support
router.get('/:id/stream', (req, res) => {
  const track = db.prepare('SELECT * FROM tracks WHERE id = ?').get(req.params.id);
  if (!track) return res.status(404).json({ error: 'Track introuvable' });

  let stat;
  try { stat = statSync(track.filepath); }
  catch { return res.status(404).json({ error: 'Fichier audio introuvable sur disque' }); }

  const fileSize  = stat.size;
  const range     = req.headers.range;
  const mimeType  = track.mime_type ?? 'audio/mpeg';

  if (range) {
    const [startStr, endStr] = range.replace('bytes=', '').split('-');
    const start = parseInt(startStr, 10);
    const end   = endStr ? parseInt(endStr, 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    res.writeHead(206, {
      'Content-Range':  `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges':  'bytes',
      'Content-Length': chunkSize,
      'Content-Type':   mimeType,
    });
    createReadStream(track.filepath, { start, end }).pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type':   mimeType,
      'Accept-Ranges':  'bytes',
    });
    createReadStream(track.filepath).pipe(res);
  }
});

// ── PATCH /api/tracks/:id ─────────────────────────────────────────────────
// Manual metadata override
router.patch('/:id', (req, res) => {
  const track = db.prepare('SELECT * FROM tracks WHERE id = ?').get(req.params.id);
  if (!track) return res.status(404).json({ error: 'Track introuvable' });

  const allowed = ['title', 'artist', 'album', 'genre', 'bpm', 'key_note', 'camelot'];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  if (!Object.keys(updates).length) {
    return res.status(400).json({ error: 'Aucun champ à mettre à jour' });
  }

  const setClauses = Object.keys(updates).map(k => `${k} = @${k}`).join(', ');
  db.prepare(`UPDATE tracks SET ${setClauses} WHERE id = @id`).run({ ...updates, id: req.params.id });

  const updated = db.prepare('SELECT * FROM tracks WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// ── DELETE /api/tracks/:id ─────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const track = db.prepare('SELECT * FROM tracks WHERE id = ?').get(req.params.id);
  if (!track) return res.status(404).json({ error: 'Track introuvable' });

  db.prepare('DELETE FROM tracks WHERE id = ?').run(req.params.id);

  // Delete physical file
  await unlink(track.filepath).catch(() => {});

  res.json({ deleted: true, id: req.params.id });
});

// ── POST /api/tracks/:id/played ──────────────────────────────────────────
// Log play event to history
router.post('/:id/played', (req, res) => {
  const track = db.prepare('SELECT id FROM tracks WHERE id = ?').get(req.params.id);
  if (!track) return res.status(404).json({ error: 'Track introuvable' });

  const { duration_played } = req.body;
  db.prepare('INSERT INTO play_history (track_id, duration_played) VALUES (?, ?)').run(
    req.params.id, duration_played ?? null,
  );
  res.json({ logged: true });
});

export default router;
