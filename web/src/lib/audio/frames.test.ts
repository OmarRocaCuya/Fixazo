import { describe, expect, it } from "vitest";
import { framesFromSamples } from "./frames";

describe("offline frame features (for uploaded test audio)", () => {
  it("detects silence then a voiced 220 Hz tone with timestamps", () => {
    const rate = 16000;
    const samples = new Float32Array(rate * 2);
    for (let i = rate / 2; i < samples.length; i++) samples[i] = 0.3 * Math.sin((2 * Math.PI * 220 * i) / rate);
    const frames = framesFromSamples(samples, rate);
    expect(frames.length).toBeGreaterThan(20);
    const firstVoiced = frames.find((f) => f.voiced)!;
    expect(firstVoiced.t).toBeGreaterThanOrEqual(400);
    expect(firstVoiced.t).toBeLessThanOrEqual(600);
    const pitched = frames.filter((f) => f.f0 !== null).map((f) => f.f0 as number);
    expect(pitched.length).toBeGreaterThan(10);
    expect(Math.abs(pitched[Math.floor(pitched.length / 2)] - 220)).toBeLessThan(6);
  });
  it("returns only derived numbers per frame", () => {
    const frames = framesFromSamples(new Float32Array(16000), 16000);
    for (const f of frames) expect(Object.keys(f).sort()).toEqual(["clip", "f0", "rms", "t", "voiced"]);
  });
});
