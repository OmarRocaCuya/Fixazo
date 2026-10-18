import type { CloudVoiceAccess } from "@/lib/voice/types";
import { MetaReadingClient, ReadingChunkQueue, ReadingClientError } from "./meta-reading-client";
import { ReadingPcmCapture, type ReadingPcmCaptureOptions } from "./reading-pcm-capture";

export interface QuizAudioTranscript { stepId: string; text: string }
export interface QuizMicrophoneState {
  status: "idle" | "starting" | "listening" | "stopped" | "error";
  remainingSeconds: number;
  message: string;
}
interface Capture { start(): Promise<boolean>; abort(): void }
interface Client { transcribe(audio: Blob, language: "spa_Latn"): Promise<{ text: string }>; cancel(): void; close(): void }
interface Dependencies {
  capture(options: ReadingPcmCaptureOptions): Capture;
  client(access: CloudVoiceAccess): Client;
  visible(): boolean;
  now(): number;
}
interface Session {
  epoch: number; client: Client; capture: Capture | null; queue: ReadingChunkQueue<Chunk>;
  timer: ReturnType<typeof setInterval> | null; startedAt: number; ready: boolean;
  boundaryStep: string | null; boundaryVersion: number;
}
interface Chunk { audio: Blob; stepId: string; version: number }
export const QUIZ_AUDIO_MAX_SECONDS = 600;
const defaults: Dependencies = {
  capture: (options) => new ReadingPcmCapture(options), client: (access) => new MetaReadingClient(access),
  visible: () => typeof document !== "undefined" && document.visibilityState !== "hidden", now: () => Date.now(),
};

/** One foreground-only microphone; no persistence, emotion inference or automatic submission. */
export class QuizMicrophone {
  private session: Session | null = null;
  private epoch = 0;
  private stepId: string | null = null;
  private stepVersion = 0;
  private disposed = false;
  constructor(private readonly handlers: {
    onTranscript(event: QuizAudioTranscript): void;
    onState(state: QuizMicrophoneState): void;
  }, private readonly deps: Dependencies = defaults) {}

  /** Changing questions never assigns a boundary-spanning chunk to either answer. */
  setStep(stepId: string | null) {
    if (stepId === this.stepId) return;
    this.stepId = stepId; this.stepVersion++;
    const session = this.session;
    if (session) {
      session.queue.cancel(); session.client.cancel(); session.queue = this.queue(session);
      this.emit(session.ready ? "listening" : "starting", "Preparando la nueva pregunta; se descarta el fragmento de audio anterior para no mezclar respuestas.", session);
    }
  }

  async start(access: CloudVoiceAccess, stepId: string | null): Promise<boolean> {
    if (this.disposed || this.session || !this.deps.visible()) return false;
    this.setStep(stepId);
    const client = this.deps.client({ ...access });
    const session: Session = { epoch: ++this.epoch, client, capture: null, queue: null!, timer: null,
      startedAt: this.deps.now(), ready: false, boundaryStep: this.stepId, boundaryVersion: this.stepVersion };
    session.queue = this.queue(session); this.session = session;
    this.emit("starting", "Esperando permiso del micrófono…", session);
    session.timer = setInterval(() => {
      if (!this.current(session)) return;
      if (!this.deps.visible()) { this.pause("Micrófono detenido al salir de esta pantalla. Pulsa Iniciar para retomarlo."); return; }
      if (this.remaining(session) <= 0) { this.pause("Se alcanzó el límite de 10 minutos. Pulsa Iniciar para una nueva práctica."); return; }
      this.emit(session.ready ? "listening" : "starting", !session.ready ? "Esperando permiso del micrófono…" : session.boundaryVersion !== this.stepVersion
        ? "Preparando la nueva pregunta; se descarta el fragmento de audio anterior para no mezclar respuestas." : "Micrófono activo durante el quiz. Puedes pausarlo cuando quieras.", session);
    }, 1000);
    return this.segment(session);
  }

  private current(session: Session) { return this.session === session && session.epoch === this.epoch && !this.disposed; }
  private remaining(session: Session) { return Math.max(0, QUIZ_AUDIO_MAX_SECONDS - Math.floor((this.deps.now() - session.startedAt) / 1000)); }
  private emit(status: QuizMicrophoneState["status"], message: string, session?: Session) {
    this.handlers.onState({ status, message, remainingSeconds: session ? this.remaining(session) : 0 });
  }
  private queue(session: Session): ReadingChunkQueue<Chunk> {
    const queueVersion = this.stepVersion;
    return new ReadingChunkQueue(async (chunk) => {
      if (!this.current(session) || chunk.version !== this.stepVersion || chunk.stepId !== this.stepId) return;
      let result: { text: string };
      try { result = await session.client.transcribe(chunk.audio, "spa_Latn"); }
      catch (error) {
        // Silence/no observable words are absence of evidence, not an answer or a service failure.
        if (error instanceof ReadingClientError && ["audio-not-observable", "asr-not-observable", "no-observable-words"].includes(error.code)) return;
        throw error;
      }
      if (!this.current(session) || chunk.version !== this.stepVersion || chunk.stepId !== this.stepId) return;
      const text = result.text.trim();
      if (text) this.handlers.onTranscript({ stepId: chunk.stepId, text: text.slice(0, 800) });
    }, (error) => {
      if (!this.current(session) || queueVersion !== this.stepVersion) return;
      const code = error instanceof ReadingClientError ? error.code : "";
      this.fail(code === "voice-rate-limit"
        ? "Se alcanzó el límite temporal del servidor. Micrófono detenido; espera unos minutos o continúa escribiendo."
        : code === "indigenous-busy"
          ? "El modelo de voz está ocupado. Micrófono detenido; espera y pulsa Iniciar o continúa escribiendo."
          : "No se pudo transcribir. El micrófono se detuvo; puedes escribir o reintentar.");
    });
  }
  private async segment(session: Session): Promise<boolean> {
    if (!this.current(session) || !this.deps.visible()) return false;
    const maximum = Math.min(60, this.remaining(session));
    if (maximum <= 0) { this.pause("Se alcanzó el límite de 10 minutos. Pulsa Iniciar para retomarlo."); return false; }
    session.boundaryStep = this.stepId; session.boundaryVersion = this.stepVersion;
    const capture = this.deps.capture({ chunkSeconds: 8, maxSeconds: maximum,
      onChunk: (audio) => {
        if (!this.current(session) || session.capture !== capture) return;
        const stepId = session.boundaryStep, version = session.boundaryVersion;
        session.boundaryStep = this.stepId; session.boundaryVersion = this.stepVersion;
        if (!this.deps.visible()) { this.pause("Micrófono detenido al salir de esta pantalla."); return; }
        if (!stepId || stepId !== this.stepId || version !== this.stepVersion) return;
        if (!session.queue.enqueue({ audio, stepId, version })) this.fail("La transcripción está ocupada. Micrófono detenido para no acumular audio; puedes reintentar o escribir.");
      },
      onLimit: () => {
        if (!this.current(session) || session.capture !== capture) return;
        session.capture = null;
        // PCM releases its stream synchronously before onLimit; renew only this active foreground session.
        if (this.deps.visible() && this.remaining(session) > 0) void this.segment(session);
        else this.pause("Se alcanzó el límite de audio o saliste de la pantalla. Pulsa Iniciar para retomar.");
      },
      onError: () => { if (this.current(session) && session.capture === capture) this.fail("No se pudo abrir el micrófono. Revisa el permiso del navegador o responde escribiendo."); },
    });
    session.capture = capture;
    let started = false;
    try { started = await capture.start(); } catch { /* common failure handling below releases this capture */ }
    if (!this.current(session) || session.capture !== capture) { capture.abort(); return false; }
    if (!started) { this.fail("Micrófono no disponible. Puedes escribir o pulsar Iniciar para reintentar."); return false; }
    if (!this.deps.visible()) { this.pause("Micrófono detenido al salir de esta pantalla."); return false; }
    session.ready = true;
    this.emit("listening", "Micrófono activo durante el quiz. Puedes pausarlo cuando quieras.", session);
    return true;
  }
  pause(message = "Micrófono pausado. Pulsa Iniciar para retomarlo.") { this.release(); if (!this.disposed) this.emit("stopped", message); }
  private fail(message: string) { this.release(); if (!this.disposed) this.emit("error", message); }
  private release() {
    const session = this.session; this.session = null; this.epoch++;
    if (!session) return;
    if (session.timer) clearInterval(session.timer);
    session.capture?.abort(); session.queue.cancel(); session.client.close();
    session.capture = null;
  }
  dispose() { this.release(); this.disposed = true; }
}
