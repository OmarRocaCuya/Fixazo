// Layer 3 · "Estado / ritmo": compares each turn with the child's own baseline.
// Used ONLY live, to offer a short break. It is never persisted, never shown as
// an emotion and never enters a level (see guardrails.ts).
import type { FrameFeature } from "../types";
import { countEnergyPeaks, mean } from "../dsp";
import { frameDuration, speechOnset } from "./prosody";

export const PACE_LABELS = ["ok", "acelerado", "cansado"] as const;
export type Pace = (typeof PACE_LABELS)[number];

export const PAUSE_OFFER = "¿Hacemos una pausa de un minuto?";

export interface PaceFeatures {
  voicedRatio: number;
  /** Syllable-like energy peaks per second (speech-rate proxy). */
  peaksPerSec: number;
  meanF0: number | null;
  meanRms: number | null;
  durationSec: number;
}

export function paceFeatures(frames: FrameFeature[]): PaceFeatures {
  if (frames.length === 0) return { voicedRatio: 0, peaksPerSec: 0, meanF0: null, meanRms: null, durationSec: 0 };
  const dur = frameDuration(frames);
  const durationSec = (frames[frames.length - 1].t - frames[0].t + dur) / 1000;
  const voiced = frames.filter((f) => f.voiced);
  const peaks = countEnergyPeaks(frames.map((f) => f.rms), { frameMs: dur });
  return {
    voicedRatio: voiced.length / frames.length,
    peaksPerSec: durationSec > 0 ? peaks / durationSec : 0,
    meanF0: mean(voiced.filter((f) => f.f0 !== null).map((f) => f.f0 as number)),
    meanRms: mean(voiced.map((f) => f.rms)),
    durationSec,
  };
}

/** Baseline from the first `windowMs` after the first speech onset. Needs ≥ 5 s of voiced speech. */
export function computeBaseline(frames: FrameFeature[], windowMs = 30000, minSpeechMs = 5000): PaceFeatures | null {
  const onset = speechOnset(frames);
  if (onset === null) return null;
  const win = frames.filter((f) => f.t >= onset && f.t < onset + windowMs);
  const voicedMs = win.filter((f) => f.voiced).length * frameDuration(frames);
  if (voicedMs < minSpeechMs) return null;
  return paceFeatures(win);
}

/**
 * acelerado: rate ≥ +35 % and mean F0 ≥ +15 % vs. baseline.
 * cansado: rate ≤ −30 % and the last answer shorter than the previous one.
 */
export function classifyPace(baseline: PaceFeatures | null, turn: PaceFeatures | null, answerLengths: number[]): Pace {
  if (!baseline || !turn || baseline.peaksPerSec <= 0 || turn.durationSec < 1) return "ok";
  const rate = turn.peaksPerSec / baseline.peaksPerSec;
  const f0 = baseline.meanF0 && turn.meanF0 ? turn.meanF0 / baseline.meanF0 : 1;
  if (rate >= 1.35 && f0 >= 1.15) return "acelerado";
  const n = answerLengths.length;
  const falling = n >= 2 && answerLengths[n - 1] < answerLengths[n - 2];
  if (rate <= 0.7 && falling) return "cansado";
  return "ok";
}

export function shouldOfferBreak(pace: Pace): boolean {
  return pace !== "ok";
}
