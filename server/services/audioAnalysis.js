import { parseFile } from 'music-metadata';
import { readFile }  from 'fs/promises';

// ── CAMELOT WHEEL ─────────────────────────────────────────────────────────
// Maps musical key → Camelot notation for harmonic mixing
const KEY_TO_CAMELOT = {
  'C major':  '8B', 'A minor':  '8A',
  'G major':  '9B', 'E minor':  '9A',
  'D major': '10B', 'B minor': '10A',
  'A major': '11B', 'F# minor':'11A',
  'E major': '12B', 'C# minor':'12A',
  'B major':  '1B', 'G# minor': '1A',
  'F# major': '2B', 'D# minor': '2A',
  'C# major': '3B', 'A# minor': '3A',
  'F major':  '4B', 'D minor':  '4A',
  'Bb major': '5B', 'G minor':  '5A',
  'Eb major': '6B', 'C minor':  '6A',
  'Ab major': '7B', 'F minor':  '7A',
};

// ── BPM DETECTION ─────────────────────────────────────────────────────────
function detectBPMFromPCM(channelData, sampleRate) {
  // Compute RMS energy over 50ms windows
  const windowSize = Math.floor(sampleRate * 0.05);
  const hopSize    = Math.floor(windowSize / 2);
  const energies   = [];

  for (let i = 0; i + windowSize < channelData.length; i += hopSize) {
    let sum = 0;
    for (let j = 0; j < windowSize; j++) sum += channelData[i + j] ** 2;
    energies.push(sum / windowSize);
  }

  // Normalize
  const maxE = Math.max(...energies);
  if (maxE === 0) return null;
  const norm = energies.map(e => e / maxE);

  // Autocorrelation — search BPM range 60–200
  const hopDuration  = hopSize / sampleRate;
  const minPeriodHop = Math.floor(60 / (200 * hopDuration));
  const maxPeriodHop = Math.floor(60 / (60  * hopDuration));

  let bestCorr = -Infinity, bestPeriod = minPeriodHop;

  for (let p = minPeriodHop; p <= maxPeriodHop; p++) {
    let corr = 0;
    const n  = norm.length - p;
    for (let i = 0; i < n; i++) corr += norm[i] * norm[i + p];
    if (corr > bestCorr) { bestCorr = corr; bestPeriod = p; }
  }

  const bpm = 60 / (bestPeriod * hopDuration);

  // Octave correction: prefer 90–180 BPM range
  let result = bpm;
  if (result < 90)  result *= 2;
  if (result > 180) result /= 2;

  return Math.round(Math.max(60, Math.min(200, result)));
}

// ── ENERGY COMPUTATION ───────────────────────────────────────────────────
function computeEnergy(channelData) {
  let sum = 0;
  const step = Math.max(1, Math.floor(channelData.length / 10000)); // sample
  let count = 0;
  for (let i = 0; i < channelData.length; i += step) {
    sum += channelData[i] ** 2;
    count++;
  }
  return Math.min(1, Math.sqrt(sum / count) * 6);
}

// ── DANCEABILITY HEURISTIC ────────────────────────────────────────────────
function estimateDanceability(bpm, energy) {
  if (!bpm) return 0.5;
  // Peak danceability around 120-128 BPM
  const bpmScore    = 1 - Math.abs(bpm - 124) / 64;
  return Math.max(0, Math.min(1, bpmScore * 0.6 + energy * 0.4));
}

// ── MAIN ANALYSIS ─────────────────────────────────────────────────────────
export async function analyzeAudioFile(filepath) {
  // 1. Extract metadata tags
  const meta      = await parseFile(filepath, { duration: true });
  const common    = meta.common;
  const format    = meta.format;

  const taggedBPM = common.bpm     ? Math.round(common.bpm) : null;
  const taggedKey = common.key     ?? null;
  const camelot   = taggedKey ? (KEY_TO_CAMELOT[taggedKey] ?? null) : null;

  // 2. Attempt PCM decode for BPM detection + energy
  let detectedBPM = taggedBPM;
  let energy      = 0.5;
  let valence     = 0.5;

  try {
    const { default: decode } = await import('audio-decode');
    const fileBuffer  = await readFile(filepath);
    const audioBuffer = await decode(fileBuffer);
    const channelData = audioBuffer.getChannelData(0);

    energy = computeEnergy(channelData);

    if (!taggedBPM) {
      detectedBPM = detectBPMFromPCM(channelData, audioBuffer.sampleRate);
    }

    // Very rough valence heuristic from spectral centroid proxy
    // High-frequency energy ratio as brightness proxy → correlates with valence
    const sampleRate = audioBuffer.sampleRate;
    const hiStart    = Math.floor(channelData.length * 0.5); // upper half energy
    let hiEnergy = 0, totalEnergy = 0;
    const step2 = Math.max(1, Math.floor(channelData.length / 5000));
    for (let i = 0; i < channelData.length; i += step2) {
      const sq = channelData[i] ** 2;
      totalEnergy += sq;
      if (i > hiStart) hiEnergy += sq;
    }
    valence = totalEnergy > 0 ? Math.min(1, (hiEnergy / totalEnergy) * 3) : 0.5;

  } catch (err) {
    // audio-decode failed — continue with metadata only
    console.warn(`[audio] PCM decode failed for ${filepath}: ${err.message}`);
  }

  const bpm         = detectedBPM ?? 120;
  const danceability = estimateDanceability(bpm, energy);

  return {
    title:       common.title   || null,
    artist:      common.artist  || null,
    album:       common.album   || null,
    genre:       common.genre?.[0] || null,
    bpm,
    key_note:    taggedKey,
    camelot,
    duration:    format.duration     ?? null,
    energy:      parseFloat(energy.toFixed(3)),
    danceability: parseFloat(danceability.toFixed(3)),
    valence:     parseFloat(valence.toFixed(3)),
  };
}
