// Session orchestrator for the browser. Owns the state machine, the agent voice,
// the transcriber and the on-device audio analyzer, and exposes an immutable
// snapshot to React (useSyncExternalStore).
import type { Confidence, Decision, FrameFeature, Mission, Mood, Permissions, Profile, TranscriptionProvenance, TurnRecord, TurnState } from "@/lib/types";
import { initialContext, start, transition, type Effect, type MachineContext, type MachineEvent, type Utterance } from "@/lib/session/machine";
import { liveReadingProgress, readingMetrics } from "@/lib/signals/reading";
import { summarizeTurnAudio } from "@/lib/signals/summary";
import { detectLongPauses, f0RangeSemitones, prosodyScore, speechOnset } from "@/lib/signals/prosody";
import { classifyPace, computeBaseline, paceFeatures, shouldOfferBreak, type PaceFeatures } from "@/lib/signals/pace";
import { noiseFloorDb } from "@/lib/signals/context";
import { answerLength } from "@/lib/signals/text";
import { mapModelResult, unavailableAffect, type AffectEstimate, type EmotionModelResult } from "@/lib/signals/affect";
import { capSeconds, encodeWav16, mixToMono, resampleTo16k, TARGET_RATE } from "@/lib/audio/wav";
import { EmotionClientError, requestEmotionModel } from "@/lib/browser/emotion-client";
import { buildReport, type JudgeOutcome } from "@/lib/report/build";
import { getStore, type PausedSession } from "@/lib/storage";
import { notifyStore } from "@/lib/useStore";
import { AgentVoice } from "@/lib/browser/tts";
import { AudioAnalyzer } from "@/lib/browser/audio";
import { createTranscriber, type Transcriber } from "@/lib/browser/transcriber";
import { getVoiceSupport, voiceErrorMessage, type VoiceSupport } from "@/lib/browser/voice-support";
import type { JudgeResponse } from "@/lib/judge/rubric";
import type { AsrResult, CloudVoiceAccess, VoicePolicyStatus } from "@/lib/voice/types";
import { localAsrReady, prepareLocalAsr, releaseLocalAsr } from "@/lib/browser/local-whisper";

export const READ_LIMIT_S = 60;
const NO_RESPONSE_MS = 8000;
const END_OF_TURN_MS = 2500;
const MOOD_TIMEOUT_MS = 15000;
const BARGE_IN_RMS = 0.06;
const BARGE_IN_FRAMES = 8;

export type Phase = "loading" | "no-mission" | "intro" | "running" | "saving" | "finished" | "error";

export interface KidLine {
  who: "agente" | "nino";
  show: string;
  showEs?: string;
}

export interface LiveSignals {
  pcpm: number | null;
  accuracy: number | null;
  selfCorrections: number;
  longPauses: number | null;
  prosody: number | null;
  differentIdx: number[];
  noise: "ok" | "alto" | null;
}

export type SessionAsrProvider = "browser" | "deepgram" | "local-whisper";

/** Live diagnostics only: no credentials, audio or per-word transcript is saved. */
export interface AsrMetadata {
  provider: AsrResult["provider"];
  model: string;
  language: string;
  timedWords: number;
  firstStart: number | null;
  lastEnd: number | null;
  isFinal: boolean;
}

export interface Snapshot {
  phase: Phase;
  error: string | null;
  mission: Mission | null;
  profile: Profile | null;
  permissions: Permissions;
  ctx: MachineContext | null;
  utterance: Utterance | null;
  agentSpeaking: boolean;
  listening: boolean;
  caption: string;
  simulation: boolean;
  simulationForced: string | null;
  muted: boolean;
  micError: string | null;
  readElapsed: number;
  readProgress: number;
  readProvisional: boolean;
  live: LiveSignals;
  lines: KidLine[];
  paceOffer: boolean;
  reportId: string | null;
  resumable: boolean;
  judgeMode: "ia" | "reglas" | null;
  speechSupported: boolean;
  usingWebSpeech: boolean;
  voiceSupport: VoiceSupport | null;
  micTesting: boolean;
  micTestMessage: string | null;
  micBusy: boolean;
  voiceProvider: SessionAsrProvider;
  cloudStatus: VoicePolicyStatus | null;
  cloudStatusLoading: boolean;
  cloudReady: boolean;
  asrConnecting: boolean;
  asrFinalizing: boolean;
  asrMetadata: AsrMetadata | null;
  localReady: boolean;
  localPreparing: boolean;
  localProgress: string | null;
  /** Experimental emotion estimate (shown in the adult view only). */
  experimentalEmotion: boolean;
  /** Adult-only timeline of estimates. Never projected into the child view (see childView.ts). */
  affect: Array<{ state: TurnState; estimate: AffectEstimate }>;
  /** An access code enables sending answer audio to the private emotion2vec+ backend. */
  emotionBackendAuthorized: boolean;
  /** The last request failed. No local emotion is substituted. */
  emotionBackendFallback: boolean;
  emotionBackendError: string | null;
  emotionStatus: VoicePolicyStatus | null;
  emotionStatusLoading: boolean;
  affectTest: AffectEstimate | null;
  affectTestBusy: boolean;
  affectTestError: string | null;
}

const EMPTY_LIVE: LiveSignals = { pcpm: null, accuracy: null, selfCorrections: 0, longPauses: null, prosody: null, differentIdx: [], noise: null };
const DEFAULT_PERMS: Permissions = { voice: true, process: true, mood: true };

const ANSWER_STATES = new Set(["Q_OBTIENE", "Q_INFIERE", "STANCE", "REVISE"]);

function initialSnapshot(): Snapshot {
  return {
    phase: "loading",
    error: null,
    mission: null,
    profile: null,
    permissions: DEFAULT_PERMS,
    ctx: null,
    utterance: null,
    agentSpeaking: false,
    listening: false,
    caption: "",
    simulation: false,
    simulationForced: null,
    muted: false,
    micError: null,
    readElapsed: 0,
    readProgress: 0,
    readProvisional: false,
    live: EMPTY_LIVE,
    lines: [],
    paceOffer: false,
    reportId: null,
    resumable: false,
    judgeMode: null,
    speechSupported: false,
    usingWebSpeech: false,
    voiceSupport: null,
    micTesting: false,
    micTestMessage: null,
    micBusy: false,
    voiceProvider: "browser",
    cloudStatus: null,
    cloudStatusLoading: true,
    cloudReady: false,
    asrConnecting: false,
    asrFinalizing: false,
    asrMetadata: null,
    localReady: false,
    localPreparing: false,
    localProgress: null,
    experimentalEmotion: true,
    affect: [],
    emotionBackendAuthorized: false,
    emotionBackendFallback: false,
    emotionBackendError: null,
    emotionStatus: null,
    emotionStatusLoading: true,
    affectTest: null,
    affectTestBusy: false,
    affectTestError: null,
  };
}

export class SessionController {
  private snap: Snapshot = initialSnapshot();
  private listeners = new Set<() => void>();
  private ctx: MachineContext | null = null;
  private mission: Mission | null = null;
  private profile: Profile | null = null;
  private permissions: Permissions;
  private experimentalEmotion = true;
  private emotionAccess: CloudVoiceAccess | null = null;
  private pendingAffect: Promise<void>[] = [];
  private emotionGeneration = 0;
  private emotionRequests = new Set<AbortController>();
  private emotionBuffers = new Set<Float32Array>();
  private emotionTurns = new Set<TurnRecord>();
  private emotionStatusRequest: AbortController | null = null;
  private voice = new AgentVoice(() => this.clock());
  private analyzer = new AudioAnalyzer();
  private transcriber: Transcriber | null = null;
  private epoch = 0;
  private disposed = false;
  private lifecycleRequest = 0;
  private cloudAccess: CloudVoiceAccess | null = null;

  // Turn bookkeeping (derived numbers only; frames are dropped after summary).
  private turns: TurnRecord[] = [];
  private turnFrames: FrameFeature[] = [];
  private turnStart = 0;
  private turnText = "";
  private transcriptPrefix = "";
  private lastTextAt = 0;
  private onsetAt: number | null = null;
  private lastVoicedAt = 0;
  private turnBargeIn = false;
  private bargeIns = 0;
  private loudRun = 0;
  private baseline: PaceFeatures | null = null;
  private breakOffered = false;
  private answerLengths: number[] = [];
  private startedAt = 0;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private ticker: ReturnType<typeof setInterval> | null = null;
  private bargeTicker: ReturnType<typeof setInterval> | null = null;
  private unsubscribeFrames: (() => void) | null = null;
  private recentNoise: FrameFeature[] = [];
  private micRequest = 0;
  private micProbe: AudioAnalyzer | null = null;
  private probeRequest = 0;
  private probeTimer: ReturnType<typeof setTimeout> | null = null;

  // ----------------------------------------------------------------- store
  subscribe = (cb: () => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };
  getSnapshot = () => this.snap;
  getServerSnapshot = () => SERVER_SNAPSHOT;

  private patch(p: Partial<Snapshot>) {
    if (this.disposed) return;
    this.snap = { ...this.snap, ...p };
    for (const l of this.listeners) l();
  }

  private clock() {
    return this.analyzer.running ? this.analyzer.now() : typeof performance !== "undefined" ? performance.now() : Date.now();
  }

  /** Session defaults. There is no stored consent: the MVP always uses these. */
  constructor(private readonly defaults: Permissions = DEFAULT_PERMS) {
    this.permissions = defaults;
  }

  // ------------------------------------------------------------- lifecycle
  init() {
    this.cancelEmotionRequests();
    this.emotionStatusRequest?.abort();
    this.emotionStatusRequest = null;
    this.disposed = false;
    const request = ++this.lifecycleRequest;
    this.cloudAccess = null;
    this.snap = initialSnapshot();
    const store = getStore();
    // No adult/guardian consent gate in the MVP: defaults apply and the
    // experimental emotion estimate is available whenever the model is.
    this.permissions = this.defaults;
    this.experimentalEmotion = true;
    this.emotionAccess = null;
    this.profile = store.loadProfile() ?? { alias: "tu hijo", grade: 4, homeLang: "es", readingLang: "es" };
    this.mission = store.currentMission();
    if (!this.mission) {
      this.patch({ phase: "no-mission", profile: this.profile, permissions: this.permissions });
      return;
    }
    const paused = store.loadPaused();
    const resumable = !!paused && paused.missionId === this.mission.id && Date.now() - Date.parse(paused.pausedAt) < 24 * 3600 * 1000;
    const support = getVoiceSupport(this.mission.lang);
    const forced = this.forcedSimulationReason(support);
    this.patch({
      phase: "intro",
      mission: this.mission,
      profile: this.profile,
      permissions: this.permissions,
      experimentalEmotion: this.experimentalEmotion,
      simulation: forced !== null,
      simulationForced: forced,
      resumable,
      speechSupported: support.canTranscribe,
      voiceSupport: support,
    });
    fetch("/api/judge")
      .then((r) => r.json())
      .then((j: { mode?: "ia" | "reglas" }) => request === this.lifecycleRequest && this.patch({ judgeMode: j.mode === "ia" ? "ia" : "reglas" }))
      .catch(() => request === this.lifecycleRequest && this.patch({ judgeMode: "reglas" }));
    void this.refreshAsrStatus();
    if (this.experimentalEmotion) void this.refreshEmotionStatus();
    else this.patch({ emotionStatusLoading: false });
  }

  async refreshEmotionStatus() {
    if (!this.experimentalEmotion || this.disposed) return;
    const request = this.lifecycleRequest;
    const controller = new AbortController();
    this.emotionStatusRequest?.abort();
    this.emotionStatusRequest = controller;
    const timeout = setTimeout(() => controller.abort(), 10_000);
    this.patch({ emotionStatusLoading: true });
    let status: VoicePolicyStatus;
    try {
      const response = await fetch("/api/emotion", { cache: "no-store", signal: controller.signal });
      const data = await response.json() as VoicePolicyStatus;
      if (!response.ok || !["disabled", "adult-demo", "approved-pilot"].includes(data.mode) || typeof data.enabled !== "boolean") throw new Error("invalid status");
      status = { enabled: data.enabled, mode: data.mode, reason: typeof data.reason === "string" ? data.reason.slice(0, 500) : null };
    } catch {
      status = { enabled: false, mode: "disabled", reason: "No pudimos comprobar emotion2vec+. Reintenta; no se usará texto ni una emoción simulada." };
    } finally { clearTimeout(timeout); }
    if (this.disposed || request !== this.lifecycleRequest || this.emotionStatusRequest !== controller) return;
    this.emotionStatusRequest = null;
    if (this.emotionAccess && (!status.enabled || status.mode !== this.emotionAccess.audience)) {
      this.emotionAccess = null;
      this.cancelEmotionRequests();
      this.analyzer.discardCapture();
      this.patch({ affectTestBusy: false, affectTest: null });
    }
    this.patch({ emotionStatus: status, emotionStatusLoading: false, emotionBackendAuthorized: !!this.emotionAccess });
  }

  async refreshAsrStatus() {
    const request = this.lifecycleRequest;
    this.patch({ cloudStatusLoading: true });
    let status: VoicePolicyStatus;
    try {
      const response = await fetch("/api/asr", { cache: "no-store" });
      if (response.ok === false) throw new Error("status unavailable");
      const data = await response.json() as { providers?: { deepgram?: VoicePolicyStatus } };
      const candidate = data.providers?.deepgram;
      if (!candidate || !["disabled", "adult-demo", "approved-pilot"].includes(candidate.mode)) throw new Error("invalid status");
      status = { enabled: candidate.enabled === true, mode: candidate.mode, reason: candidate.reason ?? null };
    } catch {
      status = { enabled: false, mode: "disabled", reason: "No pudimos comprobar el servicio. La voz en la nube permanece desactivada; puedes reintentar o escribir." };
    }
    if (this.disposed || request !== this.lifecycleRequest) return;
    if (!status.enabled || status.mode !== this.cloudAccess?.audience) this.cloudAccess = null;
    this.patch({ cloudStatus: status, cloudStatusLoading: false, cloudReady: !!this.cloudAccess });
    if (this.snap.phase === "intro" && this.snap.voiceProvider === "deepgram") this.applyVoiceSetup();
  }

  /** Provider selection and cloud authorization are separate, explicit actions. */
  selectVoiceProvider(provider: SessionAsrProvider) {
    if (this.snap.phase !== "intro" || this.snap.micTesting || provider === this.snap.voiceProvider) return;
    this.cloudAccess = null;
    this.patch({ voiceProvider: provider, cloudReady: false, asrMetadata: null, localReady: localAsrReady() });
    this.applyVoiceSetup();
  }

  authorizeCloud(access: CloudVoiceAccess | null) {
    if (this.snap.phase !== "intro" || this.snap.voiceProvider !== "deepgram") return;
    const policy = this.snap.cloudStatus;
    const allowed = access !== null && !!access.accessCode.trim() && policy?.enabled === true && policy.mode === access.audience;
    this.cloudAccess = allowed ? { ...access, accessCode: access.accessCode.trim() } : null;
    this.patch({ cloudReady: !!this.cloudAccess });
    this.applyVoiceSetup();
  }

  private applyVoiceSetup() {
    const forced = this.forcedSimulationReason();
    this.patch({ simulationForced: forced, simulation: forced !== null, speechSupported: forced === null, micError: null });
  }

  /** Downloads model files only after an explicit adult action; never audio. */
  async prepareLocalVoice() {
    if (this.snap.phase !== "intro" || this.snap.voiceProvider !== "local-whisper" || this.snap.localPreparing) return;
    const request = this.lifecycleRequest;
    this.patch({ localPreparing: true, localProgress: "Preparando descarga del modelo local (~80 MB)…" });
    try {
      await prepareLocalAsr((progress) => {
        if (request === this.lifecycleRequest) this.patch({ localProgress: `${progress.message}${Number.isFinite(progress.progress) && progress.progress > 0 ? ` · ${Math.round(progress.progress)} %` : ""}` });
      });
      if (this.disposed || request !== this.lifecycleRequest) return;
      this.patch({ localReady: localAsrReady(), localProgress: "Modelo listo en este dispositivo. La voz se procesa aquí, sin enviarla a un proveedor de ASR." });
    } catch {
      if (this.disposed || request !== this.lifecycleRequest) return;
      this.patch({ localReady: false, localProgress: "No pudimos preparar el modelo. Revisa internet, memoria y compatibilidad del navegador; puedes reintentar o escribir." });
    } finally {
      if (!this.disposed && request === this.lifecycleRequest) {
        this.patch({ localPreparing: false });
        this.applyVoiceSetup();
      }
    }
  }

  dispose() {
    this.cancelEmotionRequests();
    this.emotionStatusRequest?.abort();
    this.emotionStatusRequest = null;
    this.disposed = true;
    this.lifecycleRequest++;
    this.cloudAccess = null;
    this.emotionAccess = null;
    this.pendingAffect = [];
    releaseLocalAsr();
    this.epoch++;
    this.micRequest++;
    this.stopMicProbe();
    this.clearTimers();
    this.stopListening();
    this.voice.cancel();
    this.unsubscribeFrames?.();
    this.unsubscribeFrames = null;
    this.analyzer.stop();
    this.listeners.clear();
  }

  private forcedSimulationReason(support = getVoiceSupport(this.mission?.lang ?? "es")): string | null {
    if (!this.permissions.voice) return "La familia no dio permiso de voz: la sesión funciona escribiendo lo que dice el niño.";
    if (this.snap.voiceProvider === "deepgram") {
      if (!support.canRecord) return support.message;
      if (this.mission?.lang !== "es") return "Deepgram no está habilitado para quechua en este MVP. Escribe lo que escuchas, sin traducir.";
      if (!this.snap.cloudStatus?.enabled) return "La transcripción en la nube no está habilitada en este despliegue. Usa el modelo local o escribe; el responsable puede revisar la configuración.";
      if (!this.cloudAccess) return "Falta la autorización específica para enviar audio a Deepgram. Sin ella la sesión funciona escribiendo.";
      return null;
    }
    if (this.snap.voiceProvider === "local-whisper") {
      if (!support.canRecord) return support.message;
      if (this.mission?.lang !== "es") return "El modelo local aún no está validado para evaluar lectura en quechua. Usa la transcripción manual, sin traducir.";
      if (!this.snap.localReady) return "Prepara primero el modelo local para usar transcripción sin enviar la voz a la nube.";
      return null;
    }
    return support.canTranscribe ? null : support.message;
  }

  // ---------------------------------------------------------------- begin
  async begin(resume = false) {
    if (!this.mission || !this.profile || this.snap.phase !== "intro") return;
    this.stopMicProbe();
    const epoch = ++this.epoch;
    const store = getStore();
    this.turns = [];
    this.bargeIns = 0;
    this.baseline = null;
    this.breakOffered = false;
    this.answerLengths = [];
    this.startedAt = Date.now();
    this.cancelEmotionRequests();
    this.pendingAffect = [];
    this.patch({ phase: "running", lines: [], reportId: null, error: null, affect: [], affectTest: null, affectTestBusy: false, affectTestError: null });

    if (!this.snap.simulation) await this.startMic(epoch);
    if (this.disposed || epoch !== this.epoch) return;

    const paused = resume ? store.loadPaused() : null;
    store.savePaused(null);
    if (paused && paused.ctx) {
      this.ctx = paused.ctx as MachineContext;
      this.turns = (paused.turns ?? []) as TurnRecord[];
      this.startedAt = paused.startedAt || this.startedAt;
      this.patch({ ctx: this.ctx });
      this.dispatch({ type: "RESUME" });
      return;
    }
    const r = start(initialContext({ alias: this.profile.alias, moodEnabled: this.permissions.mood }), this.mission);
    this.ctx = r.ctx;
    this.patch({ ctx: this.ctx });
    void this.handleEffects(r.effects, ++this.epoch);
  }

  private async startMic(epoch = this.epoch): Promise<boolean> {
    const request = ++this.micRequest;
    const support = getVoiceSupport(this.mission?.lang ?? "es");
    const forced = this.forcedSimulationReason(support);
    this.patch({ voiceSupport: support, speechSupported: forced === null, simulationForced: forced });
    if (forced) {
      this.useManualInput(forced);
      return false;
    }
    this.patch({ micBusy: true });
    try {
      await this.analyzer.start();
      if (this.disposed || request !== this.micRequest || epoch !== this.epoch) {
        this.analyzer.stop();
        return false;
      }
      this.unsubscribeFrames?.();
      this.unsubscribeFrames = this.analyzer.subscribe((f) => this.onFrame(f));
      this.transcriber = createTranscriber(this.mission?.lang ?? "es", { provider: this.snap.voiceProvider, cloudAccess: this.cloudAccess ?? undefined });
      if (!this.transcriber) {
        this.useManualInput(voiceErrorMessage("unsupported"));
        return false;
      }
      this.patch({ micError: null, usingWebSpeech: this.transcriber?.kind === "web-speech" });
      return true;
    } catch (error) {
      this.analyzer.stop();
      if (this.disposed || request !== this.micRequest || epoch !== this.epoch) return false;
      this.transcriber = null;
      const name = error instanceof Error ? error.name : "";
      this.useManualInput(voiceErrorMessage(name === "NotAllowedError" ? "not-allowed" : name === "SecurityError" ? "insecure-context" : "audio-capture"));
      return false;
    } finally {
      if (request === this.micRequest) this.patch({ micBusy: false });
    }
  }

  async retryMic() {
    if (this.snap.simulationForced || this.snap.micBusy || this.ctx?.state === "PAUSED") return;
    const epoch = this.epoch;
    const caption = this.snap.caption;
    if (await this.startMic(epoch)) {
      if (epoch !== this.epoch || this.snap.phase !== "running") return;
      this.patch({ simulation: false });
      this.restartCurrentTurn(caption);
    }
  }

  /** Physical microphone check only: no recognizer, recording, or saved frames. */
  async testMicrophone() {
    if (this.snap.phase !== "intro" || this.snap.micTesting || !this.permissions.voice || !this.snap.voiceSupport?.canRecord) return;
    const request = ++this.probeRequest;
    const probe = new AudioAnalyzer();
    this.micProbe = probe;
    this.patch({ micTesting: true, micTestMessage: "Permite el micrófono y di unas palabras. Solo medimos el nivel de sonido durante 2,5 segundos." });
    let peak = 0;
    try {
      await probe.start();
      if (this.disposed || request !== this.probeRequest || this.snap.phase !== "intro") {
        probe.stop();
        return;
      }
      probe.subscribe((frame) => { peak = Math.max(peak, frame.rms); });
      this.probeTimer = setTimeout(() => {
        if (request !== this.probeRequest) return;
        this.stopMicProbe();
        this.patch({ micTestMessage: peak > 0.005
          ? "El micrófono recibe sonido. Esto no garantiza la transcripción: depende de un servicio distinto del navegador."
          : "El permiso funciona, pero no detectamos sonido suficiente. Revisa el micrófono elegido y su volumen. La transcripción se comprueba por separado." });
      }, 2500);
    } catch (error) {
      probe.stop();
      if (request !== this.probeRequest || this.disposed) return;
      this.stopMicProbe();
      this.patch({ micTestMessage: voiceErrorMessage(error instanceof Error && error.name === "NotAllowedError" ? "not-allowed" : "audio-capture") });
    }
  }

  private stopMicProbe() {
    this.probeRequest++;
    if (this.probeTimer) clearTimeout(this.probeTimer);
    this.probeTimer = null;
    this.micProbe?.stop();
    this.micProbe = null;
    this.patch({ micTesting: false });
  }

  cancelMicrophoneTest() {
    this.stopMicProbe();
    this.patch({ micTestMessage: "Prueba cancelada. No se guardó audio." });
  }

  /** A technical failure never becomes an educational answer or silence. */
  private useManualInput(message: string | null) {
    this.clearTimers();
    this.stopListening();
    this.voice.cancel();
    this.unsubscribeFrames?.();
    this.unsubscribeFrames = null;
    this.analyzer.stop();
    this.turnFrames = [];
    this.recentNoise = [];
    this.patch({
      micError: message, simulation: true, usingWebSpeech: false, asrConnecting: false, asrFinalizing: false, asrMetadata: null,
      agentSpeaking: false, caption: this.turnText || this.snap.caption,
      listening: this.snap.phase === "running" && !!this.ctx && (this.ctx.state === "READ" || (ANSWER_STATES.has(this.ctx.state) && !this.ctx.awaitingConfidence)),
      live: { ...this.snap.live, longPauses: null, prosody: null, noise: null },
    });
  }

  // -------------------------------------------------------------- machine
  private dispatch(ev: MachineEvent) {
    if (!this.ctx || !this.mission) return;
    const r = transition(this.ctx, ev, this.mission);
    if (r.ctx === this.ctx && r.effects.length === 0) return;
    const epoch = ++this.epoch;
    this.clearTimers();
    this.stopListening();
    this.ctx = r.ctx;
    this.patch({ ctx: r.ctx, caption: "" });
    void this.handleEffects(r.effects, epoch);
  }

  private async handleEffects(effects: Effect[], epoch: number) {
    let say: Utterance | null = null;
    for (const e of effects) {
      if (e.type === "say") say = e.utterance;
      if (e.type === "log" && process.env.NODE_ENV !== "production") console.debug("[ñawinchay]", e.name, e.payload ?? "");
    }
    if (say) {
      this.patch({ utterance: say, lines: [...this.snap.lines, { who: "agente" as const, show: say.show, showEs: say.showEs }].slice(-8) });
      const speaking = this.voice.speak(say.speak, () => this.patch({ agentSpeaking: true }));
      if (!this.snap.simulation) {
        this.patch({ agentSpeaking: !this.voice.muted });
        this.watchBargeIn(epoch);
        await speaking;
        if (epoch !== this.epoch) return;
        this.patch({ agentSpeaking: false });
      } else {
        void speaking.then(() => epoch === this.epoch && this.patch({ agentSpeaking: false }));
      }
    }
    if (epoch !== this.epoch) return;
    this.afterStateSettled(epoch);
  }

  private afterStateSettled(epoch: number, preservedText = "") {
    const ctx = this.ctx;
    if (!ctx || this.disposed || epoch !== this.epoch) return;
    switch (ctx.state) {
      case "CHECK_IN":
      case "CHECK_OUT":
        this.timers.push(setTimeout(() => epoch === this.epoch && this.dispatch({ type: "TIMEOUT" }), MOOD_TIMEOUT_MS));
        break;
      case "READ":
        this.beginTurn("READ", epoch, preservedText);
        break;
      case "Q_OBTIENE":
      case "Q_INFIERE":
      case "REVISE":
        this.beginTurn(ctx.state, epoch, preservedText);
        break;
      case "STANCE":
        if (!ctx.awaitingConfidence) this.beginTurn("STANCE", epoch, preservedText);
        break;
      case "REPORT":
        void this.generateReport(epoch);
        break;
      default:
        break;
    }
  }

  private restartCurrentTurn(preservedText = "") {
    const epoch = ++this.epoch;
    this.clearTimers();
    this.stopListening();
    this.voice.cancel();
    this.patch({ agentSpeaking: false });
    this.afterStateSettled(epoch, preservedText);
  }

  // ---------------------------------------------------------------- turns
  private beginTurn(state: TurnState, epoch: number, preservedText = "") {
    this.turnFrames = [];
    this.turnText = preservedText;
    this.transcriptPrefix = preservedText;
    this.onsetAt = null;
    this.lastVoicedAt = 0;
    this.lastTextAt = 0;
    this.turnStart = this.clock();
    if (state === "READ") this.patch({ readElapsed: 0, readProgress: 0, readProvisional: false, live: EMPTY_LIVE });
    this.patch({ listening: false, caption: preservedText, asrMetadata: null, asrFinalizing: false });
    const voiceMode = !this.snap.simulation && this.transcriber;
    let ready = false;
    const onReady = () => {
      if (ready || this.disposed || epoch !== this.epoch) return;
      ready = true;
      // Model download, recognizer startup and cloud handshake are not reading
      // time, response latency or evidence that the learner stayed silent.
      this.turnStart = this.clock();
      this.turnFrames = [];
      // EXPERIMENTAL: hold this ANSWER turn's audio in RAM (never READ).
      if (this.experimentalEmotion && this.emotionAccess && state !== "READ" && voiceMode && this.analyzer.running) this.analyzer.startCapture(15);
      this.patch({ listening: true, asrConnecting: false });
      this.startTurnTicker(state, epoch, !!voiceMode);
    };

    if (voiceMode && this.transcriber) {
      this.patch({ asrConnecting: true });
      this.transcriber.start({
        onReady,
        onResult: (result) => {
          if (this.disposed || (epoch !== this.epoch && !(this.snap.asrFinalizing && this.epoch === epoch + 1))) return;
          this.patch({ asrMetadata: this.resultMetadata(result) });
        },
        onText: (text, isFinal) => {
          if (!ready || epoch !== this.epoch) return;
          this.turnText = [preservedText, text].filter(Boolean).join(" ");
          this.lastTextAt = this.clock();
          this.patch({ caption: this.turnText });
          if (state === "READ") this.updateReadingLive(this.turnText, isFinal);
        },
        onError: (code) => {
          if (this.disposed || epoch !== this.epoch) return;
          this.epoch++; // invalidate callbacks; do not restart or advance the question
          this.useManualInput(this.asrErrorMessage(code));
        },
      });
    } else {
      onReady();
    }
  }

  private resultMetadata(result: AsrResult): AsrMetadata {
    const words = result.words.filter((w) => Number.isFinite(w.start) && Number.isFinite(w.end) && w.start >= 0 && w.end >= w.start);
    return { provider: result.provider, model: result.model, language: result.language,
      timedWords: words.length, firstStart: words[0]?.start ?? null, lastEnd: words.at(-1)?.end ?? null, isFinal: result.isFinal };
  }

  private turnProvenance(manual = false): TranscriptionProvenance {
    if (manual) return { provider: "manual", model: "human-entered", language: this.mission?.lang ?? "es", timingsAvailable: false, normalization: "manual-unverified" };
    const provider = this.snap.voiceProvider === "browser" ? "web-speech" : this.snap.voiceProvider;
    const model = provider === "web-speech" ? "browser-managed" : provider === "deepgram" ? "nova-3" : "onnx-community/whisper-base_timestamped";
    return { provider, model, language: "es", timingsAvailable: !!this.snap.asrMetadata?.timedWords, normalization: "asr-may-normalize" };
  }

  private asrErrorMessage(code: string): string {
    if (this.snap.voiceProvider === "local-whisper") {
      if (code === "local-asr-not-ready") return "El modelo local no está preparado. Vuelve a la misión para descargarlo o continúa escribiendo; no cambiaremos a la nube automáticamente.";
      if (code === "local-asr-timeout") return "El dispositivo tardó demasiado en transcribir. Conserva el texto disponible y completa el turno escribiendo; no cuenta como silencio del niño.";
      if (code.startsWith("local-asr-")) return "No se pudo completar la transcripción en este dispositivo. Puedes continuar escribiendo; no se enviará esta voz a otro proveedor automáticamente.";
    }
    if (this.snap.voiceProvider === "deepgram") {
      if (code === "not-allowed") return "No se autorizó el acceso a la voz en la nube o al micrófono. Revisa el código, los permisos y la autorización; puedes seguir escribiendo sin perder el texto.";
      if (code === "asr-unavailable") return "Deepgram no está disponible en este despliegue. Continúa escribiendo; no se cambia de proveedor automáticamente.";
      if (["asr-session-expired", "session-limit"].includes(code)) return "Se alcanzó el límite de esta conexión de voz. Reintenta para abrir una conexión nueva o continúa escribiendo; conservamos lo reconocido.";
      if (code === "network") return "La conexión con Deepgram se interrumpió. Revisa internet y reintenta, o continúa escribiendo; conservamos lo reconocido.";
    }
    return voiceErrorMessage(code);
  }

  private startTurnTicker(state: TurnState, epoch: number, voiceMode: boolean) {
    if (epoch !== this.epoch || this.disposed) return;
    this.ticker = setInterval(() => {
      if (epoch !== this.epoch) return;
      const now = this.clock();
      if (this.analyzer.running && this.recentNoise.length >= 10) {
        const nf = noiseFloorDb(this.recentNoise);
        const noise = nf !== null && nf > -35 ? "alto" : "ok";
        if (noise !== this.snap.live.noise) this.patch({ live: { ...this.snap.live, noise } });
      }
      if (state === "READ") {
        const elapsed = (now - this.turnStart) / 1000;
        this.patch({ readElapsed: Math.min(READ_LIMIT_S, elapsed) });
        if (this.analyzer.running && !this.snap.simulation) {
          this.patch({ live: { ...this.snap.live, longPauses: detectLongPauses(this.turnFrames).length } });
        }
        // In simulation the adult controls the end of the reading.
        if (!this.snap.simulation && elapsed >= READ_LIMIT_S) void this.endVoiceTurn("read", epoch);
        return;
      }
      if (this.snap.simulation || !voiceMode) return;
      const spoke = this.onsetAt !== null || this.turnText.length > 0;
      if (!spoke && now - this.turnStart > NO_RESPONSE_MS) void this.endVoiceTurn("silence", epoch);
      else if (spoke) {
        const lastActivity = Math.max(this.lastVoicedAt, this.lastTextAt, this.onsetAt ?? 0);
        if (now - lastActivity > END_OF_TURN_MS) void this.endVoiceTurn("answer", epoch);
      }
    }, 250);
  }

  private onFrame(f: FrameFeature) {
    // Noise check while nobody speaks.
    if (!f.voiced) {
      this.recentNoise.push(f);
      if (this.recentNoise.length > 40) this.recentNoise.shift();
    }
    if (this.voice.speaking) {
      this.loudRun = f.voiced && f.rms > BARGE_IN_RMS ? this.loudRun + 1 : 0;
      return;
    }
    if (!this.snap.listening) return;
    this.turnFrames.push(f);
    if (this.turnFrames.length > 4000) this.turnFrames.shift();
    if (f.voiced) {
      this.lastVoicedAt = f.t;
      if (this.onsetAt === null && speechOnset(this.turnFrames.slice(-3)) !== null) this.onsetAt = f.t;
    }
  }

  private watchBargeIn(epoch: number) {
    if (this.mission?.lang !== "es") return; // Quechua runs strictly by turns (PRD RF-56).
    this.loudRun = 0;
    this.bargeTicker = setInterval(() => {
      if (epoch !== this.epoch || !this.voice.speaking) {
        if (this.bargeTicker) clearInterval(this.bargeTicker);
        this.bargeTicker = null;
        return;
      }
      if (this.loudRun >= BARGE_IN_FRAMES && ANSWER_STATES.has(this.ctx?.state ?? "")) {
        if (this.bargeTicker) clearInterval(this.bargeTicker);
        this.bargeTicker = null;
        this.turnBargeIn = true;
        this.bargeIns++;
        this.voice.cancel();
      }
    }, 100);
  }

  private updateReadingLive(text: string, isFinal: boolean) {
    if (!this.mission) return;
    const secs = Math.max(1, (this.clock() - this.turnStart) / 1000);
    const m = readingMetrics(this.mission.text, text, secs);
    const progress = liveReadingProgress(this.mission.text, text);
    this.patch({
      readProgress: progress.reachedIndex,
      readProvisional: !isFinal,
      // Interim hypotheses can be replaced. Do not present their differences or
      // metrics as committed evidence, and never end the turn from an interim.
      ...(isFinal ? { live: { ...this.snap.live, pcpm: m.pcpm, accuracy: m.accuracy, selfCorrections: m.selfCorrections, differentIdx: m.differentIndices } } : {}),
    });
    if (!this.snap.simulation && isFinal && progress.complete) {
      void this.endVoiceTurn("read", this.epoch);
    }
  }

  private async endVoiceTurn(kind: "answer" | "silence" | "read", epoch: number) {
    if (epoch !== this.epoch || !this.ctx) return;
    this.epoch++; // freeze this turn
    const frozen = this.epoch;
    const turnEndedAt = this.clock();
    // Freeze audio now, before a recognizer's delayed final flush can capture
    // unrelated speech. Every early return below wipes this owned clip.
    const clip = kind === "read" ? null : this.analyzer.takeCapture();
    if (clip) this.emotionBuffers.add(clip.samples);
    // The emotion model starts from audio alone, before ASR completes. A failed
    // or empty transcript must not suppress a valid voice-model observation.
    const emotionTurn: TurnRecord | null = this.experimentalEmotion && clip
      ? { state: this.ctx.state as TurnState, transcript: "", simulated: false, audio: null, at: Date.now() } : null;
    if (emotionTurn) this.queueAffect(emotionTurn, clip);
    this.clearTimers();
    this.patch({ listening: false, asrFinalizing: true });
    let text: string;
    try {
      // The handler may have included a preserved prefix from before a retry.
      const result = await this.transcriber?.stop();
      text = result ? [this.transcriptPrefix, result].filter(Boolean).join(" ").trim() : this.turnText.trim();
    } catch {
      this.releaseEmotionSamples(clip?.samples);
      if (frozen === this.epoch) this.useManualInput(voiceErrorMessage("network"));
      return;
    }
    if (frozen !== this.epoch) { this.releaseEmotionSamples(clip?.samples); return; }
    if ((this.snap.voiceProvider === "deepgram" || this.snap.voiceProvider === "local-whisper") && this.snap.asrMetadata?.isFinal !== true) {
      this.turnText = text || this.turnText;
      this.releaseEmotionSamples(clip?.samples);
      this.useManualInput("El reconocedor no confirmó el texto final. Revisa y completa la transcripción antes de enviarla; no lo contamos como un error del niño.");
      return;
    }
    if (!text) {
      this.releaseEmotionSamples(clip?.samples);
      this.useManualInput(voiceErrorMessage("no-speech"));
      return;
    }
    const frames = this.turnFrames;
    const transcription = this.turnProvenance();
    this.turnFrames = [];
    const audio = this.analyzer.running
      ? summarizeTurnAudio(frames, { questionEndMs: this.turnStart, childBaselineF0: this.baseline?.meanF0 ?? null })
      : null;

    if (kind === "read") {
      const readingSeconds = Math.min(READ_LIMIT_S, Math.max(1, (turnEndedAt - this.turnStart) / 1000));
      this.baseline = computeBaseline(frames);
      const unobservable = liveReadingProgress(this.mission!.text, text).matchedWords === 0;
      this.turns.push({ state: "READ", transcript: text, simulated: false, audio, readingSeconds, unobservable, transcription, at: Date.now() });
      this.finishReadingLive(text, readingSeconds, frames);
      this.forceDispatch({ type: "READ_DONE" });
      return;
    }
    const unobservable = audio ? audio.snrDb !== null && audio.snrDb < 6 && answerLength(text) < 2 : false;
    const turnRecord: TurnRecord = emotionTurn ?? { state: this.ctx.state as TurnState, transcript: "", simulated: false, audio: null, at: Date.now() };
    Object.assign(turnRecord, { transcript: text, audio, bargeIn: this.turnBargeIn, unobservable, transcription });
    this.turns.push(turnRecord);
    if (this.experimentalEmotion && !emotionTurn) this.queueAffect(turnRecord, clip);
    else this.releaseEmotionSamples(clip?.samples);
    this.turnBargeIn = false;
    this.checkPace(frames, text);
    this.patch({ lines: [...this.snap.lines, { who: "nino" as const, show: text }].slice(-8) });
    this.forceDispatch({ type: "ANSWER", text });
  }

  private finishReadingLive(text: string, seconds: number, frames: FrameFeature[]) {
    if (!this.mission) return;
    const m = readingMetrics(this.mission.text, text, seconds);
    const range = frames.length ? f0RangeSemitones(frames) : null;
    const pauses = frames.length ? detectLongPauses(frames).length : null;
    this.patch({
      readProgress: m.reachedIndex,
      readProvisional: false,
      live: {
        ...this.snap.live,
        pcpm: m.pcpm,
        accuracy: m.accuracy,
        selfCorrections: m.selfCorrections,
        differentIdx: m.differentIndices,
        longPauses: pauses,
        prosody: pauses !== null ? prosodyScore({ pcpm: m.pcpm, longPausesPerMin: pauses / (seconds / 60), f0RangeSemitones: range }) : null,
      },
    });
  }

  /** Live-only pace check. The result is NEVER stored: it can only show a break offer. */
  private checkPace(frames: FrameFeature[], text: string) {
    this.answerLengths.push(answerLength(text));
    if (!this.baseline || this.breakOffered) return;
    const onset = speechOnset(frames);
    const pace = classifyPace(this.baseline, paceFeatures(onset === null ? frames : frames.filter((f) => f.t >= onset)), this.answerLengths);
    if (shouldOfferBreak(pace)) {
      this.breakOffered = true;
      this.patch({ paceOffer: true });
    }
  }

  // ------------------------------------------------- experimental emotion
  // EXPERIMENTAL: estimate shown only in the adult view, from the VOICE of one answer
  // turn. Never spoken, never shown in the child zone, never changes the state
  // machine, help offers or pace check, and never reads the transcript.

  /** Enables sending answer audio to emotion2vec+ with the deployment access code. */
  authorizeEmotionBackend(accessCode: string) {
    if (!this.experimentalEmotion) return;
    const status = this.snap.emotionStatus;
    const audience = status?.mode;
    const code = accessCode.trim();
    this.cancelEmotionRequests();
    this.emotionAccess = code && status?.enabled && (audience === "approved-pilot" || audience === "adult-demo")
      ? { accessCode: code, audience } : null;
    if (!this.emotionAccess) this.analyzer.discardCapture();
    this.patch({ emotionBackendAuthorized: !!this.emotionAccess, emotionBackendFallback: false, emotionBackendError: this.emotionAccess ? null : "Falta el código de acceso para usar emotion2vec+.", affectTestBusy: false,
      affect: this.snap.affect.map((entry) => entry.estimate.note === "Analizando la voz con emotion2vec+…" ? { ...entry, estimate: unavailableAffect("Análisis cancelado al cambiar la autorización.") } : entry) });
  }

  private cancelEmotionRequests() {
    this.emotionGeneration++;
    for (const controller of this.emotionRequests) controller.abort();
    this.emotionRequests.clear();
    for (const samples of this.emotionBuffers) samples.fill(0);
    this.emotionBuffers.clear();
    this.emotionTurns.clear();
    this.pendingAffect = [];
  }

  private releaseEmotionSamples(samples?: Float32Array) {
    samples?.fill(0);
    if (samples) this.emotionBuffers.delete(samples);
  }

  private emotionError(error: unknown): string {
    const code = error instanceof EmotionClientError ? error.code : "invalid-audio";
    if (code === "not-authorized") return "Falta el código de acceso para usar emotion2vec+.";
    if (code === "invalid-audio") return "Se necesita al menos un segundo de audio de voz (máximo 15 segundos).";
    if (code === "cancelled") return "Análisis de voz cancelado; no se estimó una emoción.";
    if (code === "timeout") return "emotion2vec+ tardó demasiado. Reintenta con un audio de prueba; no se inventó una emoción.";
    if (code === "emotion-model-loading") return "emotion2vec+ aún está cargando. Espera y vuelve a probar el audio.";
    if (code === "no-speech") return "No se detectó voz suficiente en el audio; no se estimó una emoción.";
    return `No se pudo ejecutar emotion2vec+ (${code}). No se sustituye con texto ni heurísticas.`;
  }

  /** Real model inference only, authorized separately from the ASR provider. */
  private async fetchRemoteEmotion(samples16k: Float32Array | null, controller: AbortController): Promise<EmotionModelResult> {
    const access = this.emotionAccess;
    if (!access) throw new EmotionClientError("not-authorized");
    if (!samples16k || samples16k.length < TARGET_RATE) throw new EmotionClientError("invalid-audio");
    const wav = encodeWav16(samples16k);
    try {
      return await requestEmotionModel(wav, access, fetch, controller.signal);
    } finally {
      wav.fill(0);
    }
  }

  private queueAffect(turn: TurnRecord, clip: { samples: Float32Array; rate: number } | null) {
    const generation = this.emotionGeneration;
    const controller = new AbortController();
    this.emotionRequests.add(controller);
    this.emotionTurns.add(turn);
    // Reserve the turn's chronological position before asynchronous inference.
    const entry = { state: turn.state, estimate: unavailableAffect("Analizando la voz con emotion2vec+…") };
    turn.affect = entry.estimate;
    this.patch({ affect: [...this.snap.affect, entry].slice(-12) });
    const job = (async () => {
      let samples16k: Float32Array | null = null;
      let estimate: AffectEstimate;
      let failure: string | null = null;
      try {
        samples16k = clip ? resampleTo16k(clip.samples, clip.rate) : null;
        this.releaseEmotionSamples(clip?.samples);
        const remote = await this.fetchRemoteEmotion(samples16k ? capSeconds(samples16k, TARGET_RATE, 15) : null, controller);
        estimate = mapModelResult(remote);
      } catch (error) {
        failure = this.emotionError(error);
        estimate = unavailableAffect(failure);
      } finally {
        this.releaseEmotionSamples(clip?.samples);
        samples16k?.fill(0);
        this.emotionRequests.delete(controller);
      }
      if (this.disposed || generation !== this.emotionGeneration || !this.emotionTurns.has(turn)) return;
      turn.affect = estimate;
      this.patch({ affect: this.snap.affect.map((value) => value === entry ? { state: turn.state, estimate } : value), emotionBackendFallback: failure !== null, emotionBackendError: failure });
      this.emotionTurns.delete(turn);
    })();
    this.pendingAffect.push(job);
    void job.finally(() => { this.pendingAffect = this.pendingAffect.filter((value) => value !== job); });
  }

  /** Demo helper: analyze a chosen audio file with the same pipeline (adult panel). */
  async analyzeTestAudio(file: Blob) {
    if (!this.experimentalEmotion || this.snap.affectTestBusy) return;
    if (!this.emotionAccess) { this.patch({ affectTest: null, affectTestError: this.emotionError(new EmotionClientError("not-authorized")) }); return; }
    if (file.size > 10 * 1024 * 1024) {
      this.patch({ affectTestError: "El archivo pesa más de 10 MB." });
      return;
    }
    this.patch({ affectTestBusy: true, affectTestError: null, affectTest: null });
    const generation = this.emotionGeneration;
    const controller = new AbortController();
    this.emotionRequests.add(controller);
    const active = () => !this.disposed && generation === this.emotionGeneration && !controller.signal.aborted;
    let samples: Float32Array | null = null;
    let mono: Float32Array | null = null;
    let decoded: AudioBuffer | null = null;
    let encoded: ArrayBuffer | null = null;
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      try {
        encoded = await file.arrayBuffer();
        decoded = await ctx.decodeAudioData(encoded);
      } finally {
        void ctx.close();
      }
      const buffer = decoded;
      const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
      mono = mixToMono(channels.map((channel) => channel.subarray(0, Math.ceil(buffer.sampleRate * 15))));
      samples = resampleTo16k(mono, buffer.sampleRate);
      if (!active()) return;
      const remote = await this.fetchRemoteEmotion(capSeconds(samples, TARGET_RATE, 15), controller);
      if (active()) this.patch({ affectTest: mapModelResult(remote), emotionBackendFallback: false, emotionBackendError: null });
    } catch (error) {
      if (active()) this.patch({ affectTestError: error instanceof EmotionClientError ? this.emotionError(error) : "No se pudo leer ese audio. Usa un WAV o WebM corto." });
    } finally {
      if (encoded?.byteLength) new Uint8Array(encoded).fill(0);
      if (decoded) for (let i = 0; i < decoded.numberOfChannels; i++) decoded.getChannelData(i).fill(0);
      mono?.fill(0);
      samples?.fill(0);
      this.emotionRequests.delete(controller);
      if (!this.disposed && generation === this.emotionGeneration) this.patch({ affectTestBusy: false });
    }
  }

  /** Dispatch even though endVoiceTurn bumped the epoch. */
  private forceDispatch(ev: MachineEvent) {
    this.dispatch(ev);
  }

  private stopListening() {
    this.analyzer.discardCapture();
    if (this.ticker) clearInterval(this.ticker);
    this.ticker = null;
    this.transcriber?.abort();
    if (this.snap.listening || this.snap.asrConnecting || this.snap.asrFinalizing) this.patch({ listening: false, asrConnecting: false, asrFinalizing: false });
  }

  private clearTimers() {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
    if (this.ticker) clearInterval(this.ticker);
    this.ticker = null;
    if (this.bargeTicker) clearInterval(this.bargeTicker);
    this.bargeTicker = null;
  }

  // -------------------------------------------------------------- actions
  chooseMood(mood: Mood) {
    this.dispatch({ type: "MOOD", mood });
  }

  /** "Terminé" during READ. */
  finishReading() {
    if (this.ctx?.state !== "READ" || !this.snap.listening) return;
    if (this.snap.simulation) return;
    void this.endVoiceTurn("read", this.epoch);
  }

  /** "Listo" during an answer turn (voice mode). */
  doneSpeaking() {
    if (!this.ctx || !ANSWER_STATES.has(this.ctx.state) || this.snap.simulation || !this.snap.listening) return;
    void this.endVoiceTurn("answer", this.epoch);
  }

  /** Simulation: the adult typed what the child said. Same pipeline as voice. */
  submitSimulated(text: string, pauseSeconds: number | null, readSeconds: number | null) {
    const ctx = this.ctx;
    if (!ctx || !this.mission) return;
    this.voice.cancel();
    const t = text.trim();
    if (!t) return; // An empty form is not evidence of a child's silence.
    if (ctx.state === "READ") {
      const seconds = Math.min(READ_LIMIT_S, Math.max(1, readSeconds ?? READ_LIMIT_S));
      const unobservable = liveReadingProgress(this.mission.text, t).matchedWords === 0;
      this.turns.push({ state: "READ", transcript: t, simulated: true, audio: null, readingSeconds: seconds, unobservable, transcription: this.turnProvenance(true), at: Date.now() });
      this.finishReadingLive(t, seconds, []);
      this.dispatch({ type: "READ_DONE" });
      return;
    }
    if (!ANSWER_STATES.has(ctx.state) || (ctx.state === "STANCE" && ctx.awaitingConfidence)) return;
    // No audio in simulation: the experimental estimate needs the microphone.
    this.turns.push({
      state: ctx.state as TurnState,
      transcript: t,
      simulated: true,
      audio: null,
      transcription: this.turnProvenance(true),
      simulatedLatencyMs: pauseSeconds !== null && pauseSeconds >= 0 ? Math.round(pauseSeconds * 1000) : null,
      at: Date.now(),
    });
    this.answerLengths.push(answerLength(t));
    this.patch({ lines: [...this.snap.lines, { who: "nino" as const, show: t }].slice(-8) });
    this.dispatch({ type: "ANSWER", text: t });
  }

  /** Preserve the manual draft for a retry; compare it only on submission. */
  previewSimulatedReading(text: string) {
    if (this.ctx?.state !== "READ" || !this.snap.simulation) return;
    this.turnText = text;
    this.patch({ caption: text });
  }

  simulateSilence() {
    if (!this.ctx || !ANSWER_STATES.has(this.ctx.state)) return;
    this.voice.cancel();
    this.dispatch({ type: "SILENCE" });
  }

  setConfidence(value: Confidence) {
    this.dispatch({ type: "CONFIDENCE", value });
  }

  decide(value: Decision) {
    this.dispatch({ type: "DECISION", value });
  }

  pause() {
    this.voice.cancel();
    this.patch({ paceOffer: false });
    this.dispatch({ type: "PAUSE" });
  }

  resume() {
    this.dispatch({ type: "RESUME" });
  }

  /** "Terminar después": keep progress for 24 h. */
  finishLater() {
    if (!this.ctx || !this.mission) return;
    const p: PausedSession = {
      missionId: this.mission.id,
      pausedAt: new Date().toISOString(),
      state: this.ctx.resumeState ?? this.ctx.state,
      ctx: this.ctx,
      turns: this.turns,
      startedAt: this.startedAt,
    };
    getStore().savePaused(p);
    notifyStore();
  }

  dismissPaceOffer() {
    this.patch({ paceOffer: false });
  }

  toggleMute() {
    this.voice.muted = !this.voice.muted;
    if (this.voice.muted) this.voice.cancel();
    this.patch({ muted: this.voice.muted });
  }

  async toggleSimulation() {
    if (this.snap.simulationForced || this.snap.micBusy || this.ctx?.state === "PAUSED") return;
    const next = !this.snap.simulation;
    if (this.snap.phase === "intro") {
      this.patch({ simulation: next });
      return;
    }
    if (this.snap.phase !== "running") return;
    if (next) {
      this.epoch++;
      this.useManualInput(null);
      // The mode can be switched while the agent speaks, before a turn starts.
      if (!this.snap.listening) this.afterStateSettled(this.epoch, this.snap.caption);
    } else {
      await this.retryMic();
    }
  }

  // --------------------------------------------------------------- report
  private async generateReport(epoch: number) {
    if (!this.ctx || !this.mission || !this.profile) return;
    this.patch({ phase: "saving" });
    const ctx = this.ctx;
    const mission = this.mission;
    const judge: Partial<Record<"infiere" | "reflexiona", JudgeOutcome>> = {};
    if (this.snap.judgeMode === "ia") {
      const ask = async (kind: "infiere" | "reflexiona", answer: string) => {
        const q = mission.questions[kind === "infiere" ? 1 : 2];
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 20000);
        try {
          const res = await fetch("/api/judge", {
            method: "POST",
            headers: { "content-type": "application/json" },
            signal: ctrl.signal,
            body: JSON.stringify({
              kind,
              question: q.textEs ?? q.text,
              answer,
              readingText: mission.textEs ?? mission.text,
              counterText: kind === "reflexiona" ? mission.counter.text : undefined,
              decision: kind === "reflexiona" ? ctx.decision : null,
              evidenceKeys: q.evidenceKeys,
            }),
          });
          const j = (await res.json()) as JudgeResponse;
          if (j.source === "ia") judge[kind] = { level: j.level, status: j.status, quote: j.quote, runs: j.runs };
        } catch {
          /* rules stay in place */
        } finally {
          clearTimeout(t);
        }
      };
      await Promise.all([ask("infiere", ctx.answers.infiere ?? ""), ask("reflexiona", ctx.answers.revise ?? "")]);
    }
    if (this.pendingAffect.length) {
      // Bound report latency and seal the result: no inference may mutate a
      // report or adult timeline after it has been saved.
      let timer: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([Promise.allSettled(this.pendingAffect), new Promise((resolve) => { timer = setTimeout(resolve, 12_000); })]);
      if (timer) clearTimeout(timer);
    }
    if (epoch !== this.epoch) return;
    this.cancelEmotionRequests();
    for (const turn of this.turns) if (turn.affect?.note === "Analizando la voz con emotion2vec+…") turn.affect = unavailableAffect("El análisis no terminó antes de cerrar el informe.");
    this.patch({ affect: this.snap.affect.map((entry) => entry.estimate.note === "Analizando la voz con emotion2vec+…" ? { ...entry, estimate: unavailableAffect("El análisis no terminó antes de cerrar el informe.") } : entry) });
    const simulated = this.turns.length > 0 && this.turns.every((t) => t.simulated);
    const id = `r-${Date.now().toString(36)}`;
    try {
      const report = buildReport(
        {
          mission,
          profile: this.profile,
          permissions: this.permissions,
          ctx,
          turns: this.turns,
          startedAt: this.startedAt,
          endedAt: Date.now(),
          simulated,
          bargeIns: this.bargeIns,
          judge,
          experimentalEmotion: this.experimentalEmotion,
        },
        { id },
      );
      const store = getStore();
      store.saveReport(report); // guardrails run here
      store.saveChat([
        ...store.loadChat(),
        {
          id: `c-${Date.now().toString(36)}`,
          who: "asistente",
          text: `El informe de la sesión de ${this.profile.alias} ya está listo: «${report.headline}».`,
          chips: ["Ver el informe"],
          at: new Date().toISOString(),
          reportId: id,
        },
      ]);
      notifyStore();
      this.turns = [];
      this.analyzer.stop();
      this.unsubscribeFrames = null;
      this.dispatch({ type: "REPORT_SAVED" });
      this.patch({ phase: "finished", reportId: id });
    } catch (e) {
      this.patch({ phase: "error", error: e instanceof Error ? e.message : "No se pudo guardar el informe." });
    }
  }
}

const SERVER_SNAPSHOT = initialSnapshot();
