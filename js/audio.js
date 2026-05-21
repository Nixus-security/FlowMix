'use strict';

import { state, audio } from './state.js';

// ── INIT ──────────────────────────────────────────────────────────────────
export function initAudio() {
  if (audio.ctx) return;
  audio.ctx       = new (window.AudioContext || window.webkitAudioContext)();
  audio.gainA     = audio.ctx.createGain();
  audio.gainB     = audio.ctx.createGain();
  audio.analyserA = audio.ctx.createAnalyser();
  audio.analyserB = audio.ctx.createAnalyser();
  audio.analyserA.fftSize = 512;
  audio.analyserB.fftSize = 512;
  audio.gainA.connect(audio.analyserA);
  audio.gainB.connect(audio.analyserB);
  audio.analyserA.connect(audio.ctx.destination);
  audio.analyserB.connect(audio.ctx.destination);
  audio.gainA.gain.value = 1;
  audio.gainB.gain.value = 0;
}

// ── BUFFER LOADING ────────────────────────────────────────────────────────
export async function loadAudioBuffer(track) {
  if (track.audioBuffer) return track.audioBuffer;
  const resp          = await fetch(track.url);
  const arr           = await resp.arrayBuffer();
  track.audioBuffer   = await audio.ctx.decodeAudioData(arr);
  track.duration      = track.audioBuffer.duration;
  return track.audioBuffer;
}

// ── PLAYBACK ──────────────────────────────────────────────────────────────
export async function playTrack(idx) {
  // Import ui lazily to avoid circular dep at module init time
  const { updateStatus, updateNowPlaying, updatePlayButton, updateAIScores } = await import('./ui.js');
  const { renderWaveformPreview, renderWaveformPreviewSimulated }             = await import('./canvas.js');
  const { startProgressTimer }                                                = await import('./audio.js');

  if (!audio.ctx) initAudio();
  if (audio.ctx.state === 'suspended') await audio.ctx.resume();
  if (idx < 0 || idx >= state.tracks.length) return;

  const track = state.tracks[idx];
  updateStatus('Chargement…');

  try {
    await loadAudioBuffer(track);

    if (audio.sourceA) { try { audio.sourceA.stop(); } catch(e) {} }

    audio.sourceA        = audio.ctx.createBufferSource();
    audio.sourceA.buffer = track.audioBuffer;
    audio.sourceA.connect(audio.gainA);
    audio.sourceA.start(0);
    audio.sourceA.onended = () => { if (state.isPlaying) handleTrackEnd(); };

    state.isPlaying   = true;
    state.currentTime = 0;
    state.duration    = track.duration;

    updatePlayButton();
    updateNowPlaying(track);
    updateStatus(`Lecture: ${track.name}`);
    renderWaveformPreview('A', track.audioBuffer);

    if (state.nextIndex >= 0) {
      renderWaveformPreviewSimulated('B');
      updateStatus('IA: analyse de la prochaine transition…');
      updateAIScores();
    }

    startProgressTimer();
  } catch (err) {
    updateStatus('Erreur de chargement audio');
    console.error(err);
  }
}

// ── PROGRESS TIMER ────────────────────────────────────────────────────────
export function startProgressTimer() {
  if (audio.progressInterval) clearInterval(audio.progressInterval);
  const startTime = audio.ctx ? audio.ctx.currentTime : 0;

  audio.progressInterval = setInterval(async () => {
    if (!state.isPlaying) return;
    const { updateProgressUI, updateDeckTimes } = await import('./ui.js');

    const elapsed     = audio.ctx ? (audio.ctx.currentTime - startTime) : 0;
    state.currentTime = Math.min(elapsed, state.duration);
    updateProgressUI();
    updateDeckTimes();

    if (state.autoMix && state.duration > 0 && state.duration - state.currentTime < 15) {
      const progress           = 1 - (state.duration - state.currentTime) / 15;
      state.transitionProgress = Math.min(progress, 1);
      state.isTransitioning    = true;
      document.getElementById('transitionFill').style.width   = (state.transitionProgress * 100) + '%';
      document.getElementById('transitionStatus').textContent = 'En cours…';
      document.getElementById('deckAWf').classList.add('transitioning');
    }
  }, 100);
}

// ── TRACK END ─────────────────────────────────────────────────────────────
export async function handleTrackEnd() {
  const { selectTrack } = await import('./tracks.js');
  const { updatePlayButton, updateStatus } = await import('./ui.js');

  clearInterval(audio.progressInterval);
  state.isTransitioning    = false;
  state.transitionProgress = 0;
  document.getElementById('transitionFill').style.width   = '0%';
  document.getElementById('transitionStatus').textContent = '—';
  document.getElementById('deckAWf').classList.remove('transitioning');

  if (state.nextIndex >= 0) {
    selectTrack(state.nextIndex, true);
  } else {
    state.isPlaying = false;
    updatePlayButton();
    updateStatus('Fin de la file de lecture');
  }
}

// ── TOGGLE PLAY ───────────────────────────────────────────────────────────
export async function togglePlay() {
  if (!state.tracks.length) return;
  if (!audio.ctx) initAudio();

  const { updatePlayButton, updateStatus } = await import('./ui.js');
  const { selectTrack }                    = await import('./tracks.js');

  if (!state.isPlaying) {
    if (state.currentIndex < 0) { selectTrack(0, true); return; }
    if (audio.ctx) await audio.ctx.resume();
    state.isPlaying = true;
    startProgressTimer();
  } else {
    if (audio.ctx) audio.ctx.suspend();
    state.isPlaying = false;
    clearInterval(audio.progressInterval);
  }
  updatePlayButton();
  updateStatus(state.isPlaying ? 'Lecture' : 'Pause');
}
