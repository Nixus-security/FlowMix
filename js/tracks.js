'use strict';

import { state, GENRES, KEYS } from './state.js';
import { randomBetween }       from './utils.js';

// ── ANALYZE ───────────────────────────────────────────────────────────────
export function analyzeTrack(file) {
  return {
    name:        file.name.replace(/\.[^.]+$/, ''),
    file,
    bpm:         randomBetween(90, 145),
    genre:       GENRES[randomBetween(0, GENRES.length - 1)],
    key:         KEYS[randomBetween(0, KEYS.length - 1)],
    energy:      (Math.random() * 0.6 + 0.3).toFixed(2),
    duration:    0,
    audioBuffer: null,
    url:         URL.createObjectURL(file),
  };
}

// ── ADD TRACKS ────────────────────────────────────────────────────────────
export async function addTracks(files) {
  const { renderTrackList, updateStatus } = await import('./ui.js');

  const newTracks = Array.from(files)
    .filter(f => f.type.startsWith('audio/'))
    .map(analyzeTrack);

  if (!newTracks.length) return;

  state.tracks.push(...newTracks);
  renderTrackList();

  if (state.currentIndex < 0) selectTrack(0);

  updateStatus(`${state.tracks.length} titre${state.tracks.length > 1 ? 's' : ''} dans la bibliothèque`);
}

// ── SELECT TRACK ──────────────────────────────────────────────────────────
export async function selectTrack(idx, autoPlay = false) {
  if (idx < 0 || idx >= state.tracks.length) return;
  const { updateDeckInfo, renderTrackList } = await import('./ui.js');
  const { playTrack }                       = await import('./audio.js');

  state.currentIndex = idx;
  state.nextIndex    = idx + 1 < state.tracks.length ? idx + 1 : -1;

  updateDeckInfo();
  renderTrackList();

  if (autoPlay) playTrack(idx);
}
