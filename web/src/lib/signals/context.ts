// Layer 4 · "Contexto": recording conditions. Decides when a measurement is
// "NO observable" (which is never the same as a 0).
import type { FrameFeature } from "../types";
import { mean, toDb } from "../dsp";
import { speechOnset } from "./prosody";

/** dBFS of the mean RMS of unvoiced frames before the first speech onset. */
export function noiseFloorDb(frames: FrameFeature[]): number | null {
  const onset = speechOnset(frames);
  let pre = frames.filter((f) => !f.voiced && (onset === null || f.t < onset));
  if (pre.length === 0) pre = frames.filter((f) => !f.voiced);
  const m = mean(pre.map((f) => f.rms));
  return m === null ? null : toDb(m);
}

export function speechLevelDb(frames: FrameFeature[]): number | null {
  const m = mean(frames.filter((f) => f.voiced).map((f) => f.rms));
  return m === null ? null : toDb(m);
}

export function snrDb(frames: FrameFeature[]): number | null {
  const s = speechLevelDb(frames);
  const n = noiseFloorDb(frames);
  return s === null || n === null ? null : s - n;
}

export function meanClipping(frames: FrameFeature[]): number {
  return mean(frames.map((f) => f.clip)) ?? 0;
}

export interface ContextAssessment {
  noise: "ok" | "alto";
  observable: boolean;
}

export function assessContext({
  noiseFloorDb: noise,
  snrDb: snr,
  speechDetected,
  clippingRatio = 0,
}: {
  noiseFloorDb: number | null;
  snrDb: number | null;
  speechDetected: boolean;
  clippingRatio?: number;
}): ContextAssessment {
  const loud = (noise !== null && noise > -35) || (snr !== null && snr < 10);
  // Conservative recording-quality threshold, not a judgment about the child.
  const observable = speechDetected && !loud && Number.isFinite(clippingRatio) && clippingRatio < 0.01;
  return { noise: loud ? "alto" : "ok", observable };
}
