import { describe, expect, it } from "vitest";
import { timeline } from "./fixtures";
import {
  speechOnset,
  responseLatency,
  detectLongPauses,
  finalIntonation,
  countFillers,
  prosodyScore,
  f0RangeSemitones,
} from "./prosody";

describe("timing", () => {
  const frames = timeline([
    { ms: 1500, voiced: false },
    { ms: 1000, voiced: true },
    { ms: 2400, voiced: false },
    { ms: 800, voiced: true },
    { ms: 600, voiced: false },
    { ms: 400, voiced: true },
  ]);
  it("finds the speech onset", () => {
    expect(speechOnset(frames)).toBe(1500);
  });
  it("response latency = onset minus end of question", () => {
    expect(responseLatency(frames, 500)).toBe(1000);
    expect(responseLatency(timeline([{ ms: 3000, voiced: false }]), 0)).toBeNull();
  });
  it("counts only pauses longer than 2 s", () => {
    const p = detectLongPauses(frames);
    expect(p).toHaveLength(1);
    expect(p[0].durMs).toBeGreaterThanOrEqual(2000);
  });
});

describe("final intonation (last 500 ms pitch slope)", () => {
  it("rising", () => {
    const f = timeline([{ ms: 1000, voiced: true, f0: (i, n) => 200 + (i / n) * 120 }]);
    expect(finalIntonation(f)).toBe("sube");
  });
  it("falling", () => {
    const f = timeline([{ ms: 1000, voiced: true, f0: (i, n) => 300 - (i / n) * 120 }]);
    expect(finalIntonation(f)).toBe("baja");
  });
  it("flat", () => {
    expect(finalIntonation(timeline([{ ms: 1000, voiced: true, f0: 240 }]))).toBe("plana");
  });
  it("null without pitch", () => {
    expect(finalIntonation(timeline([{ ms: 1000, voiced: false }]))).toBeNull();
  });
});

describe("fillers and hedges", () => {
  it("finds fillers and hedges", () => {
    const r = countFillers("eh, creo que fue al río, mmm no sé");
    expect(r.fillers).toEqual(["eh", "mmm"]);
    expect(r.hedges).toEqual(["creo", "no sé"]);
    expect(r.count).toBe(4);
  });
  it("'este' as a demonstrative is not a filler", () => {
    expect(countFillers("este libro es bonito").count).toBe(0);
    expect(countFillers("este... tal vez sí").fillers).toEqual(["este"]);
  });
});

describe("prosody score 1-4 (approximate)", () => {
  it("fluent, expressive reading scores 4", () => {
    expect(prosodyScore({ pcpm: 90, longPausesPerMin: 0, f0RangeSemitones: 6 })).toBe(4);
  });
  it("slow, choppy, monotone reading scores 1", () => {
    expect(prosodyScore({ pcpm: 25, longPausesPerMin: 5, f0RangeSemitones: 1 })).toBe(1);
  });
  it("is null without audio", () => {
    expect(prosodyScore({ pcpm: 80, longPausesPerMin: null, f0RangeSemitones: null })).toBeNull();
  });
  it("f0 range in semitones", () => {
    const f = timeline([{ ms: 1000, voiced: true, f0: (i, n) => 200 + (i / n) * 200 }]);
    expect(f0RangeSemitones(f) as number).toBeGreaterThan(8);
  });
});
