import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AudioAnalyzer } from "./audio";

let callback: ((event: AudioProcessingEvent) => void) | null;
let stopTrack: ReturnType<typeof vi.fn>;
let closeContext: ReturnType<typeof vi.fn>;
let analyzer: AudioAnalyzer;
let node: { onaudioprocess: ((event: AudioProcessingEvent) => void) | null; connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> };

function frame(samples: Float32Array) {
  callback = node.onaudioprocess;
  callback?.({ inputBuffer: { getChannelData: () => samples } } as unknown as AudioProcessingEvent);
}

beforeEach(() => {
  node = { onaudioprocess: null, connect: vi.fn(), disconnect: vi.fn() };
  stopTrack = vi.fn();
  closeContext = vi.fn().mockResolvedValue(undefined);
  class Context {
    sampleRate = 48_000;
    state = "running";
    destination = {};
    createMediaStreamSource() { return { connect: vi.fn(), disconnect: vi.fn() }; }
    createScriptProcessor() { return node; }
    createGain() { return { gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() }; }
    close = closeContext;
  }
  vi.stubGlobal("window", { AudioContext: Context });
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] }) } });
  analyzer = new AudioAnalyzer();
});

afterEach(() => { analyzer.stop(); vi.unstubAllGlobals(); });

describe("authorized in-memory Web Audio turn capture", () => {
  it("does not hold raw microphone audio until capture is explicitly armed", async () => {
    await analyzer.start();
    const source = Float32Array.from({ length: 2048 }, (_, i) => 0.2 * Math.sin(i));
    frame(source);
    expect(analyzer.takeCapture()).toBeNull();
    expect(source.some((value) => value !== 0)).toBe(true); // never changes the browser-owned input
    analyzer.startCapture(1);
    frame(source);
    const clip = analyzer.takeCapture()!;
    expect(clip.rate).toBe(48_000);
    expect(clip.samples).toEqual(source);
    expect(analyzer.takeCapture()).toBeNull(); // ownership handed off exactly once
    clip.samples.fill(0);
  });

  it("caps capture duration, preserves the actual signal and wipes discarded samples", async () => {
    await analyzer.start();
    analyzer.startCapture(1);
    const source = new Float32Array(2048).fill(0.2);
    for (let i = 0; i < 30; i++) frame(source);
    const clip = analyzer.takeCapture()!;
    expect(clip.samples.length).toBe(48_000);
    expect(clip.samples.every((value) => Math.abs(value - 0.2) < 0.0001)).toBe(true);
    clip.samples.fill(0);
    analyzer.startCapture();
    frame(source);
    // Observe the private RAM solely to verify erasure of discarded buffers.
    const raw = (analyzer as unknown as { capture: { buffer: Float32Array } }).capture.buffer;
    analyzer.discardCapture();
    expect(raw.every((value) => value === 0)).toBe(true);
    expect(analyzer.takeCapture()).toBeNull();
  });

  it("releases callback, track and unfinished raw capture on stop", async () => {
    await analyzer.start();
    analyzer.startCapture(Number.POSITIVE_INFINITY);
    frame(new Float32Array(2048).fill(0.1));
    const raw = (analyzer as unknown as { capture: { buffer: Float32Array } }).capture.buffer;
    expect(raw.length).toBe(48_000 * 15);
    analyzer.stop();
    expect(raw.every((value) => value === 0)).toBe(true);
    expect(node.onaudioprocess).toBeNull();
    expect(stopTrack).toHaveBeenCalled();
    expect(closeContext).toHaveBeenCalled();
    expect(analyzer.running).toBe(false);
  });
});
