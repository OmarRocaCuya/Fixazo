import { describe, expect, it } from "vitest";
import {
  rms,
  toDb,
  clippingRatio,
  createVad,
  vadStep,
  runVad,
  detectPitch,
  countEnergyPeaks,
  linearSlope,
  hzToSemitones,
} from "./dsp";

const SR = 16000;

function sine(freq: number, n: number, amp = 0.5, sr = SR): Float32Array {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = amp * Math.sin((2 * Math.PI * freq * i) / sr);
  return out;
}

function noise(n: number, amp = 0.3, seed = 7): Float32Array {
  // Deterministic LCG noise.
  let s = seed;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    s = (s * 1664525 + 1013904223) % 4294967296;
    out[i] = amp * ((s / 4294967296) * 2 - 1);
  }
  return out;
}

describe("rms / toDb / clipping", () => {
  it("rms of a sine is amp/sqrt(2)", () => {
    expect(rms(sine(220, 1600, 0.5))).toBeCloseTo(0.5 / Math.SQRT2, 2);
  });
  it("rms of silence is 0 and toDb clamps to a floor", () => {
    expect(rms(new Float32Array(512))).toBe(0);
    expect(toDb(0)).toBe(-120);
    expect(toDb(1)).toBeCloseTo(0, 5);
    expect(toDb(0.1)).toBeCloseTo(-20, 5);
  });
  it("counts clipped samples", () => {
    const f = new Float32Array([0, 1, -1, 0.5, 0.995, 0]);
    expect(clippingRatio(f)).toBeCloseTo(3 / 6, 5);
  });
});

describe("adaptive energy VAD", () => {
  it("marks quiet frames unvoiced and loud frames voiced", () => {
    const levels = [...Array(20).fill(0.002), ...Array(10).fill(0.1), ...Array(10).fill(0.002)];
    const voiced = runVad(levels);
    expect(voiced.slice(0, 20).every((v) => !v)).toBe(true);
    expect(voiced.slice(20, 30).every((v) => v)).toBe(true);
    expect(voiced.slice(32).every((v) => !v)).toBe(true);
  });
  it("adapts its noise floor upward in a noisy room", () => {
    let st = createVad();
    for (let i = 0; i < 300; i++) st = vadStep(st, 0.03).state;
    expect(st.noiseFloor).toBeGreaterThan(0.02);
    // A frame at the same level as the noise is not speech.
    expect(vadStep(st, 0.03).voiced).toBe(false);
    // A clearly louder frame is speech.
    expect(vadStep(st, 0.3).voiced).toBe(true);
  });
});

describe("YIN pitch detection", () => {
  it.each([120, 220, 300, 440])("detects a %d Hz sine within 3%%", (f) => {
    const p = detectPitch(sine(f, 2048), SR);
    expect(p).not.toBeNull();
    expect(Math.abs((p as number) - f) / f).toBeLessThan(0.03);
  });
  it("works at 44.1 kHz", () => {
    const p = detectPitch(sine(250, 4096, 0.5, 44100), 44100);
    expect(Math.abs((p as number) - 250)).toBeLessThan(7);
  });
  it("returns null for white noise and silence", () => {
    expect(detectPitch(noise(2048), SR)).toBeNull();
    expect(detectPitch(new Float32Array(2048), SR)).toBeNull();
  });
  it("ignores frequencies below 60 Hz", () => {
    expect(detectPitch(sine(40, 2048), SR)).toBeNull();
  });
});

describe("helpers", () => {
  it("counts syllable-like energy peaks", () => {
    // 4 bumps separated by valleys, frames of 20 ms.
    const env: number[] = [];
    for (let k = 0; k < 4; k++) env.push(0.01, 0.05, 0.12, 0.05, 0.01, 0.01, 0.01);
    expect(countEnergyPeaks(env, { frameMs: 20 })).toBe(4);
  });
  it("linear slope of a ramp", () => {
    expect(linearSlope([0, 1, 2, 3], [1, 3, 5, 7])).toBeCloseTo(2, 6);
    expect(linearSlope([1], [1])).toBe(0);
  });
  it("semitone conversion", () => {
    expect(hzToSemitones(440, 220)).toBeCloseTo(12, 6);
  });
});
