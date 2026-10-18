import { describe, expect, it } from "vitest";
import { timeline } from "./fixtures";
import { summarizeTurnAudio } from "./summary";

describe("per-turn audio summary", () => {
  it("combines timing, pitch and context features", () => {
    const frames = timeline([
      { ms: 1000, voiced: false, rms: 0.002 },
      { ms: 1500, voiced: true, f0: 260 },
      { ms: 2200, voiced: false, rms: 0.002 },
      { ms: 1000, voiced: true, f0: (i, n) => 260 - (i / n) * 80 },
    ]);
    const s = summarizeTurnAudio(frames, { questionEndMs: 200, childBaselineF0: 260 });
    expect(s.speechDetected).toBe(true);
    expect(s.latencyMs).toBe(800);
    expect(s.longPauses).toBe(1);
    expect(s.finalIntonation).toBe("baja");
    expect(s.snrDb as number).toBeGreaterThan(20);
    expect(s.possibleAdultHelp).toBe(false);
    expect(s.speechMs).toBe(2500);
  });
  it("no speech → not detected, nulls instead of zeros", () => {
    const s = summarizeTurnAudio(timeline([{ ms: 3000, voiced: false }]), { questionEndMs: 0, childBaselineF0: null });
    expect(s.speechDetected).toBe(false);
    expect(s.latencyMs).toBeNull();
    expect(s.meanF0).toBeNull();
  });
  it("never infers an adult or dictation from a change in pitch", () => {
    const s = summarizeTurnAudio(timeline([{ ms: 1000, voiced: true, f0: 280 }, { ms: 1000, voiced: true, f0: 140 }]), { questionEndMs: 0, childBaselineF0: 280 });
    expect(s.possibleAdultHelp).toBe(false);
  });
  it("keeps only derived numbers (no frames)", () => {
    const s = summarizeTurnAudio(timeline([{ ms: 1000, voiced: true }]), { questionEndMs: 0, childBaselineF0: null });
    for (const v of Object.values(s)) expect(Array.isArray(v)).toBe(false);
  });
});
