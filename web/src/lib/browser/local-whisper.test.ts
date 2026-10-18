import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LOCAL_ASR_MODEL, LocalWhisperTranscriber, localAsrReady, localSpeechActivity,
  parseLocalWhisperResult, prepareLocalAsr, releaseLocalAsr, resampleLocalAudio,
  type LocalWhisperRequest, type LocalWhisperResponse,
} from "./local-whisper";

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: { data: LocalWhisperResponse }) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessageerror: (() => void) | null = null;
  messages: LocalWhisperRequest[] = [];
  terminate = vi.fn();
  postMessage = vi.fn((message: LocalWhisperRequest) => { this.messages.push(message); });
  constructor(readonly url: URL, readonly options: { type: string }) { FakeWorker.instances.push(this); }
  reply(message: LocalWhisperResponse) { this.onmessage?.({ data: message }); }
  get latest() { return this.messages.at(-1)!; }
}

const node = () => ({ connect: vi.fn(), disconnect: vi.fn() });
class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  static rate = 48_000;
  static suspended = false;
  static resumePromise: Promise<void> | null = null;
  sampleRate = FakeAudioContext.rate;
  state = FakeAudioContext.suspended ? "suspended" : "running";
  destination = {};
  source = node();
  processor = { ...node(), onaudioprocess: null as ((event: { inputBuffer: { getChannelData: (channel: number) => Float32Array } }) => void) | null };
  mute = { ...node(), gain: { value: 1 } };
  close = vi.fn(async () => { this.state = "closed"; });
  resume = vi.fn(async () => { await FakeAudioContext.resumePromise; this.state = "running"; });
  createMediaStreamSource = vi.fn(() => this.source);
  createScriptProcessor = vi.fn(() => this.processor);
  createGain = vi.fn(() => this.mute);
  constructor() { FakeAudioContext.instances.push(this); }
  feed(frame: Float32Array) { this.processor.onaudioprocess?.({ inputBuffer: { getChannelData: () => frame } }); }
}

let trackStop = vi.fn<() => void>();
let getUserMedia = vi.fn<() => Promise<{ getTracks: () => { stop: () => void }[] }>>();
const latestWorker = () => FakeWorker.instances.at(-1)!;
const latestContext = () => FakeAudioContext.instances.at(-1)!;
const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
const tone = (seconds: number, rate = FakeAudioContext.rate) => Float32Array.from({ length: Math.round(seconds * rate) }, (_, i) => 0.1 * Math.sin(2 * Math.PI * 440 * i / rate));

async function prepared() {
  const promise = prepareLocalAsr();
  latestWorker().reply({ type: "ready", id: latestWorker().latest.id });
  await promise;
}

beforeEach(() => {
  vi.useFakeTimers();
  FakeWorker.instances = []; FakeAudioContext.instances = [];
  FakeAudioContext.rate = 48_000; FakeAudioContext.suspended = false; FakeAudioContext.resumePromise = null;
  trackStop = vi.fn(); getUserMedia = vi.fn(async () => ({ getTracks: () => [{ stop: trackStop }] }));
  vi.stubGlobal("Worker", FakeWorker); vi.stubGlobal("AudioContext", FakeAudioContext);
  vi.stubGlobal("window", { isSecureContext: true });
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
});

afterEach(() => {
  releaseLocalAsr(); vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals();
});

describe("local model preparation", () => {
  it("does not construct workers or download just by importing/checking support", () => {
    expect(LOCAL_ASR_MODEL).toBe("onnx-community/whisper-base_timestamped");
    expect(LocalWhisperTranscriber.isSupported()).toBe(true);
    expect(localAsrReady()).toBe(false);
    expect(FakeWorker.instances).toHaveLength(0);
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("loads once explicitly, reports bounded progress and reuses the prepared model", async () => {
    const progress = vi.fn(); const first = prepareLocalAsr(progress); const second = prepareLocalAsr();
    expect(FakeWorker.instances).toHaveLength(1);
    const worker = latestWorker(); expect(worker.options).toEqual({ type: "module" });
    expect(worker.messages).toHaveLength(1); expect(worker.latest.type).toBe("load");
    worker.reply({ type: "progress", id: worker.latest.id, file: "encoder", loaded: 15, total: 30 });
    expect(progress).toHaveBeenLastCalledWith(expect.objectContaining({ progress: 50, loaded: 15, total: 30 }));
    worker.reply({ type: "progress", id: worker.latest.id, file: "encoder" });
    expect(progress).toHaveBeenLastCalledWith(expect.objectContaining({ progress: 50, loaded: 15, total: 30 }));
    worker.reply({ type: "ready", id: worker.latest.id }); await Promise.all([first, second]);
    expect(localAsrReady()).toBe(true);
    await prepareLocalAsr(); expect(worker.messages).toHaveLength(1);
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("can cancel preparation, rejects waiters and ignores old worker events", async () => {
    const promise = prepareLocalAsr(); const worker = latestWorker(); const stale = worker.onmessage!;
    const rejection = expect(promise).rejects.toMatchObject({ code: "local-asr-cancelled" });
    releaseLocalAsr(); await rejection;
    stale({ data: { type: "ready", id: worker.latest.id } });
    expect(localAsrReady()).toBe(false); expect(worker.terminate).toHaveBeenCalledOnce();
    await prepared(); expect(FakeWorker.instances).toHaveLength(2);
  });

  it("retries a failed model download without a poisoned singleton", async () => {
    const promise = prepareLocalAsr(); const rejection = expect(promise).rejects.toMatchObject({ code: "local-asr-download" });
    const worker = latestWorker(); worker.reply({ type: "error", id: worker.latest.id, code: "local-asr-download" });
    await rejection; expect(localAsrReady()).toBe(false);
    await prepared(); expect(FakeWorker.instances).toHaveLength(2);
  });

  it("bounds a hung download", async () => {
    const promise = prepareLocalAsr(); const rejection = expect(promise).rejects.toMatchObject({ code: "local-asr-timeout" });
    await vi.advanceTimersByTimeAsync(300_000); await rejection;
    expect(latestWorker().terminate).toHaveBeenCalledOnce(); expect(localAsrReady()).toBe(false);
  });

  it("reports unsupported without Worker rather than making a server request", async () => {
    vi.stubGlobal("Worker", undefined);
    await expect(prepareLocalAsr()).rejects.toMatchObject({ code: "local-asr-unsupported" });
    expect(getUserMedia).not.toHaveBeenCalled();
  });
});

describe("PCM and timestamp boundaries", () => {
  it.each([16_000, 44_100, 48_000, 8_000])("resamples %i Hz with correct duration and amplitude", (rate) => {
    const result = resampleLocalAudio(new Float32Array(rate).fill(0.25), rate);
    expect(result).toHaveLength(16_000);
    expect(result[100]).toBeCloseTo(0.25, 5);
    expect(result.at(-1)).toBeCloseTo(0.25, 5);
  });

  it("copies native 16 kHz without allowing a transfer to detach caller memory", () => {
    const source = tone(0.2, 16_000); const result = resampleLocalAudio(source, 16_000);
    expect(result).not.toBe(source); expect(result).toEqual(source);
  });

  it("rejects invalid source rates", () => {
    expect(() => resampleLocalAudio(new Float32Array(5), NaN)).toThrow("local-asr-inference");
    expect(() => resampleLocalAudio(new Float32Array(5), 0)).toThrow("local-asr-inference");
  });

  it("does not infer on silence, DC noise, alternating noise or invalid PCM", () => {
    expect(localSpeechActivity(new Float32Array(4096))).toBe(false);
    expect(localSpeechActivity(new Float32Array(4096).fill(0.1))).toBe(false);
    expect(localSpeechActivity(Float32Array.from({ length: 4096 }, (_, i) => i % 2 ? -0.1 : 0.1))).toBe(false);
    expect(localSpeechActivity(new Float32Array([NaN, 0.1]))).toBe(false);
    expect(localSpeechActivity(tone(0.2))).toBe(true);
  });

  it("adds segment offset, retains missing times as untimed and never invents confidence", () => {
    const result = parseLocalWhisperResult({ text: " hola mundo ", chunks: [
      { text: " hola", timestamp: [0.1, 0.4] }, { text: " mundo", timestamp: [0.4, 0.8] },
      { text: "sin tiempo", timestamp: [0.9, null] }, { text: "futuro", timestamp: [1, 999] },
      { text: "negativo", timestamp: [-1, 0.1] }, { text: "infinito", timestamp: [0, Infinity] },
    ] }, 2, 1);
    expect(result.text).toBe("hola mundo");
    expect(result.words).toEqual([
      { word: "hola", start: 2.1, end: 2.4, confidence: null }, { word: "mundo", start: 2.4, end: 2.8, confidence: null },
    ]);
  });

  it.each([null, [], { text: 42 }, { text: "x".repeat(32_001) }])("rejects malformed transcript %j", (raw) => {
    expect(() => parseLocalWhisperResult(raw, 0, 10)).toThrow("local-asr-invalid-result");
  });
});

describe("LocalWhisperTranscriber", () => {
  it("will not download or open the mic if explicit preparation was skipped", () => {
    const onError = vi.fn(); new LocalWhisperTranscriber().start({ onText: vi.fn(), onError });
    expect(onError).toHaveBeenCalledExactlyOnceWith("local-asr-not-ready");
    expect(getUserMedia).not.toHaveBeenCalled(); expect(FakeWorker.instances).toHaveLength(0);
  });

  it("emits ready only after the microphone/context is accepting audio", async () => {
    await prepared(); FakeAudioContext.suspended = true;
    let resume!: () => void; FakeAudioContext.resumePromise = new Promise((resolve) => { resume = resolve; });
    const onReady = vi.fn(); const transcriber = new LocalWhisperTranscriber();
    transcriber.start({ onText: vi.fn(), onReady }); await flush();
    expect(onReady).not.toHaveBeenCalled(); resume(); await flush();
    expect(onReady).toHaveBeenCalledOnce();
    transcriber.abort(); expect(trackStop).toHaveBeenCalledOnce(); expect(latestContext().close).toHaveBeenCalledOnce();
    expect(localAsrReady()).toBe(true);
  });

  it("transcribes real mono PCM locally, uses absolute word times and releases capture before inference", async () => {
    await prepared(); const onText = vi.fn(); const onResult = vi.fn(); const transcriber = new LocalWhisperTranscriber();
    transcriber.start({ onText, onResult }); await flush();
    const context = latestContext();
    context.feed(new Float32Array(48_000)); context.feed(tone(0.3)); context.feed(new Float32Array(24_000));
    const stopped = transcriber.stop(); expect(trackStop).toHaveBeenCalledOnce();
    await flush(); const worker = latestWorker(); const request = worker.latest;
    expect(request.type).toBe("transcribe");
    if (request.type !== "transcribe") throw new Error("missing PCM request");
    expect(request.audio).toBeInstanceOf(Float32Array);
    expect(request.audio.length).toBeCloseTo(14_400, 0); // 0.25s preroll + .3s speech + .35s postroll
    worker.reply({ type: "result", id: request.id, output: { text: " porque sí ", chunks: [{ text: " porque", timestamp: [0.25, 0.4] }] } });
    await expect(stopped).resolves.toBe("porque sí");
    expect(onText).toHaveBeenLastCalledWith("porque sí", true);
    expect(onResult).toHaveBeenLastCalledWith(expect.objectContaining({ provider: "local-whisper", language: "es", isFinal: true,
      words: [{ word: "porque", start: 1, end: 1.15, confidence: null }] }));
    expect(localAsrReady()).toBe(true); expect(context.processor.onaudioprocess).toBeNull(); expect(vi.getTimerCount()).toBe(0);
  });

  it("preserves interior pauses instead of concatenating voiced frames", async () => {
    await prepared(); const transcriber = new LocalWhisperTranscriber(); transcriber.start({ onText: vi.fn() }); await flush();
    latestContext().feed(tone(0.2)); latestContext().feed(new Float32Array(48_000)); latestContext().feed(tone(0.2));
    const stopped = transcriber.stop(); await flush(); const request = latestWorker().latest;
    if (request.type !== "transcribe") throw new Error("missing request");
    expect(request.audio).toHaveLength(22_400); // all 1.4 seconds, including the interior 1 second pause
    expect(request.audio.subarray(4_000, 18_000).every((sample) => sample === 0)).toBe(true);
    latestWorker().reply({ type: "result", id: request.id, output: { text: "hola hola" } }); await stopped;
  });

  it("does not send silent audio for inference, even at stop", async () => {
    await prepared(); const onText = vi.fn(); const transcriber = new LocalWhisperTranscriber(); transcriber.start({ onText }); await flush();
    latestContext().feed(new Float32Array(96_000)); await vi.advanceTimersByTimeAsync(8000);
    await expect(transcriber.stop()).resolves.toBe("");
    expect(latestWorker().messages.map((message) => message.type)).toEqual(["load"]);
    expect(onText).toHaveBeenLastCalledWith("", true);
  });

  it("replaces prefix previews and performs one definitive full-turn pass without an unbounded queue", async () => {
    await prepared(); const onText = vi.fn(); const transcriber = new LocalWhisperTranscriber(); transcriber.start({ onText }); await flush();
    latestContext().feed(tone(1)); await vi.advanceTimersByTimeAsync(8_000);
    const preview = latestWorker().latest;
    latestContext().feed(tone(1)); await vi.advanceTimersByTimeAsync(16_000);
    expect(latestWorker().messages.filter((message) => message.type === "transcribe")).toHaveLength(1);
    latestWorker().reply({ type: "result", id: preview.id, output: { text: "el río" } }); await flush();
    expect(onText).toHaveBeenLastCalledWith("el río", false);
    const stopped = transcriber.stop(); expect(transcriber.stop()).toBe(stopped); await flush();
    const final = latestWorker().latest; expect(final.id).not.toBe(preview.id);
    latestWorker().reply({ type: "result", id: final.id, output: { text: "el río creció" } });
    await expect(stopped).resolves.toBe("el río creció"); expect(onText).toHaveBeenLastCalledWith("el río creció", true);
  });

  it("waits for an aborted inference before accepting a new turn, without leaking stale words", async () => {
    await prepared(); const oldText = vi.fn(); const first = new LocalWhisperTranscriber(); first.start({ onText: oldText }); await flush();
    latestContext().feed(tone(1)); await vi.advanceTimersByTimeAsync(8000); const oldRequest = latestWorker().latest;
    first.abort(); const nextReady = vi.fn(); const second = new LocalWhisperTranscriber(); second.start({ onText: vi.fn(), onReady: nextReady }); await flush();
    expect(getUserMedia).toHaveBeenCalledTimes(1); expect(nextReady).not.toHaveBeenCalled();
    latestWorker().reply({ type: "result", id: oldRequest.id, output: { text: "obsoleto" } }); await flush();
    expect(oldText).not.toHaveBeenCalled(); expect(nextReady).toHaveBeenCalledOnce(); expect(getUserMedia).toHaveBeenCalledTimes(2);
    second.abort();
  });

  it("aborts while permission is pending and immediately stops a late granted stream", async () => {
    await prepared(); let grant!: (stream: { getTracks: () => { stop: () => void }[] }) => void;
    getUserMedia.mockReturnValueOnce(new Promise((resolve) => { grant = resolve; }));
    const onReady = vi.fn(); const transcriber = new LocalWhisperTranscriber(); transcriber.start({ onText: vi.fn(), onReady }); await flush();
    transcriber.abort(); grant({ getTracks: () => [{ stop: trackStop }] }); await flush();
    expect(trackStop).toHaveBeenCalledOnce(); expect(onReady).not.toHaveBeenCalled(); expect(FakeAudioContext.instances).toHaveLength(0);
  });

  it("reports denied microphone permission without sending audio", async () => {
    await prepared(); getUserMedia.mockRejectedValueOnce(Object.assign(new Error("denied"), { name: "NotAllowedError" }));
    const onError = vi.fn(); const transcriber = new LocalWhisperTranscriber(); transcriber.start({ onText: vi.fn(), onError }); await flush();
    expect(onError).toHaveBeenCalledExactlyOnceWith("not-allowed"); expect(vi.getTimerCount()).toBe(0);
  });

  it("hard release cancels an active turn and does not accept a late result", async () => {
    await prepared(); const onText = vi.fn(); const transcriber = new LocalWhisperTranscriber(); transcriber.start({ onText }); await flush();
    latestContext().feed(tone(0.3)); const stopped = transcriber.stop(); await flush(); const worker = latestWorker(); const stale = worker.onmessage!; const request = worker.latest;
    releaseLocalAsr(); await expect(stopped).resolves.toBe("");
    stale({ data: { type: "result", id: request.id, output: { text: "tarde" } } }); await flush();
    expect(onText).not.toHaveBeenCalled(); expect(localAsrReady()).toBe(false); expect(trackStop).toHaveBeenCalledOnce();
  });

  it("bounds a hung final inference and cleans microphone/model resources", async () => {
    await prepared(); const onError = vi.fn(); const transcriber = new LocalWhisperTranscriber(); transcriber.start({ onText: vi.fn(), onError }); await flush();
    latestContext().feed(tone(0.3)); const stopped = transcriber.stop(); await flush();
    await vi.advanceTimersByTimeAsync(180_000); await expect(stopped).resolves.toBe("");
    expect(onError).toHaveBeenCalledExactlyOnceWith("local-asr-timeout"); expect(localAsrReady()).toBe(false); expect(vi.getTimerCount()).toBe(0);
  });
});
