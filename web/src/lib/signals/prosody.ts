// Layer 2 · "Cómo lo dice": timing, pauses, fillers, final intonation and an
// approximate prosody score. Pure functions over frame timelines and text.
// These signals describe the process; they never enter a rubric level.
import type { FrameFeature } from "../types";
import { hzToSemitones, linearSlope } from "../dsp";

export function frameDuration(frames: FrameFeature[]): number {
  return frames.length > 1 ? frames[1].t - frames[0].t : 20;
}

/** Time of the first run of `minRun` voiced frames, or null. */
export function speechOnset(frames: FrameFeature[], minRun = 3): number | null {
  for (let i = 0; i + minRun <= frames.length; i++) {
    let ok = true;
    for (let k = 0; k < minRun; k++) if (!frames[i + k].voiced) { ok = false; break; }
    if (ok) return frames[i].t;
  }
  return null;
}

/** Question end → speech onset, in ms. Null if the child did not speak. */
export function responseLatency(frames: FrameFeature[], questionEndMs: number): number | null {
  const onset = speechOnset(frames);
  if (onset === null) return null;
  return Math.max(0, onset - questionEndMs);
}

export interface Pause {
  startMs: number;
  durMs: number;
}

/** Silent gaps longer than `minMs` between the first and last voiced frame. */
export function detectLongPauses(frames: FrameFeature[], minMs = 2000): Pause[] {
  const first = frames.findIndex((f) => f.voiced);
  let last = -1;
  for (let i = frames.length - 1; i >= 0; i--) if (frames[i].voiced) { last = i; break; }
  if (first < 0 || last <= first) return [];
  const pauses: Pause[] = [];
  let start: number | null = null;
  for (let i = first; i <= last; i++) {
    if (!frames[i].voiced) {
      if (start === null) start = frames[i].t;
    } else if (start !== null) {
      const durMs = frames[i].t - start;
      if (durMs >= minMs) pauses.push({ startMs: start, durMs });
      start = null;
    }
  }
  return pauses;
}

/** Pitch slope over the last `windowMs` of voiced speech. */
export function finalIntonation(frames: FrameFeature[], windowMs = 500): "sube" | "baja" | "plana" | null {
  const pitched = frames.filter((f) => f.voiced && f.f0 !== null);
  if (pitched.length < 5) return null;
  const end = pitched[pitched.length - 1].t;
  const win = pitched.filter((f) => f.t >= end - windowMs);
  if (win.length < 5) return null;
  const ref = win[0].f0 as number;
  const xs = win.map((f) => (f.t - win[0].t) / 1000);
  const ys = win.map((f) => hzToSemitones(f.f0 as number, ref));
  const change = linearSlope(xs, ys) * (windowMs / 1000);
  if (change > 1) return "sube";
  if (change < -1) return "baja";
  return "plana";
}

/** 10th–90th percentile F0 range in semitones. */
export function f0RangeSemitones(frames: FrameFeature[]): number | null {
  const f0s = frames.filter((f) => f.voiced && f.f0 !== null).map((f) => f.f0 as number).sort((a, b) => a - b);
  if (f0s.length < 5) return null;
  const p10 = f0s[Math.floor(f0s.length * 0.1)];
  const p90 = f0s[Math.min(f0s.length - 1, Math.floor(f0s.length * 0.9))];
  return hzToSemitones(p90, p10);
}

// ---------------------------------------------------------------------------
// Fillers and hedges
// ---------------------------------------------------------------------------

const FILLER_PATTERNS: Array<[RegExp, string]> = [
  [/(^|[^a-záéíóúñ])(e+h+)(?![a-záéíóúñ])/g, "eh"],
  [/(^|[^a-záéíóúñ])(e+m+)(?![a-záéíóúñ])/g, "em"],
  [/(^|[^a-záéíóúñ])(m{2,})(?![a-záéíóúñ])/g, "mmm"],
  // "este" only as a filler: followed by "...", "…", ",", end of text, or another filler.
  [/(^|[^a-záéíóúñ])(este)(?=\s*(\.\.\.|…|,|$|\s+(eh|em|mmm|este)\b))/g, "este"],
];

const HEDGE_PATTERNS: Array<[RegExp, string]> = [
  [/(^|[^a-záéíóúñ])(creo)(?![a-záéíóúñ])/g, "creo"],
  [/(^|[^a-záéíóúñ])(no s[eé])(?![a-záéíóúñ])/g, "no sé"],
  [/(^|[^a-záéíóúñ])(tal vez)(?![a-záéíóúñ])/g, "tal vez"],
  [/(^|[^a-záéíóúñ])(parece)(?![a-záéíóúñ])/g, "parece"],
  [/(^|[^a-záéíóúñ])(quiz[aá]s?)(?![a-záéíóúñ])/g, "quizás"],
  [/(^|[^a-záéíóúñ])(a lo mejor)(?![a-záéíóúñ])/g, "a lo mejor"],
];

function scan(text: string, patterns: Array<[RegExp, string]>): string[] {
  const hits: Array<{ at: number; label: string }> = [];
  for (const [re, label] of patterns) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      hits.push({ at: m.index + m[1].length, label });
      if (m[0].length === 0) re.lastIndex++;
    }
  }
  return hits.sort((a, b) => a.at - b.at).map((h) => h.label);
}

export function countFillers(text: string): { fillers: string[]; hedges: string[]; count: number } {
  const t = text.toLowerCase();
  const fillers = scan(t, FILLER_PATTERNS);
  const hedges = scan(t, HEDGE_PATTERNS);
  return { fillers, hedges, count: fillers.length + hedges.length };
}

// ---------------------------------------------------------------------------
// Prosody score (approximate; inspired by the NAEP 1–4 scale, NOT validated)
// ---------------------------------------------------------------------------

export interface ProsodyInput {
  pcpm: number | null;
  longPausesPerMin: number | null;
  f0RangeSemitones: number | null;
}

/**
 * Heuristic 1–4: +1 for reading pace (≥ 60 PCPM), +1 for few long pauses
 * (≤ 1 per minute), +1 for pitch variation (≥ 4 semitones, not monotone).
 * Requires audio; returns null in simulation.
 */
export function prosodyScore({ pcpm, longPausesPerMin, f0RangeSemitones: range }: ProsodyInput): number | null {
  if (longPausesPerMin === null || range === null) return null;
  let score = 1;
  if (pcpm !== null && pcpm >= 60) score++;
  if (longPausesPerMin <= 1) score++;
  if (range >= 4) score++;
  return score;
}
