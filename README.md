# Flow Mix

DJ mixing app with AI-assisted transitions. Browser frontend + Node.js backend.

![Flow Mix](https://img.shields.io/badge/version-1.0.0-6c63ff?style=flat-square) ![Node](https://img.shields.io/badge/node-%3E%3D18-339933?style=flat-square&logo=node.js)

## Features

- **Dual deck** playback — Deck A / Deck B with live waveform display
- **AI transitions** — auto-detects compatible tracks via BPM, harmonic key (Camelot wheel), and energy score
- **Audio analysis** — extracts BPM, musical key, energy, danceability, valence from uploaded files
- **EQ + effects** — Bass / Mid / Treble knobs, Reverb, Delay, Filter, Distortion
- **Crossfader** — manual or auto-driven crossfade
- **Auto Mix mode** — hands-free continuous playback with smart transition timing
- **Library** — drag-and-drop audio files (MP3, WAV, FLAC, AAC, OGG)

## Architecture

```
FlowMix/
├── index.html          # App shell
├── style.css           # All styles (dark theme, oklch palette)
├── js/
│   ├── app.js          # Entry point
│   ├── state.js        # Global app state
│   ├── canvas.js       # Waveform + visualizer rendering
│   ├── controls.js     # Transport, EQ, effects, crossfader
│   ├── tracks.js       # Library management
│   ├── audio.js        # Web Audio API engine
│   └── ui.js           # DOM updates
└── server/
    ├── index.js                        # Express server (port 3001)
    ├── routes/
    │   ├── tracks.js                   # POST /api/tracks — upload + analyze
    │   ├── analysis.js                 # POST /api/analysis/compatibility
    │   └── playlists.js                # Playlist management
    └── services/
        ├── audioAnalysis.js            # BPM detection, energy, key extraction
        └── transitionEngine.js         # Compatibility scoring, crossfade timing
```

## Getting Started

### Backend

```bash
cd server
npm install
npm run dev        # node --watch, port 3001
```

Env vars (optional, see `server/.env.example`):

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT`   | `3001`  | API port    |

### Frontend

Static files — open `index.html` directly or serve with any HTTP server:

```bash
# e.g. with VS Code Live Server, or:
npx serve .
```

Frontend auto-connects to `http://localhost:3001/api`.

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/tracks` | Upload audio file, returns analysis |
| `GET`  | `/api/tracks` | List all tracks |
| `POST` | `/api/analysis/compatibility` | Score two tracks |
| `GET`  | `/api/health` | Server health check |

### Track analysis response

```json
{
  "bpm": 128,
  "key_note": "A minor",
  "camelot": "8A",
  "energy": 0.742,
  "danceability": 0.831,
  "valence": 0.614,
  "duration": 245.3
}
```

### Compatibility scoring

Weighted composite of three signals:

| Signal   | Weight | Method |
|----------|--------|--------|
| Harmonic | 45%    | Camelot wheel distance |
| Tempo    | 35%    | BPM ratio (1x / 2x / 0.5x) |
| Energy   | 20%    | Delta penalty |

Score `> 0.85` → 8s crossfade. Score `< 0.40` → 0.8s cut.

## Tech Stack

**Frontend** — Vanilla JS (ES modules), Web Audio API, Canvas 2D, Space Grotesk / JetBrains Mono fonts

**Backend** — Node.js 18+, Express 4, Multer, `music-metadata`, `audio-decode`
