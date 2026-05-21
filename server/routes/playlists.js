import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/database.js';

const router = Router();

// ── GET /api/playlists ────────────────────────────────────────────────────
router.get('/', (_req, res) => {
  const playlists = db.prepare(`
    SELECT p.*, COUNT(pt.track_id) as track_count
    FROM playlists p
    LEFT JOIN playlist_tracks pt ON p.id = pt.playlist_id
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `).all();
  res.json(playlists);
});

// ── POST /api/playlists ───────────────────────────────────────────────────
router.post('/', (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Nom requis' });

  const id = uuidv4();
  db.prepare('INSERT INTO playlists (id, name) VALUES (?, ?)').run(id, name.trim());
  res.status(201).json(db.prepare('SELECT * FROM playlists WHERE id = ?').get(id));
});

// ── GET /api/playlists/:id/tracks ─────────────────────────────────────────
router.get('/:id/tracks', (req, res) => {
  const pl = db.prepare('SELECT * FROM playlists WHERE id = ?').get(req.params.id);
  if (!pl) return res.status(404).json({ error: 'Playlist introuvable' });

  const tracks = db.prepare(`
    SELECT t.*, pt.position
    FROM playlist_tracks pt JOIN tracks t ON pt.track_id = t.id
    WHERE pt.playlist_id = ?
    ORDER BY pt.position ASC
  `).all(req.params.id);

  res.json({ playlist: pl, tracks });
});

// ── POST /api/playlists/:id/tracks ────────────────────────────────────────
router.post('/:id/tracks', (req, res) => {
  const pl = db.prepare('SELECT * FROM playlists WHERE id = ?').get(req.params.id);
  if (!pl) return res.status(404).json({ error: 'Playlist introuvable' });

  const { track_id, position } = req.body;
  if (!track_id) return res.status(400).json({ error: 'track_id requis' });

  const track = db.prepare('SELECT id FROM tracks WHERE id = ?').get(track_id);
  if (!track) return res.status(404).json({ error: 'Track introuvable' });

  const maxPos = db.prepare(
    'SELECT MAX(position) as m FROM playlist_tracks WHERE playlist_id = ?'
  ).get(req.params.id).m ?? -1;

  const pos = position ?? maxPos + 1;

  db.prepare(`
    INSERT OR REPLACE INTO playlist_tracks (playlist_id, track_id, position)
    VALUES (?, ?, ?)
  `).run(req.params.id, track_id, pos);

  res.status(201).json({ added: true, position: pos });
});

// ── DELETE /api/playlists/:id/tracks/:trackId ─────────────────────────────
router.delete('/:id/tracks/:trackId', (req, res) => {
  db.prepare(
    'DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?'
  ).run(req.params.id, req.params.trackId);
  res.json({ removed: true });
});

// ── DELETE /api/playlists/:id ─────────────────────────────────────────────
router.delete('/:id', (req, res) => {
  const pl = db.prepare('SELECT * FROM playlists WHERE id = ?').get(req.params.id);
  if (!pl) return res.status(404).json({ error: 'Playlist introuvable' });
  db.prepare('DELETE FROM playlists WHERE id = ?').run(req.params.id);
  res.json({ deleted: true });
});

export default router;
