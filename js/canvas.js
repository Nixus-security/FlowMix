'use strict';

import { state, audio } from './state.js';

// ── LOCAL STATE ────────────────────────────────────────────────────────────
let beatPhase = 0;

const vizCanvas = document.getElementById('visualizer');
const vizCtx    = vizCanvas.getContext('2d');

// ── RESIZE ────────────────────────────────────────────────────────────────
export function resizeCanvases() {
  const viz = document.querySelector('.visualizer-canvas-wrap');
  if (viz) {
    vizCanvas.width        = viz.offsetWidth * devicePixelRatio;
    vizCanvas.height       = viz.offsetHeight * devicePixelRatio;
    vizCanvas.style.width  = viz.offsetWidth + 'px';
    vizCanvas.style.height = viz.offsetHeight + 'px';
  }

  ['waveformA', 'waveformB'].forEach(id => {
    const c           = document.getElementById(id);
    const w           = c.parentElement;
    c.width           = w.offsetWidth * devicePixelRatio;
    c.height          = w.offsetHeight * devicePixelRatio;
    c.style.width     = w.offsetWidth + 'px';
    c.style.height    = w.offsetHeight + 'px';
  });
}

// ── FREQUENCY VISUALIZER ──────────────────────────────────────────────────
export function drawVisualizer() {
  const W = vizCanvas.width, H = vizCanvas.height;
  vizCtx.clearRect(0, 0, W, H);

  let freqData;
  if (audio.analyserA && state.isPlaying) {
    freqData = new Uint8Array(audio.analyserA.frequencyBinCount);
    audio.analyserA.getByteFrequencyData(freqData);
  }

  const barCount  = 64;
  const gap       = 2 * devicePixelRatio;
  const barW      = (W - gap * (barCount - 1)) / barCount;
  const time      = performance.now() / 1000;
  const bps       = state.bpm / 60;

  beatPhase = (time * bps) % 1;
  const beatPulse = Math.pow(Math.max(0, 1 - beatPhase * 3), 2);

  for (let i = 0; i < barCount; i++) {
    const t = i / barCount;
    let amplitude;

    if (freqData) {
      amplitude = freqData[Math.floor(t * freqData.length * 0.7)] / 255;
    } else {
      const wave1    = Math.sin(t * Math.PI * 3 + time * 2.4) * 0.4 + 0.4;
      const wave2    = Math.sin(t * Math.PI * 7 - time * 1.8) * 0.2 + 0.2;
      const envelope = Math.sin(t * Math.PI) * 0.8;
      const beat     = i < 8 ? beatPulse * 0.5 : 0;
      amplitude      = (wave1 * 0.5 + wave2 * 0.3 + beat) * envelope;
      if (!state.isPlaying) amplitude *= 0.15;
    }

    const barH  = Math.max(2 * devicePixelRatio, amplitude * H * 0.85);
    const x     = i * (barW + gap);
    const y     = H - barH;
    const alpha = 0.5 + amplitude * 0.5;

    vizCtx.fillStyle = `oklch(${(50 + amplitude * 30).toFixed(0)}% 0.22 285 / ${alpha.toFixed(2)})`;

    const radius = Math.min(barW / 2, 3 * devicePixelRatio);
    vizCtx.beginPath();
    vizCtx.roundRect(x, y, barW, barH, [radius, radius, 0, 0]);
    vizCtx.fill();

    if (amplitude > 0.7) {
      vizCtx.fillStyle = `oklch(80% 0.25 285 / ${((amplitude - 0.7) * 0.8).toFixed(2)})`;
      vizCtx.fillRect(x, y, barW, 2 * devicePixelRatio);
    }
  }
}

// ── WAVEFORM: FROM AUDIO BUFFER ───────────────────────────────────────────
export function renderWaveformPreview(deck, buffer) {
  const id     = deck === 'A' ? 'waveformA' : 'waveformB';
  const canvas = document.getElementById(id);
  const ctx    = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  if (!buffer) { renderWaveformPreviewSimulated(deck); return; }

  const data  = buffer.getChannelData(0);
  const step  = Math.floor(data.length / W);
  const color = deck === 'A' ? 'oklch(65% 0.22 285' : 'oklch(72% 0.18 145';

  ctx.fillStyle = `${color} / 0.12)`;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = `${color} / 0.8)`;
  ctx.lineWidth   = 1;
  ctx.beginPath();

  for (let x = 0; x < W; x++) {
    let min = 1, max = -1;
    for (let j = 0; j < step; j++) {
      const val = data[x * step + j] || 0;
      if (val < min) min = val;
      if (val > max) max = val;
    }
    ctx.moveTo(x, H / 2 + min * (H / 2) * 0.9);
    ctx.lineTo(x, H / 2 + max * (H / 2) * 0.9);
  }
  ctx.stroke();

  ctx.strokeStyle = `${color} / 0.3)`;
  ctx.lineWidth   = 0.5;
  ctx.beginPath();
  ctx.moveTo(0, H / 2);
  ctx.lineTo(W, H / 2);
  ctx.stroke();

  ctx.strokeStyle = `${color} / 1)`;
  ctx.lineWidth   = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, H);
  ctx.stroke();
}

// ── WAVEFORM: PROCEDURAL (no buffer) ─────────────────────────────────────
export function renderWaveformPreviewSimulated(deck) {
  const id     = deck === 'A' ? 'waveformA' : 'waveformB';
  const canvas = document.getElementById(id);
  const ctx    = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const color = deck === 'A' ? 'oklch(65% 0.22 285' : 'oklch(72% 0.18 145';
  const seed  = deck === 'A' ? 1 : 42;

  ctx.fillStyle = `${color} / 0.06)`;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = `${color} / 0.5)`;
  ctx.lineWidth   = 1;
  ctx.beginPath();

  for (let x = 0; x < W; x++) {
    const t         = x / W;
    const s         = Math.sin(t * 40 + seed) * 0.3
                    + Math.sin(t * 17 + seed * 2) * 0.4
                    + Math.sin(t * 7  + seed) * 0.2;
    const amplitude = 0.6 + 0.4 * Math.abs(Math.sin(t * Math.PI * 3 + seed));
    const h         = Math.abs(s) * amplitude;
    ctx.moveTo(x, H / 2 - h * H * 0.4);
    ctx.lineTo(x, H / 2 + h * H * 0.4);
  }
  ctx.stroke();

  ctx.strokeStyle = `${color} / 0.2)`;
  ctx.lineWidth   = 0.5;
  ctx.beginPath();
  ctx.moveTo(0, H / 2);
  ctx.lineTo(W, H / 2);
  ctx.stroke();
}

// ── PLAYHEAD ──────────────────────────────────────────────────────────────
export function drawPlayhead() {
  if (!state.isPlaying || !state.duration) return;

  const canvas = document.getElementById('waveformA');
  const ctx    = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const x      = (state.currentTime / state.duration) * W;

  const track = state.tracks[state.currentIndex];
  if (track && track.audioBuffer) renderWaveformPreview('A', track.audioBuffer);

  ctx.fillStyle = 'oklch(7% 0.018 285 / 0.4)';
  ctx.fillRect(x, 0, W - x, H);

  ctx.strokeStyle = 'oklch(94% 0.008 285 / 0.9)';
  ctx.lineWidth   = 1.5 * devicePixelRatio;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, H);
  ctx.stroke();

  ctx.fillStyle = 'oklch(94% 0.008 285)';
  ctx.beginPath();
  ctx.moveTo(x - 4 * devicePixelRatio, 0);
  ctx.lineTo(x + 4 * devicePixelRatio, 0);
  ctx.lineTo(x, 8 * devicePixelRatio);
  ctx.fill();
}

// ── RENDER LOOP ───────────────────────────────────────────────────────────
export function renderLoop() {
  drawVisualizer();
  drawPlayhead();
  requestAnimationFrame(renderLoop);
}
