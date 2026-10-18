// Offline version of the live analyzer: turns a decoded clip into the same
// FrameFeature timeline (RMS, VAD, F0, clipping). Derived numbers only.
import type { FrameFeature } from "../types";
import { clippingRatio, createVad, detectPitch, rms, vadStep } from "../dsp";

export function framesFromSamples(samples: Float32Array, rate: number, frameSize = 1024): FrameFeature[] {
  const frames: FrameFeature[] = [];
  let vad = createVad();
  for (let start = 0; start + frameSize <= samples.length; start += frameSize) {
    const frame = samples.subarray(start, start + frameSize);
    const level = rms(frame);
    const step = vadStep(vad, level);
    vad = step.state;
    frames.push({
      t: (start / rate) * 1000,
      rms: level,
      voiced: step.voiced,
      f0: step.voiced ? detectPitch(frame, rate) : null,
      clip: clippingRatio(frame),
    });
  }
  return frames;
}
