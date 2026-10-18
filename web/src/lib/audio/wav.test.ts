import { describe, expect, it } from "vitest";
import { capSeconds, encodeWav16, mixToMono, resampleTo16k } from "./wav";
import { detectPitch } from "../dsp";
import { validateIndigenousWav } from "../server/indigenous-proxy";

function sine(freq: number, seconds: number, rate: number, amp = 0.4) {
  const out = new Float32Array(Math.round(seconds * rate));
  for (let i = 0; i < out.length; i++) out[i] = amp * Math.sin((2 * Math.PI * freq * i) / rate);
  return out;
}

describe("in-memory WAV encoder (PCM16 mono 16 kHz)", () => {
  it("writes a canonical RIFF header and clamped little-endian samples", () => {
    const bytes = encodeWav16(Float32Array.of(0, 0.5, -0.5, 1.2, -1.2));
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const tag = (o: number) => String.fromCharCode(...bytes.subarray(o, o + 4));
    expect([tag(0), tag(8), tag(12), tag(36)]).toEqual(["RIFF", "WAVE", "fmt ", "data"]);
    expect(bytes.byteLength).toBe(44 + 10);
    expect(view.getUint32(4, true)).toBe(bytes.byteLength - 8);
    expect([view.getUint16(20, true), view.getUint16(22, true), view.getUint32(24, true), view.getUint32(28, true), view.getUint16(32, true), view.getUint16(34, true)]).toEqual([1, 1, 16000, 32000, 2, 16]);
    expect(view.getUint32(40, true)).toBe(10);
    expect([0, 1, 2, 3, 4].map((i) => view.getInt16(44 + i * 2, true))).toEqual([0, 16384, -16384, 32767, -32768]);
  });
  it("is accepted by the server-side WAV validator", () => {
    expect(validateIndigenousWav(encodeWav16(sine(220, 1, 16000)))).toBeCloseTo(1, 5);
  });
  it("encodes NaN as silence instead of failing", () => {
    const bytes = encodeWav16(Float32Array.of(Number.NaN));
    expect(new DataView(bytes.buffer).getInt16(44, true)).toBe(0);
  });
});

describe("resampling and limits", () => {
  it.each([48000, 44100])("resamples %d Hz to 16 kHz preserving pitch", (rate) => {
    const out = resampleTo16k(sine(220, 1, rate), rate);
    expect(out.length).toBe(16000);
    const f0 = detectPitch(out.subarray(4000, 6048), 16000) as number;
    expect(Math.abs(f0 - 220)).toBeLessThan(5);
  });
  it("keeps 16 kHz audio unchanged (as a copy)", () => {
    const input = sine(220, 0.1, 16000);
    const out = resampleTo16k(input, 16000);
    expect(out).toEqual(input);
    expect(out).not.toBe(input);
  });
  it("caps the clip to the maximum duration", () => {
    expect(capSeconds(new Float32Array(20 * 16000), 16000, 15).length).toBe(15 * 16000);
    expect(capSeconds(new Float32Array(100), 16000, 15).length).toBe(100);
  });
  it("mixes channels to mono", () => {
    expect(Array.from(mixToMono([Float32Array.of(1, 0), Float32Array.of(0, 1)]))).toEqual([0.5, 0.5]);
  });
});
