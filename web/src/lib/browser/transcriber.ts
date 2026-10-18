// Speech-to-text behind one small interface so the engine can be swapped:
//  - WebSpeechTranscriber: browser Web Speech API (es-PE). In Chrome the browser's
//    recognizer may send speech to Google servers (the UI says so).
//  - OmnilingualAsrTranscriber: adapter slot for a future Omnilingual ASR (quy_Latn)
//    server. NOT implemented in this MVP (see README).
//  - Simulation mode needs no transcriber: the adult types the turn.

export interface TranscriberHandlers {
  /** Full text so far (final + interim). */
  onText: (text: string, isFinal: boolean) => void;
  onError?: (code: string) => void;
}

export interface Transcriber {
  readonly kind: "web-speech" | "omnilingual";
  start(handlers: TranscriberHandlers): void;
  /** Stops and resolves with the best transcript available. */
  stop(): Promise<string>;
  abort(): void;
}

// Minimal typing for the (prefixed) Web Speech API.
interface SRAlternative { transcript: string }
interface SRResult { isFinal: boolean; 0: SRAlternative; length: number }
interface SREvent { resultIndex: number; results: { length: number; [i: number]: SRResult } }
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SRCtor = new () => SpeechRecognitionLike;

interface RecognitionSession {
  rec: SpeechRecognitionLike | null;
  handlers: TranscriberHandlers;
  committed: string;
  results: { text: string; isFinal: boolean }[];
  stopping: boolean;
  finished: boolean;
  restarts: number;
  restartTimer: ReturnType<typeof setTimeout> | null;
  stopTimer: ReturnType<typeof setTimeout> | null;
  stopPromise: Promise<string> | null;
  resolveStop: ((text: string) => void) | null;
}

const MAX_RESTARTS = 2;
const RESTART_DELAY_MS = 300;
const STOP_TIMEOUT_MS = 900;

function getCtor(): SRCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function speechRecognitionSupported(): boolean {
  return getCtor() !== null;
}

export class WebSpeechTranscriber implements Transcriber {
  readonly kind = "web-speech" as const;
  private session: RecognitionSession | null = null;
  private lastText = "";

  constructor(private lang = "es-PE") {}

  start(handlers: TranscriberHandlers) {
    this.abort();
    this.lastText = "";
    if (typeof window !== "undefined" && window.isSecureContext === false) {
      handlers.onError?.("insecure-context");
      return;
    }
    if (!getCtor()) {
      handlers.onError?.("unsupported");
      return;
    }
    const session: RecognitionSession = {
      rec: null, handlers, committed: "", results: [], stopping: false,
      finished: false, restarts: 0, restartTimer: null, stopTimer: null,
      stopPromise: null, resolveStop: null,
    };
    this.session = session;
    this.beginRecognition(session);
  }

  private beginRecognition(session: RecognitionSession) {
    if (this.session !== session || session.finished || session.stopping) return;
    const Ctor = getCtor();
    if (!Ctor) {
      this.fail(session, "unsupported");
      return;
    }
    let rec: SpeechRecognitionLike;
    try {
      rec = new Ctor();
    } catch {
      this.fail(session, "start-failed");
      return;
    }
    session.rec = rec;
    rec.lang = this.lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    const isCurrent = () => this.session === session && session.rec === rec && !session.finished;
    rec.onresult = (e) => {
      if (!isCurrent()) return;
      // The result list is cumulative for this recognizer. Replacing it handles
      // repeated final events and interim corrections without duplicating words.
      const results: RecognitionSession["results"] = [];
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r?.[0]) results.push({ text: r[0].transcript.trim(), isFinal: r.isFinal });
      }
      session.results = results;
      this.lastText = this.text(session);
      session.handlers.onText(this.lastText, results.every((r) => r.isFinal));
    };
    rec.onerror = (e) => {
      if (!isCurrent()) return;
      if (session.stopping) this.finish(session, true);
      else this.fail(session, e.error);
    };
    rec.onend = () => {
      if (!isCurrent()) return;
      this.detach(rec);
      session.rec = null;
      if (session.stopping) {
        this.finish(session);
        return;
      }
      // Some services close continuous recognition normally. Retry only a small
      // bounded number of times, never after a service/network/no-speech error.
      if (session.restarts >= MAX_RESTARTS) {
        this.fail(session, "recognition-ended");
        return;
      }
      session.committed = this.text(session);
      session.results = [];
      session.restarts++;
      session.restartTimer = setTimeout(() => {
        session.restartTimer = null;
        this.beginRecognition(session);
      }, RESTART_DELAY_MS);
    };
    try {
      rec.start();
    } catch {
      this.fail(session, "start-failed");
    }
  }

  private text(session: RecognitionSession) {
    return [session.committed, ...session.results.map((r) => r.text)].filter(Boolean).join(" ").trim();
  }

  stop(): Promise<string> {
    const session = this.session;
    if (!session) return Promise.resolve(this.lastText);
    if (session.stopPromise) return session.stopPromise;
    session.stopping = true;
    if (session.restartTimer) clearTimeout(session.restartTimer);
    session.restartTimer = null;
    const promise = new Promise<string>((resolve) => { session.resolveStop = resolve; });
    session.stopPromise = promise;
    if (!session.rec) {
      this.finish(session);
    } else {
      session.stopTimer = setTimeout(() => this.finish(session, true), STOP_TIMEOUT_MS);
      try {
        session.rec.stop();
      } catch {
        this.finish(session, true);
      }
    }
    return promise;
  }

  abort() {
    if (this.session) this.finish(this.session, true);
  }

  private fail(session: RecognitionSession, code: string) {
    if (this.session !== session || session.finished) return;
    // Release first: a handler can synchronously start another turn.
    this.finish(session, true);
    session.handlers.onError?.(code);
  }

  private detach(rec: SpeechRecognitionLike) {
    rec.onresult = null;
    rec.onerror = null;
    rec.onend = null;
  }

  private finish(session: RecognitionSession, abort = false) {
    if (session.finished) return;
    session.finished = true;
    if (session.restartTimer) clearTimeout(session.restartTimer);
    if (session.stopTimer) clearTimeout(session.stopTimer);
    const rec = session.rec;
    session.rec = null;
    if (rec) {
      this.detach(rec);
      if (abort) {
        try { rec.abort(); } catch { /* already released by the browser */ }
      }
    }
    const text = this.text(session);
    if (this.session === session) {
      this.lastText = text;
      this.session = null;
    }
    session.resolveStop?.(text);
    session.resolveStop = null;
  }
}

/**
 * Adapter slot for a future Omnilingual ASR server (Quechua Chanka, quy_Latn).
 * Intended to talk to a server running on the same device or the school's local
 * network so audio does not leave the family's/school's control. Not implemented.
 */
export class OmnilingualAsrTranscriber implements Transcriber {
  readonly kind = "omnilingual" as const;
  constructor(readonly endpoint: string) {}
  static isConfigured(): boolean {
    return false;
  }
  start(handlers: TranscriberHandlers) {
    handlers.onError?.("not-implemented");
  }
  stop(): Promise<string> {
    return Promise.resolve("");
  }
  abort() {}
}

export function createTranscriber(lang: "es" | "qu"): Transcriber | null {
  if (lang === "qu") return OmnilingualAsrTranscriber.isConfigured() ? new OmnilingualAsrTranscriber("") : null;
  return speechRecognitionSupported() ? new WebSpeechTranscriber("es-PE") : null;
}
