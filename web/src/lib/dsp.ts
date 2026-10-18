// Pure DSP helpers that run on Float32Array frames inside the browser.
// Nothing here stores audio: callers pass a frame, get numbers back, and drop the frame.

export const PITCH_MIN_HZ = 60;
export const PITCH_MAX_HZ = 600;

/** Root mean square of a frame. */
export function rms(frame: Float32Array): number {
  if (frame.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i];
  return Math.sqrt(sum / frame.length);
}

/** Linear amplitude to dBFS, clamped to -120 dB. */
export function toDb(value: number): number {
  if (value <= 1e-6) return -120;
  return Math.max(-120, 20 * Math.log10(value));
}

/** Share of samples at (or almost at) full scale. */
export function clippingRatio(frame: Float32Array, limit = 0.99): number {
  if (frame.length === 0) return 0;
  let n = 0;
  for (let i = 0; i < frame.length; i++) if (Math.abs(frame[i]) >= limit) n++;
  return n / frame.length;
}

// ---------------------------------------------------------------------------
// Adaptive energy VAD
// ---------------------------------------------------------------------------

export interface VadState {
  noiseFloor: number;
  hangover: number;
}

export interface VadOptions {
  /** Speech must be this many times louder than the noise floor. */
  ratio: number;
  /** Absolute minimum RMS for speech. */
  minLevel: number;
  /** Frames to keep "voiced" after energy drops (smooths word gaps). */
  hangoverFrames: number;
}

export const DEFAULT_VAD: VadOptions = { ratio: 3, minLevel: 0.006, hangoverFrames: 2 };

export function createVad(initialNoise = 0.005): VadState {
  return { noiseFloor: initialNoise, hangover: 0 };
}

/**
 * One VAD step. The noise floor falls fast toward quieter frames, rises quickly
 * while unvoiced and only very slowly while voiced, so a constant noisy room is
 * eventually learned but a long utterance is not swallowed.
 */
export function vadStep(
  state: VadState,
  level: number,
  opts: VadOptions = DEFAULT_VAD,
): { state: VadState; voiced: boolean } {
  const threshold = Math.max(state.noiseFloor * opts.ratio, opts.minLevel);
  const loud = level > threshold;
  let hangover = state.hangover;
  let voiced: boolean;
  if (loud) {
    voiced = true;
    hangover = opts.hangoverFrames;
  } else if (hangover > 0) {
    voiced = true;
    hangover -= 1;
  } else {
    voiced = false;
  }

  let nf = state.noiseFloor;
  if (level < nf) nf = nf + (level - nf) * 0.3;
  else nf = nf + (level - nf) * (loud ? 0.005 : 0.05);

  return { state: { noiseFloor: Math.max(nf, 1e-5), hangover }, voiced };
}

/** Run the VAD over a sequence of RMS levels. */
export function runVad(levels: number[], opts: VadOptions = DEFAULT_VAD): boolean[] {
  let st = createVad();
  return levels.map((l) => {
    const r = vadStep(st, l, opts);
    st = r.state;
    return r.voiced;
  });
}

// ---------------------------------------------------------------------------
// YIN pitch (de Cheveigné & Kawahara 2002), 60–600 Hz
// ---------------------------------------------------------------------------

export function detectPitch(
  frame: Float32Array,
  sampleRate: number,
  minHz = PITCH_MIN_HZ,
  maxHz = PITCH_MAX_HZ,
  threshold = 0.15,
): number | null {
  const n = frame.length;
  if (n < 64 || rms(frame) < 1e-4) return null;
  const tauMin = Math.max(2, Math.floor(sampleRate / maxHz));
  const tauMax = Math.min(Math.floor(sampleRate / minHz), Math.floor(n / 2));
  if (tauMax <= tauMin + 1) return null;
  const w = n - tauMax;

  const d = new Float32Array(tauMax + 1);
  for (let tau = 1; tau <= tauMax; tau++) {
    let sum = 0;
    for (let j = 0; j < w; j++) {
      const diff = frame[j] - frame[j + tau];
      sum += diff * diff;
    }
    d[tau] = sum;
  }

  // Cumulative mean normalized difference.
  const cmnd = new Float32Array(tauMax + 1);
  cmnd[0] = 1;
  let running = 0;
  for (let tau = 1; tau <= tauMax; tau++) {
    running += d[tau];
    cmnd[tau] = running > 0 ? (d[tau] * tau) / running : 1;
  }

  let tauEst = -1;
  for (let tau = tauMin; tau <= tauMax; tau++) {
    if (cmnd[tau] < threshold) {
      while (tau + 1 <= tauMax && cmnd[tau + 1] < cmnd[tau]) tau++;
      tauEst = tau;
      break;
    }
  }
  if (tauEst < 0) return null;

  // Parabolic interpolation around the minimum.
  let better = tauEst;
  if (tauEst > 1 && tauEst < tauMax) {
    const s0 = cmnd[tauEst - 1];
    const s1 = cmnd[tauEst];
    const s2 = cmnd[tauEst + 1];
    const denom = 2 * (2 * s1 - s2 - s0);
    if (denom !== 0) better = tauEst + (s2 - s0) / denom;
  }
  const f0 = sampleRate / better;
  if (f0 < minHz || f0 > maxHz) return null;
  return f0;
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

/**
 * Counts syllable-like nuclei: local maxima of the RMS envelope above a
 * relative threshold and at least `minDistanceMs` apart.
 */
export function countEnergyPeaks(
  envelope: number[],
  { frameMs, minDistanceMs = 100, relThreshold = 0.25 }: { frameMs: number; minDistanceMs?: number; relThreshold?: number },
): number {
  if (envelope.length < 3) return 0;
  const max = Math.max(...envelope);
  if (max <= 0) return 0;
  const thr = max * relThreshold;
  const minDist = Math.max(1, Math.round(minDistanceMs / frameMs));
  let count = 0;
  let last = -Infinity;
  for (let i = 1; i < envelope.length - 1; i++) {
    const v = envelope[i];
    if (v > thr && v > envelope[i - 1] && v >= envelope[i + 1] && i - last >= minDist) {
      count++;
      last = i;
    }
  }
  return count;
}

/** Least-squares slope of ys over xs. */
export function linearSlope(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return 0;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) {
    sx += xs[i];
    sy += ys[i];
    sxx += xs[i] * xs[i];
    sxy += xs[i] * ys[i];
  }
  const den = n * sxx - sx * sx;
  return den === 0 ? 0 : (n * sxy - sx * sy) / den;
}

export function hzToSemitones(f: number, ref: number): number {
  return 12 * Math.log2(f / ref);
}

export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}
