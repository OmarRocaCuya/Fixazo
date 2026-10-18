import { afterEach, describe, expect, it, vi } from "vitest";
import { encodeMonoWav, IndigenousRecorder, releaseIndigenousRecorder } from "./indigenous-recorder";

describe("indigenous demo WAV transport", () => {
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
  it("encodes mono PCM16 at 16 kHz without external metadata", () => {
    const buffer = encodeMonoWav(new Float32Array([0, 1, -1, 0.5]), 16000);
    const view = new DataView(buffer);
    expect(buffer.byteLength).toBe(52);
    expect(new TextDecoder().decode(buffer.slice(0, 4))).toBe("RIFF");
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(16000);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getInt16(46, true)).toBe(32767);
    expect(view.getInt16(48, true)).toBe(-32768);
  });
  it("resamples 48 kHz and caps every payload to 30 seconds below one megabyte", () => {
    const buffer = encodeMonoWav(new Float32Array(48000 * 35), 48000);
    expect(buffer.byteLength).toBe(960044);
    expect(buffer.byteLength).toBeLessThan(1_000_000);
  });
  it("rejects invalid sample rates and safely clips non-finite samples", () => {
    expect(() => encodeMonoWav(new Float32Array(1), 0)).toThrow("invalid-sample-rate");
    const wav = encodeMonoWav(new Float32Array([Number.NaN, 2, -2]), 16000);
    const view = new DataView(wav);
    expect(view.getInt16(44, true)).toBe(0);
    expect(view.getInt16(46, true)).toBe(32767);
    expect(view.getInt16(48, true)).toBe(-32768);
  });
  it("releases a microphone granted after capture was cancelled", async () => {
    const stop = vi.fn();
    let grant!: (stream: unknown) => void;
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: () => new Promise((resolve) => { grant = resolve; }) } });
    const recorder = new IndigenousRecorder();
    const opening = recorder.start(vi.fn());
    recorder.cancel();
    grant({ getTracks: () => [{ stop }] });
    expect(await opening).toBe(false);
    expect(stop).toHaveBeenCalledOnce();
    expect(recorder.finish()).toBeNull();
  });
  it("allows a new capture attempt after microphone denial and protects replacement ownership", async () => {
    const getUserMedia = vi.fn().mockRejectedValue(Object.assign(new Error("denied"), { name: "NotAllowedError" }));
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
    const ref: { current: IndigenousRecorder | null } = { current: null };
    const attempt = async () => {
      if (ref.current) return;
      const client = new IndigenousRecorder(); ref.current = client;
      try { await client.start(vi.fn()); }
      catch { releaseIndigenousRecorder(ref, client); }
    };
    await attempt();
    expect(ref.current).toBeNull();
    await attempt();
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    const old = new IndigenousRecorder();
    const replacement = new IndigenousRecorder(); ref.current = replacement;
    releaseIndigenousRecorder(ref, old);
    expect(ref.current).toBe(replacement);
    releaseIndigenousRecorder(ref, replacement);
    expect(ref.current).toBeNull();
  });
  it("stops all capture resources after finishing and does not retain a second recording", async () => {
    vi.useFakeTimers();
    const stop = vi.fn();
    const disconnect = vi.fn();
    const close = vi.fn().mockResolvedValue(undefined);
    let process!: ((event: { inputBuffer: { getChannelData: () => Float32Array }; outputBuffer: { getChannelData: () => Float32Array } }) => void) | null;
    const processor = { connect: vi.fn(), disconnect, set onaudioprocess(callback: typeof process) { process = callback; } };
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [{ stop }] }) } });
    vi.stubGlobal("AudioContext", class {
      sampleRate = 16000; state = "running";
      destination = {};
      resume = async () => {};
      close = close;
      createMediaStreamSource = () => ({ connect: vi.fn(), disconnect });
      createScriptProcessor = () => processor;
    });
    const recorder = new IndigenousRecorder();
    const limit = vi.fn();
    expect(await recorder.start(limit)).toBe(true);
    const output = new Float32Array([1, 1, 1, 1]);
    process?.({ inputBuffer: { getChannelData: () => new Float32Array([0.1, 0.2, 0.3, 0.4]) }, outputBuffer: { getChannelData: () => output } });
    expect([...output]).toEqual([0, 0, 0, 0]);
    const blob = recorder.finish();
    expect(blob?.type).toBe("audio/wav");
    expect(blob?.size).toBe(52);
    expect(stop).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
    expect(process).toBeNull();
    expect(recorder.finish()).toBeNull();
    await vi.advanceTimersByTimeAsync(31_000);
    expect(limit).not.toHaveBeenCalled();
  });
});
