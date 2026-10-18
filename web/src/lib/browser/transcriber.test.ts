import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTranscriber, speechRecognitionSupported, WebSpeechTranscriber } from "./transcriber";

type ResultEvent = {
  resultIndex: number;
  results: { isFinal: boolean; 0: { transcript: string }; length: number }[];
};

class FakeRecognition {
  static instances: FakeRecognition[] = [];
  static throwOnStart = false;
  static throwOnConstruct = false;
  static emitOnStart = true;
  lang = "";
  continuous = false;
  interimResults = false;
  maxAlternatives = 0;
  onresult: ((event: ResultEvent) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  onstart: (() => void) | null = null;
  start = vi.fn(() => { if (FakeRecognition.throwOnStart) throw new Error("unavailable"); if (FakeRecognition.emitOnStart) this.onstart?.(); });
  stop = vi.fn();
  abort = vi.fn();

  constructor() {
    if (FakeRecognition.throwOnConstruct) throw new Error("unavailable");
    FakeRecognition.instances.push(this);
  }

  result(...parts: [string, boolean][]) {
    this.onresult?.({ resultIndex: 0, results: parts.map(([transcript, isFinal]) => ({ isFinal, 0: { transcript }, length: 1 })) });
  }
}

const latest = () => FakeRecognition.instances.at(-1)!;

beforeEach(() => {
  vi.useFakeTimers();
  FakeRecognition.instances = [];
  FakeRecognition.throwOnStart = false;
  FakeRecognition.throwOnConstruct = false;
  FakeRecognition.emitOnStart = true;
  vi.stubGlobal("window", { SpeechRecognition: FakeRecognition, isSecureContext: true });
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("WebSpeechTranscriber", () => {
  it("signals readiness only on native start and only once per turn", () => {
    FakeRecognition.emitOnStart = false;
    const onReady = vi.fn();
    const transcriber = new WebSpeechTranscriber();
    transcriber.start({ onText: vi.fn(), onReady });
    expect(onReady).not.toHaveBeenCalled();
    const ready = latest().onstart!;
    ready(); ready();
    expect(onReady).toHaveBeenCalledOnce();
    transcriber.abort(); ready();
    expect(onReady).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("fails a stalled native startup without leaving the reading clock waiting forever", async () => {
    FakeRecognition.emitOnStart = false;
    const onError = vi.fn();
    const transcriber = new WebSpeechTranscriber();
    transcriber.start({ onText: vi.fn(), onError });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(onError).toHaveBeenCalledExactlyOnceWith("start-failed");
    expect(latest().onstart).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("replaces cumulative and corrected results instead of duplicating finals", async () => {
    const transcriber = new WebSpeechTranscriber();
    const onText = vi.fn();
    transcriber.start({ onText });
    const rec = latest();
    rec.result(["porque", true], ["el", false]);
    rec.result(["porque", true], ["el río", false]);
    rec.result(["porque", true], ["el río creció", true]);
    rec.result(["porque", true], ["el río creció", true]);
    expect(onText).toHaveBeenLastCalledWith("porque el río creció", true);
    const result = transcriber.stop();
    rec.onend?.();
    await expect(result).resolves.toBe("porque el río creció");
    expect(rec.lang).toBe("es-PE");
    expect(rec.onresult).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["network", "service-not-allowed", "not-allowed", "no-speech", "audio-capture", "aborted"])("terminates %s once without retrying", async (error) => {
    const transcriber = new WebSpeechTranscriber();
    const onError = vi.fn();
    transcriber.start({ onText: vi.fn(), onError });
    const rec = latest();
    const lateEnd = rec.onend!;
    const lateError = rec.onerror!;
    rec.result(["evidencia", true]);
    rec.onerror?.({ error });
    lateEnd();
    lateError({ error });
    await vi.runAllTimersAsync();
    expect(onError).toHaveBeenCalledExactlyOnceWith(error);
    expect(FakeRecognition.instances).toHaveLength(1);
    expect(rec.abort).toHaveBeenCalledOnce();
    expect(rec.onend).toBeNull();
    await expect(transcriber.stop()).resolves.toBe("evidencia");
  });

  it("bounds delayed restarts and ignores callbacks from previous recognizers", async () => {
    const transcriber = new WebSpeechTranscriber();
    const onText = vi.fn();
    const onError = vi.fn();
    transcriber.start({ onText, onError });
    const first = latest();
    const staleResult = first.onresult!;
    first.result(["primera", true]);
    first.onend?.();
    expect(FakeRecognition.instances).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(300);
    const second = latest();
    second.result(["segunda", true]);
    staleResult({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: "obsoleta" }, length: 1 }] });
    expect(onText).toHaveBeenLastCalledWith("primera segunda", true);
    second.onend?.();
    await vi.advanceTimersByTimeAsync(300);
    latest().onend?.();
    await vi.runAllTimersAsync();
    expect(FakeRecognition.instances).toHaveLength(3);
    expect(onError).toHaveBeenCalledExactlyOnceWith("recognition-ended");
    expect(vi.getTimerCount()).toBe(0);
    await expect(transcriber.stop()).resolves.toBe("primera segunda");
  });

  it("shares a pending stop and includes the final result before releasing handlers", async () => {
    const transcriber = new WebSpeechTranscriber();
    transcriber.start({ onText: vi.fn() });
    const rec = latest();
    rec.result(["parcial", false]);
    const firstStop = transcriber.stop();
    expect(transcriber.stop()).toBe(firstStop);
    rec.result(["respuesta final", true]);
    rec.onend?.();
    await expect(firstStop).resolves.toBe("respuesta final");
    expect(rec.stop).toHaveBeenCalledOnce();
    expect(rec.onerror).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("aborts after the stop deadline and ignores late events", async () => {
    const transcriber = new WebSpeechTranscriber();
    const onText = vi.fn();
    transcriber.start({ onText });
    const rec = latest();
    const lateResult = rec.onresult!;
    rec.result(["mejor texto", false]);
    const stopped = transcriber.stop();
    await vi.advanceTimersByTimeAsync(900);
    await expect(stopped).resolves.toBe("mejor texto");
    lateResult({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: "tardío" }, length: 1 }] });
    expect(onText).toHaveBeenCalledOnce();
    expect(rec.abort).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("settles an interrupted stop before starting an independent session", async () => {
    const transcriber = new WebSpeechTranscriber();
    const oldText = vi.fn();
    transcriber.start({ onText: oldText });
    const oldRec = latest();
    oldRec.result(["viejo", true]);
    const stopped = transcriber.stop();
    const lateEnd = oldRec.onend!;
    const newText = vi.fn();
    transcriber.start({ onText: newText });
    await expect(stopped).resolves.toBe("viejo");
    lateEnd();
    latest().result(["nuevo", true]);
    expect(newText).toHaveBeenLastCalledWith("nuevo", true);
    transcriber.abort();
    await expect(transcriber.stop()).resolves.toBe("nuevo");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("resolves a pending stop immediately when aborted", async () => {
    const transcriber = new WebSpeechTranscriber();
    transcriber.start({ onText: vi.fn() });
    latest().result(["guardado en memoria", false]);
    const stopped = transcriber.stop();
    transcriber.abort();
    await expect(stopped).resolves.toBe("guardado en memoria");
    expect(latest().abort).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cancels a scheduled restart when stopped or aborted", async () => {
    const transcriber = new WebSpeechTranscriber();
    transcriber.start({ onText: vi.fn() });
    latest().result(["respuesta", true]);
    latest().onend?.();
    await expect(transcriber.stop()).resolves.toBe("respuesta");
    await vi.runAllTimersAsync();
    expect(FakeRecognition.instances).toHaveLength(1);
    transcriber.start({ onText: vi.fn() });
    latest().onend?.();
    transcriber.abort();
    await vi.runAllTimersAsync();
    expect(FakeRecognition.instances).toHaveLength(2);
  });

  it.each(["constructor", "start"])("cleans up a throwing %s without retries", async (stage) => {
    FakeRecognition.throwOnConstruct = stage === "constructor";
    FakeRecognition.throwOnStart = stage === "start";
    const onError = vi.fn();
    const transcriber = new WebSpeechTranscriber();
    transcriber.start({ onText: vi.fn(), onError });
    await expect(transcriber.stop()).resolves.toBe("");
    await vi.runAllTimersAsync();
    expect(onError).toHaveBeenCalledExactlyOnceWith("start-failed");
    if (stage === "start") expect(latest().abort).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("finishes a stop even when the browser throws", async () => {
    const transcriber = new WebSpeechTranscriber();
    transcriber.start({ onText: vi.fn() });
    latest().stop.mockImplementation(() => { throw new Error("already ended"); });
    latest().abort.mockImplementation(() => { throw new Error("released"); });
    await expect(transcriber.stop()).resolves.toBe("");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("handles a synchronous end during stop", async () => {
    const transcriber = new WebSpeechTranscriber();
    transcriber.start({ onText: vi.fn() });
    const rec = latest();
    rec.stop.mockImplementation(() => { rec.onend?.(); });
    await expect(transcriber.stop()).resolves.toBe("");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not turn an expected stopping error into a new failure", async () => {
    const transcriber = new WebSpeechTranscriber();
    const onError = vi.fn();
    transcriber.start({ onText: vi.fn(), onError });
    const rec = latest();
    const stopped = transcriber.stop();
    rec.onerror?.({ error: "no-speech" });
    await expect(stopped).resolves.toBe("");
    expect(onError).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("reports unavailable and insecure APIs without constructing a recognizer", () => {
    const onError = vi.fn();
    vi.stubGlobal("window", { isSecureContext: false, SpeechRecognition: FakeRecognition });
    new WebSpeechTranscriber().start({ onText: vi.fn(), onError });
    expect(onError).toHaveBeenLastCalledWith("insecure-context");
    vi.stubGlobal("window", { isSecureContext: true });
    new WebSpeechTranscriber().start({ onText: vi.fn(), onError });
    expect(onError).toHaveBeenLastCalledWith("unsupported");
    expect(speechRecognitionSupported()).toBe(false);
    expect(createTranscriber("es")).toBeNull();
    expect(createTranscriber("qu")).toBeNull();
    expect(FakeRecognition.instances).toHaveLength(0);
  });

  it("accepts the prefixed API without claiming support for Quechua", () => {
    vi.stubGlobal("window", { isSecureContext: true, webkitSpeechRecognition: FakeRecognition });
    expect(speechRecognitionSupported()).toBe(true);
    expect(createTranscriber("es")).toBeInstanceOf(WebSpeechTranscriber);
    expect(createTranscriber("qu")).toBeNull();
  });
});
