import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeepgramTranscriber } from "./deepgram-transcriber";
import { createTranscriber } from "./transcriber";

class FakeSocket {
  static OPEN = 1;
  static instances: FakeSocket[] = [];
  readyState = 0;
  bufferedAmount = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  sent: unknown[] = [];
  constructor(readonly url: string, readonly protocols: string[]) { FakeSocket.instances.push(this); }
  send(value: unknown) { this.sent.push(value); }
  close = vi.fn(() => { this.readyState = 3; });
  open() { this.readyState = 1; this.onopen?.(); }
  result(value: unknown) { this.onmessage?.({ data: JSON.stringify(value) }); }
}

class FakeRecorder {
  static instances: FakeRecorder[] = [];
  static isTypeSupported = (type: string) => type === "audio/webm;codecs=opus";
  state = "inactive";
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onerror: (() => void) | null = null;
  onstop: (() => void) | null = null;
  constructor(readonly stream: unknown, readonly options: { mimeType: string }) { FakeRecorder.instances.push(this); }
  start = vi.fn(() => { this.state = "recording"; });
  stop = vi.fn(() => {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["final-audio-chunk"]) });
    this.onstop?.();
  });
}

const access = { accessCode: "ephemeral-demo-code", audience: "adult-demo" as const, consent: true as const, adultConfirmed: true };
const fetcher = vi.fn();
const getUserMedia = vi.fn();
const stopTrack = vi.fn();
const stream = { getTracks: () => [{ stop: stopTrack }] };
const latest = () => FakeSocket.instances.at(-1)!;
const recorder = () => FakeRecorder.instances.at(-1)!;
async function settle() { for (let i = 0; i < 12; i++) await Promise.resolve(); }
function result(start: number, transcript: string, isFinal = true, extra: Record<string, unknown> = {}) {
  return { type: "Results", start, is_final: isFinal, channel: { alternatives: [{ transcript, words: [{ word: transcript, start, end: start + 0.4, confidence: 0.9 }] }] }, ...extra };
}
async function open(handlers: Parameters<DeepgramTranscriber["start"]>[0] = { onText: vi.fn() }) {
  const transcriber = new DeepgramTranscriber(access);
  transcriber.start(handlers);
  await settle();
  latest().open();
  return transcriber;
}

beforeEach(() => {
  vi.useFakeTimers();
  FakeSocket.instances = [];
  FakeRecorder.instances = [];
  fetcher.mockReset().mockImplementation(() => Promise.resolve(Response.json({ token: "short-token", expiresAt: Date.now() + 30_000 })));
  getUserMedia.mockReset().mockResolvedValue(stream);
  stopTrack.mockReset();
  vi.stubGlobal("window", { isSecureContext: true });
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
  vi.stubGlobal("MediaRecorder", FakeRecorder);
  vi.stubGlobal("WebSocket", FakeSocket);
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("DeepgramTranscriber", () => {
  it("uses a short-lived token, real container, opt-out, and readiness only after the stream opens", async () => {
    const onReady = vi.fn();
    const transcriber = new DeepgramTranscriber(access);
    transcriber.start({ onText: vi.fn(), onReady });
    await settle();
    expect(onReady).not.toHaveBeenCalled();
    const socket = latest();
    const url = new URL(socket.url);
    expect(url.searchParams.get("model")).toBe("nova-3");
    expect(url.searchParams.get("language")).toBe("es-419");
    expect(url.searchParams.get("smart_format")).toBe("false");
    expect(url.searchParams.get("interim_results")).toBe("true");
    expect(url.searchParams.get("mip_opt_out")).toBe("true");
    expect(url.searchParams.has("encoding")).toBe(false);
    expect(url.searchParams.has("keyterm")).toBe(false);
    expect(socket.url).not.toContain("short-token");
    expect(socket.protocols).toEqual(["bearer", "short-token"]);
    expect(fetcher.mock.calls[0][1].headers["X-Voice-Access-Code"]).toBe(access.accessCode);
    socket.open();
    expect(onReady).toHaveBeenCalledOnce();
    expect(recorder().options.mimeType).toBe("audio/webm;codecs=opus");
    expect(recorder().start).toHaveBeenCalledWith(250);
    transcriber.abort();
    expect(stopTrack).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("replaces interim corrections and repeated final segments, retaining actual word timings", async () => {
    const onText = vi.fn(); const onResult = vi.fn();
    const transcriber = await open({ onText, onResult });
    latest().result(result(0, "porque el", false));
    latest().result(result(0, "porque", true));
    latest().result(result(0, "porque", true));
    latest().result(result(1, "agua", false));
    expect(onText).toHaveBeenLastCalledWith("porque agua", false);
    latest().result(result(1, "el agua", true));
    expect(onText).toHaveBeenLastCalledWith("porque el agua", true);
    expect(onResult).toHaveBeenLastCalledWith(expect.objectContaining({
      text: "porque el agua", provider: "deepgram", model: "nova-3", language: "es-419", isFinal: true,
      words: [{ word: "porque", start: 0, end: 0.4, confidence: 0.9 }, { word: "el agua", start: 1, end: 1.4, confidence: 0.9 }],
    }));
    transcriber.abort();
  });
  it("discards invalid word timing values rather than fabricating alignment", async () => {
    const onResult = vi.fn();
    const transcriber = await open({ onText: vi.fn(), onResult });
    latest().result(result(0, "evidencia", true, { channel: { alternatives: [{ transcript: "evidencia", words: [{ word: "bad", start: -1, end: 1 }, { word: "reversed", start: 2, end: 1 }, { word: "evidencia", start: 0, end: 0.5, confidence: 2 }] }] } }));
    expect(onResult.mock.calls[0][0].words).toEqual([{ word: "evidencia", start: 0, end: 0.5, confidence: null }]);
    transcriber.abort();
  });
  it("flushes the last audio chunk before Finalize and waits for the corrected final result", async () => {
    const transcriber = await open();
    const socket = latest();
    socket.result(result(0, "agua", false));
    const stopping = transcriber.stop();
    expect(transcriber.stop()).toBe(stopping);
    expect(socket.sent[0]).toBeInstanceOf(Blob);
    expect(socket.sent[1]).toBe(JSON.stringify({ type: "Finalize" }));
    socket.result(result(0, "el agua", true, { from_finalize: true }));
    await expect(stopping).resolves.toBe("el agua");
    expect(socket.sent.at(-1)).toBe(JSON.stringify({ type: "CloseStream" }));
    expect(socket.close).toHaveBeenCalledOnce();
    expect(recorder().ondataavailable).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("bounds finalization when the provider never answers", async () => {
    const transcriber = await open();
    latest().result(result(0, "texto", true));
    const stopping = transcriber.stop();
    await vi.advanceTimersByTimeAsync(1800);
    await expect(stopping).resolves.toBe("texto");
    expect(vi.getTimerCount()).toBe(0);
  });
  it("ignores stale socket events after abort or the next turn", async () => {
    const onText = vi.fn(); const onError = vi.fn();
    const transcriber = await open({ onText, onError });
    const staleMessage = latest().onmessage!; const staleError = latest().onerror!;
    transcriber.abort();
    transcriber.start({ onText, onError });
    await settle(); latest().open();
    staleMessage({ data: JSON.stringify(result(0, "old")) }); staleError();
    latest().result(result(0, "new"));
    expect(onText).toHaveBeenCalledExactlyOnceWith("new", true);
    expect(onError).not.toHaveBeenCalled();
    transcriber.abort();
  });
  it("stops a late microphone permission result without requesting a token", async () => {
    let resolve: (value: unknown) => void = () => {};
    getUserMedia.mockReturnValue(new Promise((r) => { resolve = r; }));
    const transcriber = new DeepgramTranscriber(access);
    transcriber.start({ onText: vi.fn() });
    transcriber.abort(); resolve(stream); await settle();
    expect(stopTrack).toHaveBeenCalledOnce();
    expect(fetcher).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("aborts a pending token fetch and ignores its late response", async () => {
    let resolve: (value: unknown) => void = () => {};
    fetcher.mockReturnValue(new Promise((r) => { resolve = r; }));
    const transcriber = new DeepgramTranscriber(access);
    transcriber.start({ onText: vi.fn() }); await settle();
    const signal = fetcher.mock.calls[0][1].signal as AbortSignal;
    transcriber.abort();
    expect(signal.aborted).toBe(true);
    resolve(Response.json({ token: "late-token", expiresAt: Date.now() + 30_000 })); await settle();
    expect(FakeSocket.instances).toHaveLength(0);
    expect(stopTrack).toHaveBeenCalled();
  });
  it("rejects expired grants before opening a socket", async () => {
    fetcher.mockResolvedValue(Response.json({ token: "expired", expiresAt: Date.now() - 1 }));
    const onError = vi.fn(); const transcriber = new DeepgramTranscriber(access);
    transcriber.start({ onText: vi.fn(), onError }); await settle();
    expect(onError).toHaveBeenCalledExactlyOnceWith("asr-session-expired");
    expect(FakeSocket.instances).toHaveLength(0);
    expect(stopTrack).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
  it.each([[401, "voice-access-required"], [403, "voice-access-required"], [429, "voice-rate-limit"], [503, "asr-unavailable"]])("fails closed on grant status %s", async (status, error) => {
    fetcher.mockResolvedValue(Response.json({ error: "provider secret must not escape" }, { status: status as number }));
    const onError = vi.fn(); const transcriber = new DeepgramTranscriber(access);
    transcriber.start({ onText: vi.fn(), onError }); await settle();
    expect(onError).toHaveBeenCalledExactlyOnceWith(error);
    expect(FakeSocket.instances).toHaveLength(0);
  });
  it("cleans up network failures once without reconnecting or losing the available text", async () => {
    const onError = vi.fn();
    const transcriber = await open({ onText: vi.fn(), onError });
    const socket = latest(); const error = socket.onerror!; const close = socket.onclose!;
    socket.result(result(0, "porque")); error(); close(); error();
    expect(onError).toHaveBeenCalledExactlyOnceWith("network");
    await expect(transcriber.stop()).resolves.toBe("porque");
    expect(FakeSocket.instances).toHaveLength(1);
    expect(stopTrack).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("bounds capture duration and does not retry automatically", async () => {
    const onError = vi.fn();
    await open({ onText: vi.fn(), onError });
    await vi.advanceTimersByTimeAsync(180_000);
    expect(onError).toHaveBeenCalledExactlyOnceWith("session-limit");
    expect(stopTrack).toHaveBeenCalled();
    expect(FakeSocket.instances).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("terminates slow connections and audio backpressure instead of buffering indefinitely", async () => {
    const onError = vi.fn(); const transcriber = new DeepgramTranscriber(access);
    transcriber.start({ onText: vi.fn(), onError }); await settle();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(onError).toHaveBeenCalledExactlyOnceWith("asr-unavailable");
    onError.mockClear();
    await open({ onText: vi.fn(), onError });
    latest().bufferedAmount = 1_048_577;
    recorder().ondataavailable?.({ data: new Blob(["audio"]) });
    expect(onError).toHaveBeenCalledExactlyOnceWith("network");
    expect(vi.getTimerCount()).toBe(0);
  });
  it("offers Deepgram explicitly for Spanish only; never silently uses it for Quechua", () => {
    expect(createTranscriber("es", { provider: "deepgram", cloudAccess: access })?.kind).toBe("deepgram");
    expect(createTranscriber("qu", { provider: "deepgram", cloudAccess: access })).toBeNull();
    expect(createTranscriber("es", { provider: "deepgram" })).toBeNull();
  });
});
