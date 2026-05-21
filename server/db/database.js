import { DatabaseSync } from 'node:sqlite';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH ?? join(__dir, '..', 'flowmix.db');

const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// ── SCHEMA ────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS tracks (
    id          TEXT PRIMARY KEY,
    filename    TEXT NOT NULL,
    filepath    TEXT NOT NULL UNIQUE,
    title       TEXT NOT NULL,
    artist      TEXT,
    album       TEXT,
    genre       TEXT,
    bpm         REAL,
    key_note    TEXT,
    duration    REAL,
    energy      REAL,
    danceability REAL,
    valence     REAL,
    camelot     TEXT,
    file_size   INTEGER,
    mime_type   TEXT,
    imported_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS playlists (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS playlist_tracks (
    playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    track_id    TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    position    INTEGER NOT NULL,
    PRIMARY KEY (playlist_id, track_id)
  );

  CREATE TABLE IF NOT EXISTS play_history (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    track_id   TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    played_at  TEXT NOT NULL DEFAULT (datetime('now')),
    duration_played REAL
  );

  CREATE TABLE IF NOT EXISTS transitions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    track_a_id   TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    track_b_id   TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    score        REAL NOT NULL,
    crossfade_ms INTEGER,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

export default db;
