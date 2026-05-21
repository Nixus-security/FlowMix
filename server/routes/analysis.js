import { Router } from 'express';
import db          from '../db/database.js';
import { compatibilityScore, suggestNextTrack } from '../services/transitionEngine.js';

const router = Router();

// ── GET /api/analysis/compatibility?a=<id>&b=<id> ──────────────────────────
router.get('/compatibility', (req, res) => {
  const { a, b } = req.query;
  if (!a || !b) return res.status(400).json({ error: 'Paramètres a et b requis' });

  const trackA = db.prepare('SELECT * FROM tracks WHERE id = ?').get(a);
  const trackB = db.prepare('SELECT * FROM tracks WHERE id = ?').get(b);

  if (!trackA) return res.status(404).json({ error: `Track A (${a}) introuvable` });
  if (!trackB) return res.status(404).json({ error: `Track B (${b}) introuvable` });

  const result = compatibilityScore(trackA, trackB);

  res.json({
    track_a:  { id: trackA.id, title: trackA.title, bpm: trackA.bpm, camelot: trackA.camelot, energy: trackA.energy },
    track_b:  { id: trackB.id, title: trackB.title, bpm: trackB.bpm, camelot: trackB.camelot, energy: trackB.energy },
    ...result,
  });
});

// ── GET /api/analysis/suggest?current=<id>&limit=<n> ──────────────────────
// Suggest best next tracks sorted by compatibility
router.get('/suggest', (req, res) => {
  const { current, limit = 10 } = req.query;
  if (!current) return res.status(400).json({ error: 'Paramètre current requis' });

  const track = db.prepare('SELECT * FROM tracks WHERE id = ?').get(current);
  if (!track) return res.status(404).json({ error: 'Track introuvable' });

  const candidates = db.prepare('SELECT * FROM tracks WHERE id != ?').all(current);
  const suggestions = suggestNextTrack(track, candidates).slice(0, parseInt(limit));

  res.json({
    current: { id: track.id, title: track.title, bpm: track.bpm, camelot: track.camelot },
    suggestions: suggestions.map(s => ({
      id:            s.track.id,
      title:         s.track.title,
      artist:        s.track.artist,
      bpm:           s.track.bpm,
      camelot:       s.track.camelot,
      score:         s.score,
      harmonic:      s.harmonic,
      tempo:         s.tempo,
      energy:        s.energy,
      crossfade_ms:  s.crossfade_ms,
      transition_at: s.transition_at,
    })),
  });
});

// ── GET /api/analysis/stats ────────────────────────────────────────────────
router.get('/stats', (req, res) => {
  const total     = db.prepare('SELECT COUNT(*) as n FROM tracks').get().n;
  const avgBPM    = db.prepare('SELECT AVG(bpm) as v FROM tracks WHERE bpm IS NOT NULL').get().v;
  const genres    = db.prepare(`
    SELECT genre, COUNT(*) as count
    FROM tracks WHERE genre IS NOT NULL
    GROUP BY genre ORDER BY count DESC LIMIT 10
  `).all();
  const bpmDist   = db.prepare(`
    SELECT
      CASE
        WHEN bpm < 90  THEN 'slow (<90)'
        WHEN bpm < 120 THEN 'mid (90-120)'
        WHEN bpm < 140 THEN 'house (120-140)'
        WHEN bpm < 170 THEN 'techno (140-170)'
        ELSE 'fast (170+)'
      END as range, COUNT(*) as count
    FROM tracks WHERE bpm IS NOT NULL
    GROUP BY range
  `).all();
  const recent    = db.prepare(`
    SELECT t.id, t.title, t.artist, h.played_at
    FROM play_history h JOIN tracks t ON h.track_id = t.id
    ORDER BY h.played_at DESC LIMIT 5
  `).all();

  res.json({
    total,
    avg_bpm:      avgBPM ? parseFloat(avgBPM.toFixed(1)) : null,
    genres,
    bpm_distribution: bpmDist,
    recently_played:  recent,
  });
});

export default router;
