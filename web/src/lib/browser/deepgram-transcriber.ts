import type { Transcriber, TranscriberHandlers } from "./transcriber";
import type { AsrWordTiming, CloudVoiceAccess } from "@/lib/voice/types";

const MIME_TYPES = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4"];
const MAX_DURATION_MS = 180_000;
const START_TIMEOUT_MS = 20_000;
const FLUSH_TIMEOUT_MS = 1800;
const MAX_BUFFER_BYTES = 1_048_576;

interface Segment { start: number; text: string; words: AsrWordTiming[] }
interface Session {
  handlers: TranscriberHandlers;
  abort: AbortController;
  stream: MediaStream | null;
  recorder: MediaRecorder | null;
  socket: WebSocket | null;
  segments: Map<number, Segment>;
  interim: Segment | null;
  text: string;
  finished: boolean;
  stopping: boolean;
  finalizing: boolean;
  startTimer: ReturnType<typeof setTimeout> | null;
  durationTimer: ReturnType<typeof setTimeout> | null;
  flushTimer: ReturnType<typeof setTimeout> | null;
  stopPromise: Promise<string> | null;
  resolveStop: ((text: string) => void) | null;
}

function mimeType(): string | null {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return null;
  return MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
}

function wordTimings(value: unknown): AsrWordTiming[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 6000).flatMap((raw: unknown) => {
    if (!raw || typeof raw !== "object") return [];
    const w = raw as Record<string, unknown>;
    if (typeof w.word !== "string" || typeof w.start !== "number" || typeof w.end !== "number"
      || !Number.isFinite(w.start) || !Number.isFinite(w.end) || w.start < 0 || w.end < w.start || w.end > 200) return [];
    const confidence = typeof w.confidence === "number" && Number.isFinite(w.confidence) && w.confidence >= 0 && w.confidence <= 1 ? w.confidence : null;
    return [{ word: w.word.slice(0, 120), start: w.start, end: w.end, confidence }];
  });
}

/** Direct browser streaming: ephemeral audio only; no expected passage/prompt,
 * diarization, emotion inference, storage, automatic reconnect or key in URL. */
export class DeepgramTranscriber implements Transcriber {
  readonly kind = "deepgram" as const;
  private session: Session | null = null;
  private lastText = "";

  constructor(private access: CloudVoiceAccess) {}

  static isSupported(): boolean {
    return typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function"
      && typeof WebSocket !== "undefined" && mimeType() !== null
      && (typeof window === "undefined" || window.isSecureContext !== false);
  }

  start(handlers: TranscriberHandlers): void {
    this.abort();
    this.lastText = "";
    if (!DeepgramTranscriber.isSupported()) { handlers.onError?.("unsupported"); return; }
    const session: Session = {
      handlers, abort: new AbortController(), stream: null, recorder: null, socket: null,
      segments: new Map(), interim: null, text: "", finished: false, stopping: false,
      finalizing: false, startTimer: null, durationTimer: null, flushTimer: null,
      stopPromise: null, resolveStop: null,
    };
    this.session = session;
    session.startTimer = setTimeout(() => this.fail(session, "asr-unavailable"), START_TIMEOUT_MS);
    void this.connect(session);
  }

  private active(session: Session): boolean { return this.session === session && !session.finished; }

  private async connect(session: Session) {
    try {
      // Ask permission before requesting a 30-second token, not the other way
      // around: a long permission prompt would otherwise consume the TTL.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }, video: false });
      if (!this.active(session) || session.stopping) { stream.getTracks().forEach((track) => track.stop()); return; }
      session.stream = stream;
      const response = await fetch("/api/asr/session", {
        method: "POST", cache: "no-store", credentials: "same-origin", signal: session.abort.signal,
        headers: { "Content-Type": "application/json", "X-Voice-Access-Code": this.access.accessCode },
        body: JSON.stringify({ audience: this.access.audience, consent: this.access.consent, adultConfirmed: this.access.adultConfirmed === true }),
      });
      if (!this.active(session) || session.stopping) return;
      if (!response.ok) { this.fail(session, response.status === 401 || response.status === 403 ? "voice-access-required" : response.status === 429 ? "voice-rate-limit" : "asr-unavailable"); return; }
      const grant = await response.json() as { token?: unknown; expiresAt?: unknown };
      if (!this.active(session) || session.stopping) return;
      if (typeof grant.token !== "string" || !grant.token || typeof grant.expiresAt !== "number"
        || !Number.isFinite(grant.expiresAt) || grant.expiresAt <= Date.now() + 1000) {
        this.fail(session, "asr-session-expired"); return;
      }
      const params = new URLSearchParams({
        model: "nova-3", language: "es-419", interim_results: "true", smart_format: "false",
        punctuate: "true", endpointing: "300", mip_opt_out: "true",
      });
      // Containerized MediaRecorder data self-describes its encoding/sample
      // rate. Claiming it is linear16 PCM would corrupt recognition.
      const socket = new WebSocket(`wss://api.deepgram.com/v1/listen?${params}`, ["bearer", grant.token]);
      session.socket = socket;
      socket.onopen = () => {
        if (!this.active(session) || session.stopping) return;
        try {
          const type = mimeType();
          if (!type) { this.fail(session, "unsupported"); return; }
          const recorder = new MediaRecorder(stream, { mimeType: type });
          session.recorder = recorder;
          recorder.ondataavailable = (event) => {
            if (!this.active(session) || socket.readyState !== WebSocket.OPEN || event.data.size === 0) return;
            if (socket.bufferedAmount > MAX_BUFFER_BYTES || event.data.size > MAX_BUFFER_BYTES) { this.fail(session, "network"); return; }
            try { socket.send(event.data); } catch { this.fail(session, "network"); }
          };
          recorder.onerror = () => this.fail(session, "audio-capture");
          recorder.onstop = () => {
            stream.getTracks().forEach((track) => track.stop());
            if (this.active(session) && session.stopping) this.finalize(session);
          };
          recorder.start(250);
          if (session.startTimer) clearTimeout(session.startTimer);
          session.startTimer = null;
          session.durationTimer = setTimeout(() => this.fail(session, "session-limit"), MAX_DURATION_MS);
          session.handlers.onReady?.();
        } catch { this.fail(session, "audio-capture"); }
      };
      socket.onmessage = (event) => this.receive(session, event.data);
      socket.onerror = () => this.fail(session, "network");
      socket.onclose = () => {
        if (!this.active(session)) return;
        if (session.stopping) this.finish(session);
        else this.fail(session, "network");
      };
    } catch (error) {
      if (!this.active(session)) return;
      const name = error instanceof Error ? error.name : "";
      this.fail(session, name === "NotAllowedError" ? "not-allowed" : name === "NotFoundError" ? "audio-capture" : "asr-unavailable");
    }
  }

  private receive(session: Session, data: unknown) {
    if (!this.active(session) || typeof data !== "string") return;
    if (data.length > MAX_BUFFER_BYTES) { this.fail(session, "asr-unavailable"); return; }
    let event: Record<string, unknown>;
    try { event = JSON.parse(data); } catch { this.fail(session, "asr-unavailable"); return; }
    if (!event || typeof event !== "object") return;
    if (event.type === "Error") { this.fail(session, "asr-unavailable"); return; }
    if (event.type !== "Results") return;
    const channel = event.channel as { alternatives?: { transcript?: unknown; words?: unknown }[] } | undefined;
    const alternative = channel?.alternatives?.[0];
    const isFinal = event.is_final === true;
    if (alternative && typeof alternative.transcript === "string" && typeof event.start === "number"
      && Number.isFinite(event.start) && event.start >= 0 && event.start <= 200) {
      const segment: Segment = { start: event.start, text: alternative.transcript.trim().slice(0, 32_000), words: wordTimings(alternative.words) };
      if (isFinal) {
        if (segment.text) session.segments.set(segment.start, segment);
        if (session.interim && session.interim.start <= segment.start) session.interim = null;
      } else if (!session.segments.has(segment.start)) session.interim = segment;
      const segments = [...session.segments.values(), ...(session.interim ? [session.interim] : [])].sort((a, b) => a.start - b.start);
      session.text = segments.map((s) => s.text).filter(Boolean).join(" ").slice(0, 32_000);
      this.lastText = session.text;
      session.handlers.onText(session.text, isFinal && !session.interim);
      if (this.active(session)) session.handlers.onResult?.({ text: session.text, isFinal: isFinal && !session.interim, words: segments.flatMap((s) => s.words), provider: "deepgram", model: "nova-3", language: "es-419" });
    }
    if (this.active(session) && session.finalizing && event.from_finalize === true) this.finish(session);
  }

  stop(): Promise<string> {
    const session = this.session;
    if (!session || session.finished) return Promise.resolve(this.lastText);
    if (session.stopPromise) return session.stopPromise;
    session.stopping = true;
    session.stopPromise = new Promise((resolve) => { session.resolveStop = resolve; });
    // Bound both MediaRecorder's final chunk and the provider's Finalize reply.
    session.flushTimer = setTimeout(() => this.finish(session), FLUSH_TIMEOUT_MS);
    if (session.recorder && session.recorder.state !== "inactive") {
      try { session.recorder.stop(); } catch { this.finish(session); }
    } else this.finish(session);
    return session.stopPromise;
  }

  private finalize(session: Session) {
    if (!this.active(session) || session.finalizing) return;
    session.finalizing = true;
    if (session.socket?.readyState !== WebSocket.OPEN) { this.finish(session); return; }
    try { session.socket.send(JSON.stringify({ type: "Finalize" })); } catch { this.finish(session); }
  }

  abort(): void { if (this.session) this.finish(this.session); }

  private fail(session: Session, code: string) {
    if (!this.active(session)) return;
    const callback = session.handlers.onError;
    this.finish(session);
    callback?.(code);
  }

  private finish(session: Session) {
    if (session.finished) return;
    session.finished = true;
    session.abort.abort();
    for (const timer of [session.startTimer, session.durationTimer, session.flushTimer]) if (timer) clearTimeout(timer);
    session.startTimer = session.durationTimer = session.flushTimer = null;
    if (session.recorder) {
      session.recorder.ondataavailable = session.recorder.onerror = session.recorder.onstop = null;
      if (session.recorder.state !== "inactive") { try { session.recorder.stop(); } catch { /* already stopped */ } }
    }
    session.stream?.getTracks().forEach((track) => track.stop());
    if (session.socket) {
      session.socket.onopen = session.socket.onmessage = session.socket.onerror = session.socket.onclose = null;
      if (session.socket.readyState === WebSocket.OPEN) { try { session.socket.send(JSON.stringify({ type: "CloseStream" })); } catch { /* closed */ } }
      try { session.socket.close(); } catch { /* closed */ }
    }
    session.recorder = null;
    session.stream = null;
    session.socket = null;
    this.lastText = session.text;
    if (this.session === session) this.session = null;
    session.resolveStop?.(session.text);
    session.resolveStop = null;
    session.segments.clear();
    session.interim = null;
  }
}
