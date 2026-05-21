'use strict';

export const state = {
  tracks: [],
  currentIndex: -1,
  nextIndex: -1,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 0.8,
  crossfade: 0.5,
  bpm: 128,
  autoMix: true,
  aiEnabled: true,
  transitionProgress: 0,
  isTransitioning: false,
  knobs: { bass: 0, mid: 0, treble: 0 },
  effects: { reverb: 0.2, delay: 0, filter: 0.5, distortion: 0 },
};

// Mutable audio engine references in one object so modules share the same refs
export const audio = {
  ctx: null,
  analyserA: null,
  analyserB: null,
  sourceA: null,
  gainA: null,
  gainB: null,
  progressInterval: null,
};

export const GENRES = ['House', 'Techno', 'Drum & Bass', 'Ambient', 'Funk', 'Hip-Hop', 'Pop', 'Electronic', 'Jazz', 'Soul'];
export const KEYS   = ['Am', 'Bm', 'C', 'Dm', 'Em', 'F', 'Gm', 'Ab', 'E', 'Cm'];
