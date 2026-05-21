'use strict';

import { state, audio }          from './state.js';
import { togglePlay }            from './audio.js';
import { selectTrack, addTracks } from './tracks.js';
import { updateCrossfaderUI, updateKnob } from './ui.js';
import { resizeCanvases }        from './canvas.js';

// ── TRANSPORT ─────────────────────────────────────────────────────────────
document.getElementById('btnPlay').addEventListener('click', togglePlay);

document.getElementById('btnPrev').addEventListener('click', () => {
  if (state.currentIndex > 0) selectTrack(state.currentIndex - 1, state.isPlaying);
});

document.getElementById('btnNext').addEventListener('click', () => {
  if (state.nextIndex >= 0) selectTrack(state.nextIndex, state.isPlaying);
});

// ── VOLUME ────────────────────────────────────────────────────────────────
document.getElementById('volumeSlider').addEventListener('input', (e) => {
  state.volume = e.target.value / 100;
  if (audio.gainA) audio.gainA.gain.value = state.volume * (1 - state.crossfade);
  if (audio.gainB) audio.gainB.gain.value = state.volume * state.crossfade;
});

// ── CROSSFADER ────────────────────────────────────────────────────────────
document.getElementById('crossfader').addEventListener('input', (e) => {
  state.crossfade = e.target.value / 100;
  updateCrossfaderUI();
  if (audio.gainA) audio.gainA.gain.value = state.volume * (1 - state.crossfade);
  if (audio.gainB) audio.gainB.gain.value = state.volume * state.crossfade;
});

// ── BPM ───────────────────────────────────────────────────────────────────
document.getElementById('bpmMinus').addEventListener('click', () => {
  state.bpm = Math.max(60, state.bpm - 1);
  document.getElementById('bpmControl').textContent = state.bpm;
  document.getElementById('bpmValue').textContent   = state.bpm;
});

document.getElementById('bpmPlus').addEventListener('click', () => {
  state.bpm = Math.min(200, state.bpm + 1);
  document.getElementById('bpmControl').textContent = state.bpm;
  document.getElementById('bpmValue').textContent   = state.bpm;
});

// ── PROGRESS SEEK ─────────────────────────────────────────────────────────
document.getElementById('progressTrack').addEventListener('click', (e) => {
  if (!state.duration) return;
  const rect        = e.currentTarget.getBoundingClientRect();
  state.currentTime = ((e.clientX - rect.left) / rect.width) * state.duration;
});

// ── TOGGLES ───────────────────────────────────────────────────────────────
document.getElementById('autoMixToggle').addEventListener('click', () => {
  state.autoMix = !state.autoMix;
  document.getElementById('autoMixTrack').className = 'toggle-track' + (state.autoMix ? ' on' : '');
});

document.getElementById('aiToggle').addEventListener('click', () => {
  state.aiEnabled = !state.aiEnabled;
  document.getElementById('aiTrack').className = 'toggle-track' + (state.aiEnabled ? ' on' : '');
});

// ── DRAG & DROP ───────────────────────────────────────────────────────────
const dropzone = document.getElementById('dropzone');

document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('dragleave', (e) => {
  if (!e.relatedTarget || e.relatedTarget === document.body)
    dropzone.classList.remove('drag-over');
});

dropzone.addEventListener('dragover',  (e) => { e.preventDefault(); dropzone.classList.add('drag-over'); });
dropzone.addEventListener('dragleave', ()  => dropzone.classList.remove('drag-over'));
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('drag-over');
  if (e.dataTransfer.files.length) addTracks(e.dataTransfer.files);
});

document.body.addEventListener('drop', (e) => {
  e.preventDefault();
  if (e.dataTransfer.files.length) addTracks(e.dataTransfer.files);
});

document.getElementById('fileInput').addEventListener('change', (e) => {
  if (e.target.files.length) addTracks(e.target.files);
  e.target.value = '';
});

// ── EQ KNOBS ─────────────────────────────────────────────────────────────
document.querySelectorAll('.knob').forEach(knob => {
  let startY, startVal;

  knob.addEventListener('mousedown', (e) => {
    e.preventDefault();
    startY   = e.clientY;
    startVal = parseFloat(knob.dataset.value);

    const onMove = (e) => {
      const dy = startY - e.clientY;
      knob.dataset.value = Math.max(0, Math.min(100, startVal + dy * 0.5));
      updateKnob(knob);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', () => document.removeEventListener('mousemove', onMove), { once: true });
  });

  updateKnob(knob);
});

// ── EFFECT SLIDERS ────────────────────────────────────────────────────────
document.querySelectorAll('.effect-slider-wrap').forEach(wrap => {
  let dragging = false;

  const updateFromEvent = (e) => {
    const rect    = wrap.getBoundingClientRect();
    const pct     = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const fill    = wrap.querySelector('.effect-slider-fill');
    const valueEl = wrap.nextElementSibling;
    fill.style.width = (pct * 100) + '%';
    if (valueEl) valueEl.textContent = Math.round(pct * 100) + '%';
    state.effects[wrap.dataset.effect] = pct;
  };

  wrap.addEventListener('mousedown', (e) => {
    dragging = true;
    updateFromEvent(e);
    const onMove = (e) => { if (dragging) updateFromEvent(e); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', () => {
      dragging = false;
      document.removeEventListener('mousemove', onMove);
    }, { once: true });
  });
});

// ── KEYBOARD SHORTCUTS ────────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.code === 'Space')      { e.preventDefault(); togglePlay(); }
  if (e.code === 'ArrowRight') document.getElementById('btnNext').click();
  if (e.code === 'ArrowLeft')  document.getElementById('btnPrev').click();
});

// ── RESIZE ────────────────────────────────────────────────────────────────
window.addEventListener('resize', resizeCanvases);
