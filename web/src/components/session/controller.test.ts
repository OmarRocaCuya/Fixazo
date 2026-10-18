import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FrameFeature } from "@/lib/types";
import type { TranscriberHandlers } from "@/lib/browser/transcriber";
import type { CloudVoiceAccess } from "@/lib/voice/types";

const mock = vi.hoisted(() => ({
  handlers: null as TranscriberHandlers | null,
  transcript: "",
  errorOnStart: "",
  stopError: false,
  stopPending: null as Promise<string> | null,
  speechSupported: true,
  delayReady: false,
  localReady: false,
  localPrepareError: false,
  cloudStatus: { enabled: false, mode: "disabled", reason: "Nube desactivada" },
  audioStart: null as (() => Promise<void>) | null,
  analyzers: [] as { running: boolean; stop: () => void; emit: (f: FrameFeature) => void }[],
  transcriberStart: vi.fn(),
  transcriberAbort: vi.fn(),
  transcriberCreate: vi.fn(),
  localPrepare: vi.fn(),
}));

vi.mock("@/lib/browser/local-whisper", () => ({
  localAsrReady: () => mock.localReady,
  prepareLocalAsr: async () => {
    mock.localPrepare();
    if (mock.localPrepareError) throw new Error("download failed");
    mock.localReady = true;
  },
  releaseLocalAsr: () => { mock.localReady = false; },
}));

vi.mock("@/lib/browser/audio", () => ({
  AudioAnalyzer: class {
    running = false;
    private listener: ((f: FrameFeature) => void) | null = null;
    constructor() { mock.analyzers.push(this); }
    async start() {
      if (mock.audioStart) await mock.audioStart();
      this.running = true;
    }
    now() { return performance.now(); }
    subscribe(cb: (f: FrameFeature) => void) {
      this.listener = cb;
      return () => { this.listener = null; };
    }
    emit(frame: FrameFeature) { this.listener?.(frame); }
    stop() { this.running = false; this.listener = null; }
  },
}));

vi.mock("@/lib/browser/transcriber", () => ({
  speechRecognitionSupported: () => mock.speechSupported,
  createTranscriber: (lang: string, options?: { provider?: string }) => {
    mock.transcriberCreate(lang, options);
    return {
    kind: options?.provider === "deepgram" ? "deepgram" : options?.provider === "local-whisper" ? "local-whisper" : "web-speech",
    start: (handlers: TranscriberHandlers) => {
      mock.transcriberStart();
      mock.handlers = handlers;
      if (mock.errorOnStart) handlers.onError?.(mock.errorOnStart);
      else if (!mock.delayReady) handlers.onReady?.();
    },
    stop: async () => {
      if (mock.stopError) throw new Error("network");
      if (mock.stopPending) return mock.stopPending;
      return mock.transcript;
    },
    abort: mock.transcriberAbort,
    };
  },
}));

import { SessionController } from "./controller";
import { getStore } from "@/lib/storage";
import { SAMPLE_ES } from "@/lib/mission/samples";

let ctl: SessionController;

async function begin() {
  ctl.init();
  await ctl.begin();
  await Promise.resolve();
  expect(ctl.getSnapshot().ctx?.state).toBe("READ");
}

function hear(text: string, isFinal = false) {
  mock.transcript = text;
  mock.handlers?.onText(text, isFinal);
}

async function answerTurn() {
  hear(SAMPLE_ES.text, true);
  await Promise.resolve();
  await Promise.resolve();
  expect(ctl.getSnapshot().ctx?.state).toBe("Q_OBTIENE");
  mock.transcript = "";
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("window", { isSecureContext: true });
  vi.stubGlobal("navigator", { userAgent: "OPR/120", mediaDevices: { getUserMedia: vi.fn() } });
  vi.stubGlobal("fetch", vi.fn(async (url: string) => ({ json: async () => url === "/api/asr" ? { providers: { deepgram: mock.cloudStatus } } : { mode: "reglas" } })));
  mock.handlers = null;
  mock.transcript = "";
  mock.errorOnStart = "";
  mock.stopError = false;
  mock.stopPending = null;
  mock.speechSupported = true;
  mock.delayReady = false;
  mock.localReady = false;
  mock.localPrepareError = false;
  mock.cloudStatus = { enabled: false, mode: "disabled", reason: "Nube desactivada" };
  mock.audioStart = null;
  mock.analyzers = [];
  mock.transcriberStart.mockClear();
  mock.transcriberAbort.mockClear();
  mock.transcriberCreate.mockClear();
  mock.localPrepare.mockClear();
  const store = getStore();
  store.deleteAllData();
  store.saveConsent({ version: "1", acceptedAt: new Date().toISOString(), permissions: { voice: true, process: true, mood: false } });
  store.saveProfile({ alias: "Yeni", grade: 4, homeLang: "es", readingLang: "es" });
  store.saveMission(SAMPLE_ES);
  store.setCurrentMission(SAMPLE_ES.id);
  ctl = new SessionController();
});

afterEach(() => {
  ctl.dispose();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("voice session integration", () => {
  it("tracks interim text but waits for final recognition before completing reading", async () => {
    await begin();
    hear(SAMPLE_ES.text);
    await Promise.resolve();
    expect(ctl.getSnapshot().ctx?.state).toBe("READ");
    expect(ctl.getSnapshot()).toMatchObject({ readProvisional: true, live: { accuracy: null, differentIdx: [] } });
    expect(ctl.getSnapshot().readProgress).toBeGreaterThan(10);
    hear(SAMPLE_ES.text, true);
    await Promise.resolve();
    await Promise.resolve();
    expect(ctl.getSnapshot().ctx?.state).toBe("Q_OBTIENE");
    expect(ctl.getSnapshot().readProvisional).toBe(false);
  });

  it("never advances to a question from unrelated speech or an isolated final word", async () => {
    await begin();
    for (const text of ["Hola soy Diego", SAMPLE_ES.text.trim().split(/\s+/).at(-1)!]) {
      hear(text, true);
      await Promise.resolve();
      expect(ctl.getSnapshot().ctx?.state).toBe("READ");
      expect(ctl.getSnapshot().readProgress).toBe(0);
      expect(ctl.getSnapshot().live.accuracy).toBeNull();
    }
  });

  it("corrects a provisional cursor when cumulative ASR text is rewritten", async () => {
    await begin();
    const words = SAMPLE_ES.text.split(/\s+/);
    hear(words.slice(0, 8).join(" "));
    expect(ctl.getSnapshot().readProgress).toBe(8);
    hear(words.slice(0, 3).join(" "));
    expect(ctl.getSnapshot().readProgress).toBe(3);
    hear(words.slice(0, 3).join(" "), true);
    expect(ctl.getSnapshot().readProvisional).toBe(false);
    expect(ctl.getSnapshot().live.accuracy).toBe(1);
  });

  it("preserves a manual draft without pretending to track the child's voice", async () => {
    mock.speechSupported = false;
    await begin();
    ctl.previewSimulatedReading("Rosa se levantó");
    expect(ctl.getSnapshot()).toMatchObject({ caption: "Rosa se levantó", readProgress: 0, live: { accuracy: null } });
    ctl.submitSimulated("Rosa se levantó", null, 15);
    expect(ctl.getSnapshot().readProgress).toBe(3);
    expect(ctl.getSnapshot().live.accuracy).toBe(1);
    expect(ctl.getSnapshot().ctx?.state).toBe("Q_OBTIENE");
  });

  it("shows separate capture/transcription prerequisites without blocking Opera by UA", () => {
    ctl.init();
    expect(ctl.getSnapshot().voiceSupport).toMatchObject({ canRecord: true, canTranscribe: true, browser: "opera" });
    expect(ctl.getSnapshot().simulationForced).toBeNull();
  });

  it("offers manual input in Opera even when physical capture is available but recognition is not", async () => {
    mock.speechSupported = false;
    ctl.init();
    expect(ctl.getSnapshot().voiceSupport).toMatchObject({ canRecord: true, canTranscribe: false });
    expect(ctl.getSnapshot().simulationForced).toContain("no necesitas cambiar a celular");
    await ctl.begin();
    expect(mock.analyzers[0].running).toBe(false);
    expect(mock.transcriberStart).not.toHaveBeenCalled();
    expect(ctl.getSnapshot()).toMatchObject({ simulation: true, listening: true });
  });

  it("does not request a microphone on an insecure page", async () => {
    vi.stubGlobal("window", { isSecureContext: false });
    ctl.init();
    expect(ctl.getSnapshot().simulationForced).toContain("HTTPS");
    await ctl.testMicrophone();
    await ctl.begin();
    expect(mock.analyzers).toHaveLength(1);
    expect(mock.analyzers[0].running).toBe(false);
    expect(mock.transcriberStart).not.toHaveBeenCalled();
  });

  it("falls back after getUserMedia denial without permanently blocking a retry", async () => {
    mock.audioStart = async () => { throw Object.assign(new Error("denied"), { name: "NotAllowedError" }); };
    await begin();
    expect(ctl.getSnapshot()).toMatchObject({ simulation: true, simulationForced: null, listening: true });
    expect(ctl.getSnapshot().micError).toContain("No se permitió");
    mock.audioStart = null;
    await ctl.retryMic();
    expect(ctl.getSnapshot()).toMatchObject({ simulation: false, micError: null });
  });

  it.each(["network", "no-speech", "not-allowed", "service-not-allowed", "start-failed", "unsupported", "recognition-ended"])("keeps partial text and the same question after %s", async (code) => {
    await begin();
    await answerTurn();
    hear("fue al");
    const before = ctl.getSnapshot().ctx;
    const stale = mock.handlers!;
    stale.onError?.(code);
    expect(ctl.getSnapshot()).toMatchObject({ simulation: true, caption: "fue al", listening: true, usingWebSpeech: false });
    expect(ctl.getSnapshot().ctx).toBe(before);
    expect(ctl.getSnapshot().micError).toBeTruthy();
    expect(mock.analyzers[0].running).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    stale.onText("texto de una sesión antigua", true);
    await vi.advanceTimersByTimeAsync(90_000);
    expect(ctl.getSnapshot().ctx).toBe(before);
    expect(ctl.getSnapshot().caption).toBe("fue al");
    ctl.submitSimulated("fue al río", null, null);
    expect(ctl.getSnapshot().ctx?.answers.obtiene).toBe("fue al río");
  });

  it("does not install timers after a synchronous recognition start error", async () => {
    mock.errorOnStart = "start-failed";
    await begin();
    expect(ctl.getSnapshot()).toMatchObject({ simulation: true, listening: true, caption: "" });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("treats timeout without a transcript as a technical fallback, not a wrong answer or help", async () => {
    await begin();
    await answerTurn();
    const ctx = ctl.getSnapshot().ctx;
    await vi.advanceTimersByTimeAsync(8500);
    expect(ctl.getSnapshot().ctx).toBe(ctx);
    expect(ctl.getSnapshot()).toMatchObject({ simulation: true, listening: true });
    expect(ctl.getSnapshot().ctx?.helps.obtiene).toBe(0);
    expect(ctl.getSnapshot().ctx?.answers.obtiene).toBeUndefined();
  });

  it("preserves text and stays on the reading when stop rejects", async () => {
    await begin();
    hear("Rosa se levantó");
    mock.stopError = true;
    ctl.finishReading();
    await Promise.resolve();
    await Promise.resolve();
    expect(ctl.getSnapshot()).toMatchObject({ simulation: true, caption: "Rosa se levantó", listening: true });
    expect(ctl.getSnapshot().ctx?.state).toBe("READ");
  });

  it("permits retry after denied permission and preserves the manual draft", async () => {
    await begin();
    hear("Rosa se");
    mock.handlers?.onError?.("not-allowed");
    expect(ctl.getSnapshot().simulationForced).toBeNull();
    await ctl.retryMic();
    expect(ctl.getSnapshot()).toMatchObject({ simulation: false, caption: "Rosa se", micError: null });
    hear("levantó temprano");
    expect(ctl.getSnapshot().caption).toBe("Rosa se levantó temprano");
  });

  it("does not resume a stale turn when microphone permission resolves after pause", async () => {
    await begin();
    mock.handlers?.onError?.("not-allowed");
    let grant!: () => void;
    mock.audioStart = () => new Promise((resolve) => { grant = resolve; });
    const pending = ctl.retryMic();
    ctl.pause();
    const starts = mock.transcriberStart.mock.calls.length;
    grant();
    await pending;
    expect(ctl.getSnapshot().ctx?.state).toBe("PAUSED");
    expect(mock.transcriberStart).toHaveBeenCalledTimes(starts);
    expect(mock.analyzers[0].running).toBe(false);
  });

  it("stops capture when switching to manual and ignores an empty form", async () => {
    await begin();
    await answerTurn();
    hear("fue");
    await ctl.toggleSimulation();
    const ctx = ctl.getSnapshot().ctx;
    expect(ctl.getSnapshot()).toMatchObject({ simulation: true, caption: "fue" });
    expect(mock.analyzers[0].running).toBe(false);
    ctl.submitSimulated("  ", null, null);
    expect(ctl.getSnapshot().ctx).toBe(ctx);
  });

  it("tests physical sound without starting a transcriber and releases the mic", async () => {
    ctl.init();
    await ctl.testMicrophone();
    const probe = mock.analyzers[1];
    probe.emit({ t: 1, rms: 0.03, voiced: true, f0: null, clip: 0 });
    await vi.advanceTimersByTimeAsync(2500);
    expect(ctl.getSnapshot().micTesting).toBe(false);
    expect(ctl.getSnapshot().micTestMessage).toContain("micrófono recibe sonido");
    expect(probe.running).toBe(false);
    expect(mock.transcriberStart).not.toHaveBeenCalled();
  });

  it("releases a microphone permission granted after its test was cancelled", async () => {
    ctl.init();
    let grant!: () => void;
    mock.audioStart = () => new Promise((resolve) => { grant = resolve; });
    const pending = ctl.testMicrophone();
    ctl.cancelMicrophoneTest();
    grant();
    await pending;
    expect(mock.analyzers[1].running).toBe(false);
    expect(ctl.getSnapshot().micTestMessage).toContain("cancelada");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not use general voice permission as cloud consent", async () => {
    mock.cloudStatus = { enabled: true, mode: "adult-demo", reason: "" };
    ctl.init();
    await ctl.refreshAsrStatus();
    ctl.selectVoiceProvider("deepgram");
    expect(ctl.getSnapshot()).toMatchObject({ cloudReady: false, simulation: true });
    ctl.authorizeCloud({ accessCode: "private-code", audience: "adult-demo", consent: true, adultConfirmed: false });
    expect(ctl.getSnapshot().cloudReady).toBe(false);
    ctl.authorizeCloud({ accessCode: "private-code", audience: "approved-pilot", consent: true, adultConfirmed: true });
    expect(ctl.getSnapshot().cloudReady).toBe(false);
    ctl.authorizeCloud({ accessCode: "private-code", audience: "adult-demo", consent: false, adultConfirmed: true } as unknown as CloudVoiceAccess);
    expect(ctl.getSnapshot().cloudReady).toBe(false);
    await ctl.begin();
    expect(mock.transcriberCreate).not.toHaveBeenCalled();
    expect(mock.analyzers[0].running).toBe(false);
  });

  it("uses authorized Deepgram in Opera without Web Speech and keeps credentials out of saved data", async () => {
    mock.speechSupported = false;
    mock.cloudStatus = { enabled: true, mode: "adult-demo", reason: "" };
    ctl.init();
    await ctl.refreshAsrStatus();
    ctl.selectVoiceProvider("deepgram");
    ctl.authorizeCloud({ accessCode: "secret-demo-access", audience: "adult-demo", consent: true, adultConfirmed: true });
    expect(ctl.getSnapshot()).toMatchObject({ simulation: false, simulationForced: null, speechSupported: true, cloudReady: true });
    await ctl.begin();
    await Promise.resolve();
    expect(mock.transcriberCreate).toHaveBeenCalledWith("es", expect.objectContaining({ provider: "deepgram" }));
    hear("Rosa se levantó");
    mock.handlers?.onResult?.({ text: "Rosa se levantó", isFinal: true, words: [{ word: "Rosa", start: 0.2, end: 0.6, confidence: 0.85 }], provider: "deepgram", model: "nova-3", language: "es" });
    expect(ctl.getSnapshot().asrMetadata).toMatchObject({ provider: "deepgram", model: "nova-3", timedWords: 1, firstStart: 0.2, lastEnd: 0.6 });
    expect(JSON.stringify(ctl.getSnapshot())).not.toContain("secret-demo-access");
    ctl.pause();
    ctl.finishLater();
    const exported = getStore().exportAll();
    expect(exported).not.toContain("secret-demo-access");
    expect(exported).not.toContain("nova-3");
    expect(exported).not.toContain("audio/webm");
  });

  it("keeps the draft and question when cloud access is denied", async () => {
    mock.cloudStatus = { enabled: true, mode: "adult-demo", reason: "" };
    ctl.init();
    await ctl.refreshAsrStatus();
    ctl.selectVoiceProvider("deepgram");
    ctl.authorizeCloud({ accessCode: "wrong-code", audience: "adult-demo", consent: true, adultConfirmed: true });
    await ctl.begin();
    await Promise.resolve();
    hear("Rosa se");
    const ctx = ctl.getSnapshot().ctx;
    mock.handlers?.onError?.("not-allowed");
    expect(ctl.getSnapshot()).toMatchObject({ simulation: true, caption: "Rosa se", listening: true, asrConnecting: false });
    expect(ctl.getSnapshot().ctx).toBe(ctx);
    expect(ctl.getSnapshot().micError).toContain("código");
  });

  it("does not score an unconfirmed cloud hypothesis as a completed reading", async () => {
    mock.cloudStatus = { enabled: true, mode: "adult-demo", reason: "" };
    ctl.init();
    await ctl.refreshAsrStatus();
    ctl.selectVoiceProvider("deepgram");
    ctl.authorizeCloud({ accessCode: "access", audience: "adult-demo", consent: true, adultConfirmed: true });
    await ctl.begin();
    await Promise.resolve();
    hear("Rosa se levantó");
    mock.handlers?.onResult?.({ text: "Rosa se levantó", isFinal: false, words: [], provider: "deepgram", model: "nova-3", language: "es" });
    ctl.finishReading();
    await Promise.resolve();
    await Promise.resolve();
    expect(ctl.getSnapshot()).toMatchObject({ simulation: true, caption: "Rosa se levantó", asrFinalizing: false });
    expect(ctl.getSnapshot().ctx?.state).toBe("READ");
    expect(ctl.getSnapshot().micError).toContain("no confirmó");
  });

  it("accepts final provider metadata while flushing stop and persists only minimal provenance", async () => {
    mock.cloudStatus = { enabled: true, mode: "adult-demo", reason: "" };
    ctl.init();
    await ctl.refreshAsrStatus();
    ctl.selectVoiceProvider("deepgram");
    ctl.authorizeCloud({ accessCode: "access", audience: "adult-demo", consent: true, adultConfirmed: true });
    await ctl.begin();
    await Promise.resolve();
    hear("Rosa se levantó");
    let resolve!: (text: string) => void;
    mock.stopPending = new Promise((r) => { resolve = r; });
    ctl.finishReading();
    mock.handlers?.onResult?.({ text: "Rosa se levantó", isFinal: true, words: [{ word: "Rosa", start: 0.1, end: 0.5, confidence: 0.9 }], provider: "deepgram", model: "nova-3", language: "es" });
    resolve("Rosa se levantó");
    await vi.advanceTimersByTimeAsync(0);
    expect(ctl.getSnapshot().ctx?.state).toBe("Q_OBTIENE");
    ctl.pause();
    ctl.finishLater();
    const turn = getStore().loadPaused()?.turns[0] as { transcription: unknown };
    expect(turn.transcription).toEqual({ provider: "deepgram", model: "nova-3", language: "es", timingsAvailable: true, normalization: "asr-may-normalize" });
    expect(getStore().exportAll()).not.toContain('"word": "Rosa"');
  });

  it("does not silently enable cloud voice when the status endpoint is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    ctl.init();
    await ctl.refreshAsrStatus();
    ctl.selectVoiceProvider("deepgram");
    ctl.authorizeCloud({ accessCode: "code", audience: "adult-demo", consent: true, adultConfirmed: true });
    expect(ctl.getSnapshot()).toMatchObject({ cloudStatusLoading: false, cloudReady: false, simulation: true });
    expect(ctl.getSnapshot().cloudStatus?.enabled).toBe(false);
  });

  it("downloads local ASR only after an explicit preparation action and works without Web Speech", async () => {
    mock.speechSupported = false;
    ctl.init();
    ctl.selectVoiceProvider("local-whisper");
    expect(mock.localPrepare).not.toHaveBeenCalled();
    expect(ctl.getSnapshot().simulation).toBe(true);
    await ctl.prepareLocalVoice();
    expect(mock.localPrepare).toHaveBeenCalledOnce();
    expect(ctl.getSnapshot()).toMatchObject({ localReady: true, localPreparing: false, simulation: false, simulationForced: null });
    await ctl.begin();
    await Promise.resolve();
    expect(mock.transcriberCreate).toHaveBeenCalledWith("es", expect.objectContaining({ provider: "local-whisper", cloudAccess: undefined }));
    expect(ctl.getSnapshot()).toMatchObject({ listening: true, usingWebSpeech: false });
  });

  it("keeps manual mode after a failed local model download without cloud fallback", async () => {
    mock.localPrepareError = true;
    ctl.init();
    ctl.selectVoiceProvider("local-whisper");
    await ctl.prepareLocalVoice();
    expect(ctl.getSnapshot()).toMatchObject({ localReady: false, localPreparing: false, simulation: true, voiceProvider: "local-whisper" });
    expect(ctl.getSnapshot().localProgress).toContain("No pudimos");
    expect(mock.transcriberCreate).not.toHaveBeenCalled();
  });

  it("starts the reading clock only after the recognizer is ready and ignores a stale ready callback", async () => {
    mock.delayReady = true;
    await begin();
    expect(ctl.getSnapshot()).toMatchObject({ asrConnecting: true, listening: false, readElapsed: 0 });
    await vi.advanceTimersByTimeAsync(70_000);
    expect(ctl.getSnapshot().ctx?.state).toBe("READ");
    expect(ctl.getSnapshot().readElapsed).toBe(0);
    mock.handlers?.onReady?.();
    await vi.advanceTimersByTimeAsync(1000);
    expect(ctl.getSnapshot()).toMatchObject({ asrConnecting: false, listening: true, readElapsed: 1 });
    const stale = mock.handlers;
    ctl.pause();
    stale?.onReady?.();
    expect(ctl.getSnapshot().ctx?.state).toBe("PAUSED");
    expect(ctl.getSnapshot().listening).toBe(false);
  });

  it("does not count final inference latency as reading time or accept duplicate finish actions", async () => {
    await begin();
    hear("Rosa se levantó");
    await vi.advanceTimersByTimeAsync(5000);
    let resolve!: (text: string) => void;
    mock.stopPending = new Promise((r) => { resolve = r; });
    ctl.finishReading();
    ctl.finishReading();
    expect(ctl.getSnapshot()).toMatchObject({ listening: false, asrFinalizing: true });
    await vi.advanceTimersByTimeAsync(20_000);
    resolve("Rosa se levantó");
    await Promise.resolve();
    await Promise.resolve();
    ctl.pause();
    ctl.finishLater();
    const turns = getStore().loadPaused()?.turns as { readingSeconds: number }[];
    expect(turns[0].readingSeconds).toBe(5);
    expect(turns).toHaveLength(1);
  });
});
