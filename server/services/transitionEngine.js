// ── CAMELOT COMPATIBILITY ─────────────────────────────────────────────────
// Returns 0-1 score based on harmonic distance on Camelot wheel
function camelotScore(camelotA, camelotB) {
  if (!camelotA || !camelotB) return 0.5; // unknown → neutral

  const numA  = parseInt(camelotA);
  const modeA = camelotA.slice(-1); // A or B
  const numB  = parseInt(camelotB);
  const modeB = camelotB.slice(-1);

  // Same key
  if (camelotA === camelotB) return 1.0;

  // Adjacent on wheel (+1 or -1, same mode) — energetic boost or drop
  const diff = Math.abs(numA - numB);
  const ringDist = Math.min(diff, 12 - diff); // Camelot wheel has 12 positions

  if (modeA === modeB) {
    if (ringDist === 1) return 0.9;  // adjacent, same mode — very compatible
    if (ringDist === 2) return 0.65;
    if (ringDist === 3) return 0.45;
    return Math.max(0.1, 0.45 - ringDist * 0.05);
  } else {
    // Relative major/minor (same number, different mode) — good
    if (ringDist === 0) return 0.85;
    if (ringDist === 1) return 0.6;
    return Math.max(0.1, 0.5 - ringDist * 0.06);
  }
}

// ── BPM COMPATIBILITY ─────────────────────────────────────────────────────
function bpmScore(bpmA, bpmB) {
  if (!bpmA || !bpmB) return 0.5;

  // Check at 1x, 2x and 0.5x (octave relationships)
  const ratios  = [bpmB / bpmA, (bpmB * 2) / bpmA, bpmB / (bpmA * 2)];
  const closest = ratios.reduce((best, r) => Math.abs(r - 1) < Math.abs(best - 1) ? r : best, ratios[0]);
  const pctDiff = Math.abs(closest - 1);

  if (pctDiff < 0.01) return 1.0;   // < 1% difference
  if (pctDiff < 0.03) return 0.92;
  if (pctDiff < 0.06) return 0.80;
  if (pctDiff < 0.10) return 0.65;
  if (pctDiff < 0.15) return 0.50;
  if (pctDiff < 0.25) return 0.35;
  return 0.15;
}

// ── ENERGY COMPATIBILITY ──────────────────────────────────────────────────
function energyScore(energyA, energyB) {
  if (energyA == null || energyB == null) return 0.5;
  const diff = Math.abs(energyA - energyB);
  // Prefer smooth energy transitions (small delta), penalise extreme jumps
  return Math.max(0, 1 - diff * 1.5);
}

// ── OVERALL COMPATIBILITY SCORE ───────────────────────────────────────────
export function compatibilityScore(trackA, trackB) {
  const harmonic = camelotScore(trackA.camelot, trackB.camelot);
  const tempo    = bpmScore(trackA.bpm, trackB.bpm);
  const feel     = energyScore(trackA.energy, trackB.energy);

  // Weighted: harmonic most important for DJ, then tempo, then energy
  const score = harmonic * 0.45 + tempo * 0.35 + feel * 0.20;

  return {
    score:    parseFloat(score.toFixed(3)),
    harmonic: parseFloat(harmonic.toFixed(3)),
    tempo:    parseFloat(tempo.toFixed(3)),
    energy:   parseFloat(feel.toFixed(3)),
  };
}

// ── CROSSFADE DURATION ────────────────────────────────────────────────────
// Returns recommended crossfade duration in milliseconds
export function recommendedCrossfade(trackA, trackB) {
  const { score } = compatibilityScore(trackA, trackB);

  // Higher compatibility → longer crossfade (smoother blend)
  // Low compatibility  → shorter cut (less ear-hurting overlap)
  if (score > 0.85) return 8000;   // 8s — very compatible, long mix
  if (score > 0.70) return 5000;   // 5s — good mix
  if (score > 0.55) return 3000;   // 3s — decent
  if (score > 0.40) return 1500;   // 1.5s — quick crossfade
  return 800;                       // 0.8s — near-cut
}

// ── TRANSITION POINT ─────────────────────────────────────────────────────
// Returns seconds before end of trackA to start crossfade
export function transitionPoint(trackA, crossfadeMs) {
  if (!trackA.duration) return 15;
  // Start crossfade a bit before end to allow time for the blend
  const crossfadeSec = crossfadeMs / 1000;
  return Math.min(trackA.duration * 0.15, crossfadeSec + 2);
}

// ── SUGGEST NEXT TRACK ────────────────────────────────────────────────────
// Given current track + candidate list, return ranked suggestions
export function suggestNextTrack(currentTrack, candidates) {
  if (!candidates.length) return [];

  const scored = candidates
    .filter(t => t.id !== currentTrack.id)
    .map(t => {
      const compat = compatibilityScore(currentTrack, t);
      const crossfade = recommendedCrossfade(currentTrack, t);
      return {
        track: t,
        ...compat,
        crossfade_ms: crossfade,
        transition_at: transitionPoint(currentTrack, crossfade),
      };
    })
    .sort((a, b) => b.score - a.score);

  return scored;
}
