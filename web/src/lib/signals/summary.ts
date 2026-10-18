// Collapses a turn's frame timeline into a few derived numbers. Frames are
// dropped after this; only the summary may reach the report.
import type { FrameFeature, TurnAudioSummary } from "../types";
import { mean } from "../dsp";
import { detectLongPauses, f0RangeSemitones, finalIntonation, frameDuration, responseLatency, speechOnset } from "./prosody";
import { meanClipping, noiseFloorDb, snrDb } from "./context";

export function summarizeTurnAudio(
  frames: FrameFeature[],
  { questionEndMs }: { questionEndMs: number; childBaselineF0?: number | null },
): TurnAudioSummary {
  const speechDetected = speechOnset(frames) !== null;
  const voiced = frames.filter((f) => f.voiced);
  return {
    latencyMs: responseLatency(frames, questionEndMs),
    longPauses: detectLongPauses(frames).length,
    finalIntonation: finalIntonation(frames),
    meanF0: speechDetected ? mean(voiced.filter((f) => f.f0 !== null).map((f) => f.f0 as number)) : null,
    f0RangeSemitones: f0RangeSemitones(frames),
    noiseFloorDb: noiseFloorDb(frames),
    snrDb: speechDetected ? snrDb(frames) : null,
    clippingRatio: meanClipping(frames),
    speechDetected,
    // Pitch cannot establish age, speaker identity, dictation or adult help.
    possibleAdultHelp: false,
    speechMs: voiced.length * frameDuration(frames),
  };
}
