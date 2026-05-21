'use strict';

// ── STATE ──────────────────────────────────────────────────────────────────
const state = {
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

// ── AUDIO ENGINE ─────────────────────────────────────────────────────────
let audioCtx, analyserA, analyserB, sourceA, gainA, gainB;
let animFrameId;
let beatPhase = 0;

function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  gainA = audioCtx.createGain();
  gainB = audioCtx.createGain();
  analyserA = audioCtx.createAnalyser();
  analyserB = audioCtx.createAnalyser();
  analyserA.fftSize = 512;
  analyserB.fftSize = 512;
  gainA.connect(analyserA);
  gainB.connect(analyserB);
  analyserA.connect(audioCtx.destination);
  analyserB.connect(audioCtx.destination);
  gainA.gain.value = 1;
  gainB.gain.value = 0;
}

// ── TRACK MANAGEMENT ─────────────────────────────────────────────────────
const GENRES = ['House', 'Techno', 'Drum & Bass', 'Ambient', 'Funk', 'Hip-Hop', 'Pop', 'Electronic', 'Jazz', 'Soul'];
const KEYS   = ['Am', 'Bm', 'C', 'Dm', 'Em', 'F', 'Gm', 'Ab', 'E', 'Cm'];

function randomBetween(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }

function analyzeTrack(file) {
  return {
    name: file.name.replace(/\.[^.]+$/, ''),
    file,
    bpm: randomBetween(90, 145),
    genre: GENRES[randomBetween(0, GENRES.length - 1)],
    key: KEYS[randomBetween(0, KEYS.length - 1)],
    energy: (Math.random() * 0.6 + 0.3).toFixed(2),
    duration: 0,
    audioBuffer: null,
    url: URL.createObjectURL(file),
  };
}

async function loadAudioBuffer(track) {
  if (track.audioBuffer) return track.audioBuffer;
  const resp = await fetch(track.url);
  const arr  = await resp.arrayBuffer();
  track.audioBuffer = await audioCtx.decodeAudioData(arr);
  track.duration    = track.audioBuffer.duration;
  return track.audioBuffer;
}

function addTracks(files) {
  const newTracks = Array.from(files).filter(f => f.type.startsWith('audio/')).map(analyzeTrack);
  if (!newTracks.length) return;
  state.tracks.push(...newTracks);
  renderTrackList();
  if (state.currentIndex < 0) selectTrack(0);
  updateStatus(`${state.tracks.length} titre${state.tracks.length > 1 ? 's' : ''} dans la bibliothèque`);
}

function selectTrack(idx, autoPlay = false) {
  if (idx < 0 || idx >= state.tracks.length) return;
  state.currentIndex = idx;
  state.nextIndex    = idx + 1 < state.tracks.length ? idx + 1 : -1;
  updateDeckInfo();
  renderTrackList();
  if (autoPlay) playTrack(idx);
}

async function playTrack(idx) {
  if (!audioCtx) initAudio();
  if (audioCtx.state === 'suspended') await audioCtx.resume();
  if (idx < 0 || idx >= state.tracks.length) return;

  const track = state.tracks[idx];
  updateStatus('Chargement…');

  try {
    await loadAudioBuffer(track);

    if (sourceA) { try { sourceA.stop(); } catch(e) {} }

    sourceA           = audioCtx.createBufferSource();
    sourceA.buffer    = track.audioBuffer;
    sourceA.connect(gainA);
    sourceA.start(0);
    sourceA.onended   = () => { if (state.isPlaying) handleTrackEnd(); };

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
  } catch(err) {
    updateStatus('Erreur de chargement audio');
    console.error(err);
  }
}

let progressInterval = null;
function startProgressTimer() {
  if (progressInterval) clearInterval(progressInterval);
  const startTime = audioCtx ? audioCtx.currentTime : 0;

  progressInterval = setInterval(() => {
    if (!state.isPlaying) return;
    const elapsed     = audioCtx ? (audioCtx.currentTime - startTime) : 0;
    state.currentTime = Math.min(elapsed, state.duration);
    updateProgressUI();
    updateDeckTimes();

    if (state.autoMix && state.duration > 0 && state.duration - state.currentTime < 15) {
      const progress          = 1 - (state.duration - state.currentTime) / 15;
      state.transitionProgress = Math.min(progress, 1);
      state.isTransitioning   = true;
      document.getElementById('transitionFill').style.width   = (state.transitionProgress * 100) + '%';
      document.getElementById('transitionStatus').textContent = 'En cours…';
      document.getElementById('deckAWf').classList.add('transitioning');
    }
  }, 100);
}

function handleTrackEnd() {
  clearInterval(progressInterval);
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

// ── UI UPDATES ─────────────────────────────────────────────────────────
function renderTrackList() {
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
           onclick="handleTrackClick(${i})">
        <span class="track-num">${isActive ? '▶' : String(i+1).padStart(2,'0')}</span>
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

  const nextEl     = document.getElementById('queueNext');
  const nextNameEl = document.getElementById('queueNextName');
  if (state.nextIndex >= 0) {
    nextEl.style.display       = '';
    nextNameEl.textContent     = state.tracks[state.nextIndex].name;
  } else {
    nextEl.style.display = 'none';
  }
}

function handleTrackClick(idx) {
  if (idx === state.currentIndex) togglePlay();
  else selectTrack(idx, true);
}

function updateNowPlaying(track) {
  document.getElementById('npTitle').textContent   = track.name;
  document.getElementById('npMeta').textContent    = `${track.genre} · ${track.bpm} BPM · Clé ${track.key}`;
  document.getElementById('bpmValue').textContent  = track.bpm;
  document.getElementById('bpmControl').textContent = track.bpm;
  state.bpm = track.bpm;
}

function updateDeckInfo() {
  const t = state.tracks[state.currentIndex];
  const n = state.tracks[state.nextIndex];
  document.getElementById('deckAName').textContent = t ? t.name : '—';
  document.getElementById('deckBName').textContent = n ? n.name : '—';
  document.getElementById('deckATime').textContent = t ? `${formatTime(0)} / ${formatTime(t.duration || 0)}` : '0:00 / 0:00';
  document.getElementById('deckBTime').textContent = n ? `En file d'attente · ${n.bpm} BPM` : '—';
}

function updateDeckTimes() {
  const t = state.tracks[state.currentIndex];
  if (t) {
    document.getElementById('deckATime').textContent    = `${formatTime(state.currentTime)} / ${formatTime(state.duration)}`;
    document.getElementById('waveformATime').textContent = formatTime(state.currentTime);
  }
}

function updateProgressUI() {
  const pct = state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0;
  document.getElementById('progressFill').style.width  = pct + '%';
  document.getElementById('timeElapsed').textContent   = formatTime(state.currentTime);
  document.getElementById('timeDuration').textContent  = formatTime(state.duration);
}

function updatePlayButton() {
  document.getElementById('iconPlay').style.display  = state.isPlaying ? 'none' : '';
  document.getElementById('iconPause').style.display = state.isPlaying ? '' : 'none';
}

function updateStatus(msg) {
  document.getElementById('statusText').textContent = msg;
}

function updateAIScores() {
  const compat   = (Math.random() * 0.3 + 0.7) * 100;
  const energy   = (Math.random() * 0.4 + 0.5) * 100;
  const transIn  = Math.floor(Math.random() * 90 + 30);
  document.getElementById('compatScore').textContent = compat.toFixed(0) + '%';
  document.getElementById('energyScore').textContent = energy.toFixed(0) + '%';
  document.getElementById('transTime').textContent   = `dans ${transIn}s`;
}

// ── TRANSPORT CONTROLS ──────────────────────────────────────────────────
function togglePlay() {
  if (!state.tracks.length) return;
  if (!audioCtx) initAudio();

  if (!state.isPlaying) {
    if (state.currentIndex < 0) selectTrack(0, true);
    else if (audioCtx) audioCtx.resume();
    state.isPlaying = true;
    startProgressTimer();
  } else {
    if (audioCtx) audioCtx.suspend();
    state.isPlaying = false;
    clearInterval(progressInterval);
  }
  updatePlayButton();
  updateStatus(state.isPlaying ? 'Lecture' : 'Pause');
}

document.getElementById('btnPlay').addEventListener('click', togglePlay);
document.getElementById('btnPrev').addEventListener('click', () => {
  if (state.currentIndex > 0) selectTrack(state.currentIndex - 1, state.isPlaying);
});
document.getElementById('btnNext').addEventListener('click', () => {
  if (state.nextIndex >= 0) selectTrack(state.nextIndex, state.isPlaying);
});

document.getElementById('volumeSlider').addEventListener('input', (e) => {
  state.volume = e.target.value / 100;
  if (gainA) gainA.gain.value = state.volume * (1 - state.crossfade);
  if (gainB) gainB.gain.value = state.volume * state.crossfade;
});

document.getElementById('crossfader').addEventListener('input', (e) => {
  state.crossfade = e.target.value / 100;
  updateCrossfaderUI();
  if (gainA) gainA.gain.value = state.volume * (1 - state.crossfade);
  if (gainB) gainB.gain.value = state.volume * state.crossfade;
});

function updateCrossfaderUI() {
  const pct = state.crossfade * 100;
  document.getElementById('crossfillA').style.width = (100 - pct) + '%';
  document.getElementById('crossfillB').style.width = pct + '%';
  document.getElementById('crossThumb').style.left  = pct + '%';
}

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

document.getElementById('autoMixToggle').addEventListener('click', () => {
  state.autoMix = !state.autoMix;
  document.getElementById('autoMixTrack').className = 'toggle-track' + (state.autoMix ? ' on' : '');
});

document.getElementById('aiToggle').addEventListener('click', () => {
  state.aiEnabled = !state.aiEnabled;
  document.getElementById('aiTrack').className = 'toggle-track' + (state.aiEnabled ? ' on' : '');
});

document.getElementById('progressTrack').addEventListener('click', (e) => {
  if (!state.duration) return;
  const rect        = e.currentTarget.getBoundingClientRect();
  const pct         = (e.clientX - rect.left) / rect.width;
  state.currentTime = pct * state.duration;
  updateProgressUI();
});

// ── DRAG & DROP ──────────────────────────────────────────────────────────
const dropzone = document.getElementById('dropzone');
document.addEventListener('dragover', (e) => { e.preventDefault(); });
document.addEventListener('dragleave', (e) => {
  if (!e.relatedTarget || e.relatedTarget === document.body) dropzone.classList.remove('drag-over');
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

// ── KNOBS ──────────────────────────────────────────────────────────────
document.querySelectorAll('.knob').forEach(knob => {
  let startY, startVal;

  knob.addEventListener('mousedown', (e) => {
    e.preventDefault();
    startY    = e.clientY;
    startVal  = parseFloat(knob.dataset.value);
    document.addEventListener('mousemove', onKnobMove);
    document.addEventListener('mouseup', () => document.removeEventListener('mousemove', onKnobMove), { once: true });
  });

  function onKnobMove(e) {
    const dy = startY - e.clientY;
    const val = Math.max(0, Math.min(100, startVal + dy * 0.5));
    knob.dataset.value = val;
    updateKnob(knob);
  }
});

function updateKnob(knob) {
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
  const startY2  = cy + r * Math.sin(startRad);
  const largeArc = (val / 100) * 280 > 180 ? 1 : 0;
  const arc = knob.querySelector('.knob-arc');
  if (arc) {
    arc.setAttribute('d', `M ${startX.toFixed(1)} ${startY2.toFixed(1)} A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`);
  }

  const db      = ((val / 100) * 24 - 12).toFixed(1);
  const display = document.querySelector(`.knob-value[data-for="${name}"]`);
  if (display) display.textContent = db > 0 ? `+${db} dB` : `${db} dB`;
  state.knobs[name] = parseFloat(db);
}

document.querySelectorAll('.knob').forEach(k => updateKnob(k));

// ── EFFECT SLIDERS ──────────────────────────────────────────────────────
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
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', () => { dragging = false; document.removeEventListener('mousemove', onMove); }, { once: true });
  });

  function onMove(e) { if (dragging) updateFromEvent(e); }
});

// ── CANVAS VISUALIZERS ──────────────────────────────────────────────────
const vizCanvas = document.getElementById('visualizer');
const vizCtx    = vizCanvas.getContext('2d');

function resizeCanvases() {
  const viz = document.querySelector('.visualizer-canvas-wrap');
  if (viz) {
    vizCanvas.width        = viz.offsetWidth * devicePixelRatio;
    vizCanvas.height       = viz.offsetHeight * devicePixelRatio;
    vizCanvas.style.width  = viz.offsetWidth + 'px';
    vizCanvas.style.height = viz.offsetHeight + 'px';
  }

  ['waveformA', 'waveformB'].forEach(id => {
    const c            = document.getElementById(id);
    const w            = c.parentElement;
    c.width            = w.offsetWidth * devicePixelRatio;
    c.height           = w.offsetHeight * devicePixelRatio;
    c.style.width      = w.offsetWidth + 'px';
    c.style.height     = w.offsetHeight + 'px';
  });
}

window.addEventListener('resize', resizeCanvases);
setTimeout(resizeCanvases, 100);

function drawVisualizer() {
  const W = vizCanvas.width, H = vizCanvas.height;
  vizCtx.clearRect(0, 0, W, H);

  let freqData;
  if (analyserA && state.isPlaying) {
    freqData = new Uint8Array(analyserA.frequencyBinCount);
    analyserA.getByteFrequencyData(freqData);
  }

  const barCount = 64;
  const gap      = 2 * devicePixelRatio;
  const barW     = (W - gap * (barCount - 1)) / barCount;
  const time     = performance.now() / 1000;
  const bps      = state.bpm / 60;

  beatPhase = (time * bps) % 1;
  const beatPulse = Math.pow(Math.max(0, 1 - beatPhase * 3), 2);

  for (let i = 0; i < barCount; i++) {
    const t = i / barCount;
    let amplitude;

    if (freqData) {
      const idx = Math.floor(t * freqData.length * 0.7);
      amplitude = freqData[idx] / 255;
    } else {
      const wave1    = Math.sin(t * Math.PI * 3 + time * 2.4) * 0.4 + 0.4;
      const wave2    = Math.sin(t * Math.PI * 7 - time * 1.8) * 0.2 + 0.2;
      const envelope = Math.sin(t * Math.PI) * 0.8;
      const beat     = i < 8 ? beatPulse * 0.5 : 0;
      amplitude      = (wave1 * 0.5 + wave2 * 0.3 + beat) * envelope;
      if (!state.isPlaying) amplitude *= 0.15;
    }

    const barH   = Math.max(2 * devicePixelRatio, amplitude * H * 0.85);
    const x      = i * (barW + gap);
    const y      = H - barH;
    const alpha  = 0.5 + amplitude * 0.5;

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

function renderWaveformPreview(deck, buffer) {
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

function renderWaveformPreviewSimulated(deck) {
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
    const s         = Math.sin(t * 40 + seed) * 0.3 + Math.sin(t * 17 + seed * 2) * 0.4 + Math.sin(t * 7 + seed) * 0.2;
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

function drawPlayhead() {
  if (!state.isPlaying || !state.duration) return;
  const canvas = document.getElementById('waveformA');
  const ctx    = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const pct    = state.currentTime / state.duration;
  const x      = pct * W;

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

// ── RENDER LOOP ────────────────────────────────────────────────────────
function renderLoop() {
  drawVisualizer();
  drawPlayhead();
  animFrameId = requestAnimationFrame(renderLoop);
}

// ── HELPERS ────────────────────────────────────────────────────────────
function formatTime(secs) {
  if (!secs || isNaN(secs)) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── INIT ───────────────────────────────────────────────────────────────
function init() {
  resizeCanvases();
  renderLoop();
  setTimeout(() => {
    renderWaveformPreviewSimulated('A');
    renderWaveformPreviewSimulated('B');
  }, 300);
}

window.addEventListener('load', init);

document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.code === 'Space')      { e.preventDefault(); togglePlay(); }
  if (e.code === 'ArrowRight') document.getElementById('btnNext').click();
  if (e.code === 'ArrowLeft')  document.getElementById('btnPrev').click();
});
