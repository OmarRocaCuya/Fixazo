// Synthetic frame timelines for tests. 20 ms frames.
import type { FrameFeature } from "../types";

export const FRAME_MS = 20;

export interface Segment {
  ms: number;
  voiced: boolean;
  rms?: number;
  f0?: number | null | ((i: number, n: number) => number | null);
  clip?: number;
}

export function timeline(segments: Segment[], startMs = 0): FrameFeature[] {
  const out: FrameFeature[] = [];
  let t = startMs;
  for (const s of segments) {
    const n = Math.round(s.ms / FRAME_MS);
    for (let i = 0; i < n; i++) {
      const f0 = typeof s.f0 === "function" ? s.f0(i, n) : s.f0 ?? (s.voiced ? 250 : null);
      // Syllable-like nucleus: the third frame of each voiced segment is louder.
      const base = s.rms ?? (s.voiced ? 0.08 : 0.003);
      const rms = s.voiced ? base * (i === 2 ? 1.6 : 0.8) : base;
      out.push({ t, rms, voiced: s.voiced, f0: s.voiced ? f0 : null, clip: s.clip ?? 0 });
      t += FRAME_MS;
    }
  }
  return out;
}
