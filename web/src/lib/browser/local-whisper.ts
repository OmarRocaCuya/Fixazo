import type { Transcriber, TranscriberHandlers } from "./transcriber";
import type { AsrWordTiming } from "@/lib/voice/types";

/** Local inference only. Importing this module never downloads the model. */
export const LOCAL_ASR_MODEL = "onnx-community/whisper-base_timestamped";
const SAMPLE_RATE = 16_000;
const MAX_SECONDS = 60;
const PREVIEW_INTERVAL_MS = 8_000;
const LOAD_TIMEOUT_MS = 300_000;
const INFERENCE_TIMEOUT_MS = 180_000;

export interface LocalAsrProgress {
  loaded: number;
  total: number;
  progress: number;
  message: string;
}

export type LocalAsrErrorCode =
  | "local-asr-unsupported" | "local-asr-not-ready" | "local-asr-cancelled"
  | "local-asr-download" | "local-asr-inference" | "local-asr-timeout"
  | "local-asr-invalid-result" | "local-asr-busy";

export class LocalAsrError extends Error {
  constructor(readonly code: LocalAsrErrorCode) { super(code); this.name = "LocalAsrError"; }
}

export type LocalWhisperRequest =
  | { type: "load"; id: number }
  | { type: "transcribe"; id: number; audio: Float32Array };
export type LocalWhisperResponse =
  | { type: "progress"; id: number; file?: string; loaded?: number; total?: number; progress?: number }
  | { type: "ready"; id: number }
  | { type: "result"; id: number; output: unknown }
  | { type: "error"; id: number; code: LocalAsrErrorCode };

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: LocalAsrError) => void;
  timer: ReturnType<typeof setTimeout>;
}

/** A single prepared worker is reused, but never stores recorded audio. */
class LocalWorker {
  readonly worker: Worker;
  ready = false;
  private sequence = 0;
  private pending = new Map<number, PendingRequest>();
  private listeners = new Set<(progress: LocalAsrProgress) => void>();
  private files = new Map<string, { loaded: number; total: number }>();
  private preparation: Promise<void> | null = null;
  private inference: Promise<unknown> | null = null;
  private closed = false;

  constructor() {
    this.worker = new Worker(new URL("./local-whisper.worker.ts", import.meta.url), { type: "module" });
    this.worker.onmessage = (event: MessageEvent<LocalWhisperResponse>) => this.receive(event.data);
    this.worker.onerror = () => this.close(new LocalAsrError(this.ready ? "local-asr-inference" : "local-asr-download"));
    this.worker.onmessageerror = () => this.close(new LocalAsrError("local-asr-invalid-result"));
  }

  prepare(listener?: (progress: LocalAsrProgress) => void): Promise<void> {
    if (listener) this.listeners.add(listener);
    if (this.ready) { listener?.({ loaded: 0, total: 0, progress: 100, message: "Modelo local listo" }); return Promise.resolve(); }
    if (!this.preparation) {
      this.preparation = this.request({ type: "load" }, LOAD_TIMEOUT_MS).then(() => { this.ready = true; });
    }
    return this.preparation.finally(() => { if (listener) this.listeners.delete(listener); });
  }

  transcribe(audio: Float32Array): Promise<unknown> {
    if (!this.ready || this.closed) return Promise.reject(new LocalAsrError("local-asr-not-ready"));
    if (this.inference) return Promise.reject(new LocalAsrError("local-asr-busy"));
    const promise = this.request({ type: "transcribe", audio }, INFERENCE_TIMEOUT_MS);
    this.inference = promise;
    void promise.then(() => { if (this.inference === promise) this.inference = null; }, () => { if (this.inference === promise) this.inference = null; });
    return promise;
  }

  async whenIdle(): Promise<void> { try { await this.inference; } catch { /* the next turn checks worker readiness */ } }

  private request(request: { type: "load" } | { type: "transcribe"; audio: Float32Array }, timeout: number): Promise<unknown> {
    if (this.closed) return Promise.reject(new LocalAsrError("local-asr-cancelled"));
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.close(new LocalAsrError("local-asr-timeout")), timeout);
      this.pending.set(id, { resolve, reject, timer });
      try {
        const message = { ...request, id } as LocalWhisperRequest;
        this.worker.postMessage(message, request.type === "transcribe" ? [request.audio.buffer] : []);
      } catch { this.close(new LocalAsrError("local-asr-inference")); }
    });
  }

  private receive(message: LocalWhisperResponse) {
    if (this.closed || !message || typeof message !== "object" || !Number.isInteger(message.id)) return;
    const pending = this.pending.get(message.id);
    if (!pending) return; // Late results from a cancelled/replaced request have no authority.
    if (message.type === "progress") {
      const finite = (value: unknown, fallback = 0) => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
      const file = message.file ?? "model";
      const previous = this.files.get(file);
      // Hub initiate/done events do not carry byte counters: don't erase the
      // last known size/progress when those events follow a download event.
      this.files.set(file, { loaded: finite(message.loaded, previous?.loaded), total: finite(message.total, previous?.total) });
      const values = [...this.files.values()];
      const loaded = values.reduce((sum, file) => sum + file.loaded, 0);
      const total = values.reduce((sum, file) => sum + file.total, 0);
      const progress = total > 0 ? Math.min(99, loaded / total * 100) : Math.min(99, finite(message.progress));
      for (const listener of this.listeners) listener({ loaded, total, progress, message: "Descargando el modelo local (~80 MB más componentes)…" });
      return;
    }
    clearTimeout(pending.timer);
    this.pending.delete(message.id);
    if (message.type === "ready") {
      this.ready = true;
      for (const listener of this.listeners) listener({ loaded: 0, total: 0, progress: 100, message: "Modelo local listo" });
      pending.resolve(undefined);
    } else if (message.type === "result") pending.resolve(message.output);
    else if (message.type === "error") {
      pending.reject(new LocalAsrError(message.code));
      // A failed initialization must be retryable, never look prepared.
      if (!this.ready) this.close(new LocalAsrError(message.code));
    } else this.close(new LocalAsrError("local-asr-invalid-result"));
  }

  close(error = new LocalAsrError("local-asr-cancelled")) {
    if (this.closed) return;
    this.closed = true;
    this.ready = false;
    this.worker.onmessage = this.worker.onerror = this.worker.onmessageerror = null;
    this.worker.terminate();
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(error); }
    this.pending.clear();
    this.listeners.clear();
    if (preparedWorker === this) preparedWorker = null;
  }
}

let preparedWorker: LocalWorker | null = null;
const activeTranscribers = new Set<LocalWhisperTranscriber>();

/** Explicit adult opt-in only. This is the sole entry point that starts a download. */
export function prepareLocalAsr(onProgress?: (progress: LocalAsrProgress) => void): Promise<void> {
  if (typeof Worker === "undefined") return Promise.reject(new LocalAsrError("local-asr-unsupported"));
  try { preparedWorker ??= new LocalWorker(); return preparedWorker.prepare(onProgress); }
  catch { return Promise.reject(new LocalAsrError("local-asr-download")); }
}

export function localAsrReady(): boolean { return preparedWorker?.ready === true; }

/** Explicit page disposal/cancel: stops capture, cancels work and releases model RAM. */
export function releaseLocalAsr(): void {
  for (const transcriber of [...activeTranscribers]) transcriber.abort();
  preparedWorker?.close();
}

/** Box-filter downsampling preserves duration; never relabel 44.1/48 kHz as 16 kHz. */
export function resampleLocalAudio(input: Float32Array, sourceRate: number): Float32Array {
  if (!Number.isFinite(sourceRate) || sourceRate < 8_000 || sourceRate > 192_000) throw new LocalAsrError("local-asr-inference");
  if (sourceRate === SAMPLE_RATE) return input.slice();
  const ratio = sourceRate / SAMPLE_RATE;
  const output = new Float32Array(Math.round(input.length / ratio));
  for (let i = 0; i < output.length; i++) {
    const start = i * ratio;
    if (ratio < 1) {
      const left = Math.min(input.length - 1, Math.floor(start));
      const right = Math.min(input.length - 1, left + 1);
      output[i] = (input[left] ?? 0) + ((input[right] ?? 0) - (input[left] ?? 0)) * (start - left);
    } else {
      const end = Math.min(input.length, start + ratio);
      let sum = 0;
      for (let j = Math.floor(start); j < end; j++) sum += (input[j] ?? 0) * (Math.min(j + 1, end) - Math.max(j, start));
      output[i] = end > start ? sum / (end - start) : 0;
    }
  }
  return output;
}

/** Local energy gate, not an emotion/person/health classifier or validated VAD. */
export function localSpeechActivity(samples: Float32Array): boolean {
  if (!samples.length) return false;
  let energy = 0; let peak = 0; let crossings = 0;
  for (let i = 0; i < samples.length; i++) {
    const value = samples[i];
    if (!Number.isFinite(value)) return false;
    energy += value * value;
    peak = Math.max(peak, Math.abs(value));
    if (i && (value >= 0) !== (samples[i - 1] >= 0)) crossings++;
  }
  const crossingRate = crossings / samples.length;
  return Math.sqrt(energy / samples.length) >= 0.012 && peak >= 0.035 && crossingRate > 0.003 && crossingRate < 0.4;
}

export function parseLocalWhisperResult(raw: unknown, offsetSeconds: number, durationSeconds: number): { text: string; words: AsrWordTiming[] } {
  if (!raw || typeof raw !== "object" || !Number.isFinite(offsetSeconds) || offsetSeconds < 0
    || !Number.isFinite(durationSeconds) || durationSeconds < 0) throw new LocalAsrError("local-asr-invalid-result");
  const value = raw as { text?: unknown; chunks?: unknown };
  if (typeof value.text !== "string" || value.text.length > 32_000) throw new LocalAsrError("local-asr-invalid-result");
  const chunks = Array.isArray(value.chunks) ? value.chunks.slice(0, 6_000) : [];
  const words: AsrWordTiming[] = chunks.flatMap((chunk: unknown) => {
    if (!chunk || typeof chunk !== "object") return [];
    const item = chunk as { text?: unknown; timestamp?: unknown };
    if (typeof item.text !== "string" || !item.text.trim() || !Array.isArray(item.timestamp)) return [];
    const [start, end] = item.timestamp;
    if (typeof start !== "number" || typeof end !== "number" || !Number.isFinite(start) || !Number.isFinite(end)
      || start < 0 || end < start || end > durationSeconds + 0.5) return [];
    return [{ word: item.text.trim().slice(0, 120), start: offsetSeconds + Math.min(start, durationSeconds), end: offsetSeconds + Math.min(end, durationSeconds), confidence: null }];
  });
  return { text: value.text.trim(), words };
}

interface LocalSession {
  handlers: TranscriberHandlers;
  worker: LocalWorker;
  stream: MediaStream | null;
  context: AudioContext | null;
  source: MediaStreamAudioSourceNode | null;
  processor: ScriptProcessorNode | null;
  mute: GainNode | null;
  frames: Float32Array[];
  totalSamples: number;
  sourceRate: number;
  firstSpeech: number | null;
  lastSpeech: number;
  speechSamples: number;
  previewSamples: number;
  preview: Promise<void> | null;
  text: string;
  finished: boolean;
  stopping: boolean;
  ready: boolean;
  startTimer: ReturnType<typeof setTimeout> | null;
  durationTimer: ReturnType<typeof setTimeout> | null;
  previewTimer: ReturnType<typeof setInterval> | null;
  stopPromise: Promise<string> | null;
  resolveStop: ((text: string) => void) | null;
}

function audioContextConstructor(): typeof AudioContext | undefined {
  if (typeof AudioContext !== "undefined") return AudioContext;
  return typeof window !== "undefined" ? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext : undefined;
}

/** Approximate local ASR: bounded prefix previews, with a definitive full-turn pass.
 * No network audio, expected-passage prompt, identity, inferred emotion or storage. */
export class LocalWhisperTranscriber implements Transcriber {
  readonly kind = "local-whisper" as const;
  private session: LocalSession | null = null;
  private lastText = "";

  static isSupported(): boolean {
    return typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function"
      && typeof Worker !== "undefined" && !!audioContextConstructor()
      && (typeof window === "undefined" || window.isSecureContext !== false);
  }

  start(handlers: TranscriberHandlers): void {
    this.abort(); this.lastText = "";
    if (!LocalWhisperTranscriber.isSupported()) { handlers.onError?.("local-asr-unsupported"); return; }
    const worker = preparedWorker;
    if (!worker?.ready) { handlers.onError?.("local-asr-not-ready"); return; }
    const session: LocalSession = {
      handlers, worker, stream: null, context: null, source: null, processor: null, mute: null,
      frames: [], totalSamples: 0, sourceRate: SAMPLE_RATE, firstSpeech: null, lastSpeech: 0,
      speechSamples: 0, previewSamples: 0, preview: null, text: "", finished: false, stopping: false,
      ready: false, startTimer: null, durationTimer: null, previewTimer: null, stopPromise: null, resolveStop: null,
    };
    this.session = session; activeTranscribers.add(this);
    void this.capture(session);
  }

  private active(session: LocalSession): boolean { return this.session === session && !session.finished; }

  private async capture(session: LocalSession) {
    try {
      // An aborted turn's inference cannot be cancelled without unloading its
      // model. Wait for it off-clock rather than race a new turn into the worker.
      await session.worker.whenIdle();
      if (!this.active(session) || session.stopping) return;
      if (!session.worker.ready) { this.fail(session, "local-asr-not-ready"); return; }
      session.startTimer = setTimeout(() => this.fail(session, "audio-capture"), 30_000);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }, video: false });
      if (!this.active(session) || session.stopping) { stream.getTracks().forEach((track) => track.stop()); return; }
      session.stream = stream;
      const Ctor = audioContextConstructor();
      if (!Ctor) throw new Error("AudioContext unavailable");
      const context = new Ctor();
      session.context = context;
      session.sourceRate = context.sampleRate;
      if (!Number.isFinite(context.sampleRate) || context.sampleRate < 8_000 || context.sampleRate > 192_000) throw new Error("Invalid sample rate");
      session.source = context.createMediaStreamSource(stream);
      // A dedicated worker does inference. The deprecated-but-broadly-supported
      // capture node is deliberately kept tiny; it only copies/gates PCM frames.
      session.processor = context.createScriptProcessor(4096, 1, 1);
      session.mute = context.createGain(); session.mute.gain.value = 0;
      session.processor.onaudioprocess = (event) => this.audio(session, event.inputBuffer.getChannelData(0));
      session.source.connect(session.processor); session.processor.connect(session.mute); session.mute.connect(context.destination);
      if (context.state === "suspended") await context.resume();
      if (!this.active(session) || session.stopping) return;
      if (session.startTimer) clearTimeout(session.startTimer); session.startTimer = null;
      session.ready = true;
      session.durationTimer = setTimeout(() => { if (this.active(session)) void this.stop(); }, MAX_SECONDS * 1000);
      session.previewTimer = setInterval(() => this.preview(session), PREVIEW_INTERVAL_MS);
      session.handlers.onReady?.();
    } catch (error) {
      if (!this.active(session)) return;
      this.fail(session, error instanceof Error && error.name === "NotAllowedError" ? "not-allowed" : "audio-capture");
    }
  }

  private audio(session: LocalSession, frame: Float32Array) {
    if (!this.active(session) || session.stopping || !session.ready) return;
    const remaining = Math.max(0, Math.floor(session.sourceRate * MAX_SECONDS) - session.totalSamples);
    if (!remaining) { void this.stop(); return; }
    const samples = frame.slice(0, remaining);
    if (localSpeechActivity(samples)) {
      session.firstSpeech ??= session.totalSamples;
      session.lastSpeech = session.totalSamples + samples.length;
      session.speechSamples += samples.length;
    }
    session.frames.push(samples); session.totalSamples += samples.length;
  }

  private snapshot(session: LocalSession): { audio: Float32Array; offset: number; duration: number } | null {
    if (session.firstSpeech === null || session.speechSamples < session.sourceRate * 0.15) return null;
    // Crop only leading/trailing silence; interior pauses retain their timeline.
    const start = Math.max(0, Math.floor(session.firstSpeech - session.sourceRate * 0.25));
    const end = Math.min(session.totalSamples, Math.ceil(session.lastSpeech + session.sourceRate * 0.35));
    const joined = new Float32Array(end - start);
    let cursor = 0;
    for (const frame of session.frames) {
      const left = Math.max(start, cursor); const right = Math.min(end, cursor + frame.length);
      if (right > left) joined.set(frame.subarray(left - cursor, right - cursor), left - start);
      cursor += frame.length; if (cursor >= end) break;
    }
    const audio = resampleLocalAudio(joined, session.sourceRate);
    return { audio, offset: start / session.sourceRate, duration: audio.length / SAMPLE_RATE };
  }

  private preview(session: LocalSession) {
    if (!this.active(session) || session.stopping || session.preview || session.totalSamples > session.sourceRate * 30
      || session.lastSpeech <= session.previewSamples) return;
    const snapshot = this.snapshot(session); if (!snapshot) return;
    session.previewSamples = session.lastSpeech;
    const promise = session.worker.transcribe(snapshot.audio).then((output) => {
      if (this.active(session) && !session.stopping) this.emit(session, parseLocalWhisperResult(output, snapshot.offset, snapshot.duration), false);
    }).catch((error: unknown) => { if (this.active(session)) this.fail(session, error instanceof LocalAsrError ? error.code : "local-asr-inference"); });
    session.preview = promise;
    void promise.finally(() => { if (session.preview === promise) session.preview = null; });
  }

  stop(): Promise<string> {
    const session = this.session;
    if (!session) return Promise.resolve(this.lastText);
    if (session.stopPromise) return session.stopPromise;
    session.stopping = true;
    session.stopPromise = new Promise((resolve) => { session.resolveStop = resolve; });
    this.releaseCapture(session);
    if (!session.ready) this.finish(session);
    else void this.complete(session);
    return session.stopPromise;
  }

  private async complete(session: LocalSession) {
    try {
      await session.preview;
      if (!this.active(session)) return;
      const snapshot = this.snapshot(session);
      if (snapshot) {
        const output = await session.worker.transcribe(snapshot.audio);
        if (!this.active(session)) return;
        this.emit(session, parseLocalWhisperResult(output, snapshot.offset, snapshot.duration), true);
      } else this.emit(session, { text: "", words: [] }, true);
      this.finish(session);
    } catch (error) { if (this.active(session)) this.fail(session, error instanceof LocalAsrError ? error.code : "local-asr-inference"); }
  }

  private emit(session: LocalSession, result: { text: string; words: AsrWordTiming[] }, isFinal: boolean) {
    session.text = result.text; this.lastText = result.text;
    session.handlers.onText(result.text, isFinal);
    if (this.active(session)) session.handlers.onResult?.({ ...result, isFinal, provider: "local-whisper", model: LOCAL_ASR_MODEL, language: "es" });
  }

  /** Cancels this turn only; the explicit model preparation remains reusable. */
  abort(): void { if (this.session) this.finish(this.session); }

  private fail(session: LocalSession, code: string) {
    if (!this.active(session)) return;
    const callback = session.handlers.onError; this.finish(session); callback?.(code);
  }

  private releaseCapture(session: LocalSession) {
    if (session.startTimer) clearTimeout(session.startTimer);
    if (session.durationTimer) clearTimeout(session.durationTimer);
    if (session.previewTimer) clearInterval(session.previewTimer);
    session.startTimer = session.durationTimer = session.previewTimer = null;
    if (session.processor) session.processor.onaudioprocess = null;
    for (const node of [session.source, session.processor, session.mute]) { try { node?.disconnect(); } catch { /* already released */ } }
    session.source = session.processor = session.mute = null;
    session.stream?.getTracks().forEach((track) => track.stop()); session.stream = null;
    if (session.context) { void session.context.close().catch(() => {}); session.context = null; }
  }

  private finish(session: LocalSession) {
    if (session.finished) return;
    session.finished = true; this.releaseCapture(session); session.frames = [];
    if (this.session === session) { this.lastText = session.text; this.session = null; activeTranscribers.delete(this); }
    session.resolveStop?.(session.text); session.resolveStop = null;
  }
}
