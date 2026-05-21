'use strict';

import { state } from './state.js';
import { formatTime, escHtml } from './utils.js';

// ── TRACK LIST ────────────────────────────────────────────────────────────
export function renderTrackList() {
  const list    = document.getElementById('trackList');
  const empty   = document.getElementById('emptyLibrary');
  const countEl = document.getElementById('trackCount');

  countEl.textContent = `${state.tracks.length} titre${state.tracks.length !== 1 ? 's' : ''}`;

  if (!state.tracks.length) { empty.style.display = ''; return; }
  empty.style.display = 'none';

  list.innerHTML = state.tracks.map((t, i) => {
    const isActive = i === state.currentIndex;
    const isQueued = i === state.nextIndex;
    const dur      = t.duration > 0 ? formatTime(t.duration) : '—:——';
    return `
      <div class="track-item ${isActive ? 'active' : ''} ${isQueued ? 'queued' : ''}"
           style="animation-delay:${i * 40}ms"
           data-idx="${i}">
        <span class="track-num">${isActive ? '▶' : String(i + 1).padStart(2, '0')}</span>
        <div class="track-details">
          <div class="track-name">${escHtml(t.name)}</div>
          <div class="track-info">${t.bpm} BPM · ${t.key}</div>
          <div class="track-tags">
            <span class="tag tag-genre">${t.genre}</span>
            <span class="tag tag-key">${t.key}</span>
          </div>
        </div>
        <span class="track-duration">${dur}</span>
      </div>`;
  }).join('');

  // Attach click via delegation — avoids inline onclick + module scope issue
  list.querySelectorAll('.track-item').forEach(el => {
    el.addEventListener('click', async () => {
      const idx = parseInt(el.dataset.idx);
      const { selectTrack } = await import('./tracks.js');
      const { togglePlay }  = await import('./audio.js');
      if (idx === state.currentIndex) togglePlay();
      else selectTrack(idx, true);
    });
  });

  const nextEl     = document.getElementById('queueNext');
  const nextNameEl = document.getElementById('queueNextName');
  if (state.nextIndex >= 0) {
    nextEl.style.display   = '';
    nextNameEl.textContent = state.tracks[state.nextIndex].name;
  } else {
    nextEl.style.display = 'none';
  }
}

// ── NOW PLAYING ───────────────────────────────────────────────────────────
export function updateNowPlaying(track) {
  document.getElementById('npTitle').textContent    = track.name;
  document.getElementById('npMeta').textContent     = `${track.genre} · ${track.bpm} BPM · Clé ${track.key}`;
  document.getElementById('bpmValue').textContent   = track.bpm;
  document.getElementById('bpmControl').textContent = track.bpm;
  state.bpm = track.bpm;
}

// ── DECK INFO ─────────────────────────────────────────────────────────────
export function updateDeckInfo() {
  const t = state.tracks[state.currentIndex];
  const n = state.tracks[state.nextIndex];
  document.getElementById('deckAName').textContent = t ? t.name : '—';
  document.getElementById('deckBName').textContent = n ? n.name : '—';
  document.getElementById('deckATime').textContent = t
    ? `${formatTime(0)} / ${formatTime(t.duration || 0)}`
    : '0:00 / 0:00';
  document.getElementById('deckBTime').textContent = n
    ? `En file d'attente · ${n.bpm} BPM`
    : '—';
}

export function updateDeckTimes() {
  const t = state.tracks[state.currentIndex];
  if (t) {
    document.getElementById('deckATime').textContent     = `${formatTime(state.currentTime)} / ${formatTime(state.duration)}`;
    document.getElementById('waveformATime').textContent = formatTime(state.currentTime);
  }
}

// ── PROGRESS ──────────────────────────────────────────────────────────────
export function updateProgressUI() {
  const pct = state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0;
  document.getElementById('progressFill').style.width = pct + '%';
  document.getElementById('timeElapsed').textContent  = formatTime(state.currentTime);
  document.getElementById('timeDuration').textContent = formatTime(state.duration);
}

// ── PLAY BUTTON ───────────────────────────────────────────────────────────
export function updatePlayButton() {
  document.getElementById('iconPlay').style.display  = state.isPlaying ? 'none' : '';
  document.getElementById('iconPause').style.display = state.isPlaying ? '' : 'none';
}

// ── STATUS ────────────────────────────────────────────────────────────────
export function updateStatus(msg) {
  document.getElementById('statusText').textContent = msg;
}

// ── AI SCORES ─────────────────────────────────────────────────────────────
export function updateAIScores() {
  const compat  = (Math.random() * 0.3 + 0.7) * 100;
  const energy  = (Math.random() * 0.4 + 0.5) * 100;
  const transIn = Math.floor(Math.random() * 90 + 30);
  document.getElementById('compatScore').textContent = compat.toFixed(0) + '%';
  document.getElementById('energyScore').textContent = energy.toFixed(0) + '%';
  document.getElementById('transTime').textContent   = `dans ${transIn}s`;
}

// ── CROSSFADER ────────────────────────────────────────────────────────────
export function updateCrossfaderUI() {
  const pct = state.crossfade * 100;
  document.getElementById('crossfillA').style.width = (100 - pct) + '%';
  document.getElementById('crossfillB').style.width = pct + '%';
  document.getElementById('crossThumb').style.left  = pct + '%';
}

// ── EQ KNOB ───────────────────────────────────────────────────────────────
export function updateKnob(knob) {
  const val   = parseFloat(knob.dataset.value);
  const name  = knob.dataset.name;
  const angle = -140 + (val / 100) * 280;
  const rad   = (angle - 90) * Math.PI / 180;
  const cx = 22, cy = 22, r = 13;
  const x2    = cx + r * Math.cos(rad);
  const y2    = cy + r * Math.sin(rad);

  const indicator = knob.querySelector('.knob-indicator');
  if (indicator) {
    indicator.setAttribute('x2', x2.toFixed(1));
    indicator.setAttribute('y2', y2.toFixed(1));
  }

  const startRad = (-140 - 90) * Math.PI / 180;
  const startX   = cx + r * Math.cos(startRad);
  const startY   = cy + r * Math.sin(startRad);
  const largeArc = (val / 100) * 280 > 180 ? 1 : 0;
  const arc = knob.querySelector('.knob-arc');
  if (arc) {
    arc.setAttribute('d',
      `M ${startX.toFixed(1)} ${startY.toFixed(1)} A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`
    );
  }

  const db      = ((val / 100) * 24 - 12).toFixed(1);
  const display = document.querySelector(`.knob-value[data-for="${name}"]`);
  if (display) display.textContent = db > 0 ? `+${db} dB` : `${db} dB`;
  state.knobs[name] = parseFloat(db);
}
