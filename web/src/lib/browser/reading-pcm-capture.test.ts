import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReadingPcmCapture, type ReadingPcmCaptureOptions } from "./reading-pcm-capture";

type FakeProcessor = {
  onaudioprocess: ((event: AudioProcessingEvent) => void) | null;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
};

const captures: ReadingPcmCapture[] = [];

function browser(rate = 16000, resume = () => Promise.resolve()) {
  const stop = vi.fn();
  const stream = { getTracks: () => [{ stop }] };
  const getUserMedia = vi.fn().mockResolvedValue(stream);
  const contexts: FakeContext[] = [];
  class FakeContext {
    sampleRate = rate;
    state = "running";
    destination = {};
    source = { connect: vi.fn(), disconnect: vi.fn() };
    processor: FakeProcessor = { onaudioprocess: null, connect: vi.fn(), disconnect: vi.fn() };
    resume = vi.fn(resume);
    close = vi.fn(async () => { this.state = "closed"; });
    createMediaStreamSource = vi.fn(() => this.source);
    createScriptProcessor = vi.fn(() => this.processor);
    constructor() { contexts.push(this); }
  }
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
  vi.stubGlobal("AudioContext", FakeContext);
  const emit = (samples: Float32Array, context = contexts.at(-1)!) => {
    const output = new Float32Array(4096).fill(1);
    context.processor.onaudioprocess?.({
      inputBuffer: { getChannelData: () => samples }, outputBuffer: { getChannelData: () => output },
    } as unknown as AudioProcessingEvent);
    return output;
  };
  return { stop, stream, getUserMedia, contexts, emit };
}

function capture(options: Partial<ReadingPcmCaptureOptions> = {}) {
  const handlers = {
    onChunk: vi.fn<ReadingPcmCaptureOptions["onChunk"]>(options.onChunk),
    onLimit: vi.fn<ReadingPcmCaptureOptions["onLimit"]>(options.onLimit),
    onError: vi.fn<ReadingPcmCaptureOptions["onError"]>(options.onError),
  };
  const client = new ReadingPcmCapture({ ...options, ...handlers });
  captures.push(client);
  return { client, ...handlers };
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => {
  for (const client of captures) client.abort();
  captures.length = 0;
  vi.useRealTimers(); vi.unstubAllGlobals();
});

describe("reading PCM capture", () => {
  it("never captures on construction and prevents duplicate microphone requests", async () => {
    const b = browser();
    let grant!: (value: unknown) => void;
    b.getUserMedia.mockImplementation(() => new Promise((resolve) => { grant = resolve; }));
    const c = capture();
    expect(b.getUserMedia).not.toHaveBeenCalled();
    expect(b.contexts).toHaveLength(0);
    const first = c.client.start();
    expect(await c.client.start()).toBe(false);
    expect(b.getUserMedia).toHaveBeenCalledOnce();
    grant(b.stream);
    expect(await first).toBe(true);
    expect(b.contexts[0].createScriptProcessor).toHaveBeenCalledWith(4096, 1, 1);
  });

  it("emits ordered four-second WAV chunks, silences output, and flushes a final partial once", async () => {
    const b = browser(); const c = capture();
    await c.client.start();
    const input = new Float32Array(16000).fill(0.2);
    for (let second = 0; second < 9; second++) expect([...b.emit(input)].every((value) => value === 0)).toBe(true);
    expect(c.onChunk).toHaveBeenCalledTimes(2);
    expect(c.onChunk.mock.calls.map((call) => call[1])).toEqual([
      { startSeconds: 0, durationSeconds: 4 }, { startSeconds: 4, durationSeconds: 4 },
    ]);
    c.client.stop(); c.client.stop(); c.client.abort();
    expect(c.onChunk).toHaveBeenCalledTimes(3);
    expect(c.onChunk.mock.calls[2][1]).toEqual({ startSeconds: 8, durationSeconds: 1 });
    const wav = c.onChunk.mock.calls[0][0] as Blob;
    expect(wav.type).toBe("audio/wav"); expect(wav.size).toBe(128044);
    const header = new DataView(await wav.arrayBuffer());
    expect(header.getUint16(22, true)).toBe(1);
    expect(header.getUint32(24, true)).toBe(16000);
    expect(header.getUint16(34, true)).toBe(16);
    expect(header.getInt16(44, true)).toBe(6553);
    expect(b.stop).toHaveBeenCalledOnce(); expect(b.contexts[0].close).toHaveBeenCalledOnce();
    expect(b.contexts[0].processor.onaudioprocess).toBeNull();
    expect(c.onLimit).not.toHaveBeenCalled(); expect(c.onError).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("resamples the browser's actual rate, rather than assuming the requested 16 kHz", async () => {
    const b = browser(48000); const c = capture();
    await c.client.start();
    b.emit(new Float32Array(48000 * 4).fill(0.1));
    expect(c.onChunk).toHaveBeenCalledOnce();
    expect((c.onChunk.mock.calls[0][0] as Blob).size).toBe(128044);
    expect(c.onChunk.mock.calls[0][1]).toEqual({ startSeconds: 0, durationSeconds: 4 });
  });

  it("preserves every sample across event boundaries and bounds each chunk instead of retaining 60 seconds", async () => {
    const b = browser(); const c = capture();
    await c.client.start();
    const input = new Float32Array(4096).fill(0.25);
    for (let i = 0; i < 200; i++) b.emit(input);
    c.client.stop();
    const calls = c.onChunk.mock.calls;
    expect(calls).toHaveLength(13);
    const totalSamples = calls.reduce((sum, [wav]) => sum + ((wav as Blob).size - 44) / 2, 0);
    expect(totalSamples).toBe(4096 * 200);
    expect(calls.every(([wav]) => (wav as Blob).size <= 128044)).toBe(true);
    expect(calls.at(-1)?.[1]).toEqual({ startSeconds: 48, durationSeconds: 3.2 });
  });

  it("flushes exactly 100 ms but discards a shorter partial on stop", async () => {
    const b = browser(); const c = capture();
    await c.client.start(); b.emit(new Float32Array(1599)); c.client.stop();
    expect(c.onChunk).not.toHaveBeenCalled();
    await c.client.start(); b.emit(new Float32Array(1600)); c.client.stop();
    expect(c.onChunk).toHaveBeenCalledOnce();
    expect(c.onChunk.mock.calls[0][1]).toEqual({ startSeconds: 0, durationSeconds: 0.1 });
  });

  it("discards pending PCM on abort and ignores already queued audio callbacks", async () => {
    const b = browser(); const c = capture();
    await c.client.start(); b.emit(new Float32Array(32000));
    const stale = b.contexts[0].processor.onaudioprocess!;
    c.client.abort(); c.client.stop();
    const readInput = vi.fn();
    stale({ inputBuffer: { getChannelData: readInput } } as unknown as AudioProcessingEvent);
    expect(readInput).not.toHaveBeenCalled(); expect(c.onChunk).not.toHaveBeenCalled();
    expect(b.stop).toHaveBeenCalledOnce(); expect(c.onLimit).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("releases a microphone permission granted after abort without reporting an error", async () => {
    const b = browser(); const c = capture();
    let grant!: (value: unknown) => void;
    b.getUserMedia.mockImplementation(() => new Promise((resolve) => { grant = resolve; }));
    const opening = c.client.start(); c.client.abort(); grant(b.stream);
    expect(await opening).toBe(false);
    expect(b.stop).toHaveBeenCalledOnce(); expect(b.contexts[0].close).toHaveBeenCalledOnce();
    expect(c.onError).not.toHaveBeenCalled(); expect(c.onChunk).not.toHaveBeenCalled();
  });

  it("a stale permission rejection cannot close a replacement capture", async () => {
    const b = browser(); const c = capture();
    let reject!: (error: Error) => void;
    b.getUserMedia.mockImplementationOnce(() => new Promise((_resolve, rejectPromise) => { reject = rejectPromise; }));
    const first = c.client.start(); c.client.abort();
    expect(await c.client.start()).toBe(true);
    reject(new Error("old request denied"));
    expect(await first).toBe(false);
    expect(b.contexts[1].close).not.toHaveBeenCalled();
    b.emit(new Float32Array(64000));
    expect(c.onChunk).toHaveBeenCalledOnce(); expect(c.onError).not.toHaveBeenCalled();
  });

  it("releases capture when context resume completes after cancellation", async () => {
    let resume!: () => void;
    const b = browser(16000, () => new Promise((resolve) => { resume = resolve; }));
    const c = capture(); const starting = c.client.start();
    await Promise.resolve();
    c.client.stop(); resume();
    expect(await starting).toBe(false);
    expect(b.stop).toHaveBeenCalledOnce(); expect(b.contexts[0].close).toHaveBeenCalledOnce();
    expect(c.onChunk).not.toHaveBeenCalled();
  });

  it("caps captured samples at 60 seconds and notifies the limit exactly once", async () => {
    const b = browser(); const c = capture();
    await c.client.start();
    b.emit(new Float32Array(16000 * 65));
    expect(c.onChunk).toHaveBeenCalledTimes(15);
    expect(c.onChunk.mock.calls.at(-1)?.[1]).toEqual({ startSeconds: 56, durationSeconds: 4 });
    expect(c.onLimit).toHaveBeenCalledOnce(); expect(b.stop).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(70_000); c.client.stop();
    expect(c.onLimit).toHaveBeenCalledOnce(); expect(c.onChunk).toHaveBeenCalledTimes(15);
  });

  it("also stops at the wall-clock limit if no audio callbacks arrive", async () => {
    const b = browser(); const c = capture({ maxSeconds: 6 });
    await c.client.start(); b.emit(new Float32Array(3200));
    await vi.advanceTimersByTimeAsync(6000);
    expect(c.onLimit).toHaveBeenCalledOnce(); expect(b.stop).toHaveBeenCalledOnce();
    expect(c.onChunk.mock.calls[0][1]).toEqual({ startSeconds: 0, durationSeconds: 0.2 });
  });

  it("does not start the limit clock while microphone permission is pending", async () => {
    const b = browser(); const c = capture({ maxSeconds: 1 });
    let grant!: (value: unknown) => void;
    b.getUserMedia.mockImplementation(() => new Promise((resolve) => { grant = resolve; }));
    const opening = c.client.start(); await vi.advanceTimersByTimeAsync(60_000);
    expect(c.onLimit).not.toHaveBeenCalled();
    grant(b.stream); expect(await opening).toBe(true);
    await vi.advanceTimersByTimeAsync(999); expect(c.onLimit).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1); expect(c.onLimit).toHaveBeenCalledOnce();
  });

  it("releases resources after permission denial and allows an explicit retry", async () => {
    const b = browser(); const c = capture();
    b.getUserMedia.mockRejectedValueOnce(Object.assign(new Error("denied"), { name: "NotAllowedError" }));
    expect(await c.client.start()).toBe(false);
    expect(c.onError).toHaveBeenCalledWith("not-allowed");
    expect(b.contexts[0].close).toHaveBeenCalledOnce();
    expect(await c.client.start()).toBe(true);
  });

  it("aborts safely if the chunk consumer throws or stops capture reentrantly", async () => {
    const b = browser(); const throwing = capture({ onChunk: vi.fn(() => { throw new Error("queue full"); }) });
    await throwing.client.start(); b.emit(new Float32Array(16000 * 8));
    expect(throwing.onError).toHaveBeenCalledWith("capture-callback-error");
    expect(throwing.onChunk).toHaveBeenCalledOnce(); expect(b.stop).toHaveBeenCalledOnce();
    const c = capture(); c.onChunk.mockImplementation(() => c.client.abort());
    await c.client.start(); b.emit(new Float32Array(16000 * 8));
    expect(c.onChunk).toHaveBeenCalledOnce(); expect(c.onError).not.toHaveBeenCalled();
  });

  it("fails closed for unsupported APIs or invalid duration configuration", async () => {
    vi.stubGlobal("navigator", {});
    const c = capture();
    expect(await c.client.start()).toBe(false); expect(c.onError).toHaveBeenCalledWith("unsupported");
    for (const chunkSeconds of [0, 31, Number.NaN]) expect(() => capture({ chunkSeconds })).toThrow(RangeError);
    for (const maxSeconds of [0, 61, Number.POSITIVE_INFINITY]) expect(() => capture({ maxSeconds })).toThrow(RangeError);
  });
});
