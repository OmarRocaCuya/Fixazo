// Shared domain types for Ñawinchay. Pure data, no browser APIs.

export type Lang = "es" | "qu";
export type Grade = 3 | 4 | 5 | 6;
export type QuestionKind = "obtiene" | "infiere" | "reflexiona";

/** Rubric level. "NO" = not observable (never the same as 0). */
export type Level = 0 | 1 | 2 | 3 | "NO";

export interface AnswerKey {
  /** Words that fully answer a literal question (score 3). */
  primary: string[];
  /** Words that partially answer it (score 2). */
  partial: string[];
}

export interface Question {
  id: string;
  kind: QuestionKind;
  /** Text shown (and spoken in Spanish sessions). In Quechua missions this is Quechua. */
  text: string;
  /** Spanish translation, used for TTS in Quechua sessions. */
  textEs?: string;
  /** Simpler rephrasing used as the second help. Always Spanish. */
  simpler: string;
  /** Only for "obtiene". Never shown to the family before the session. */
  answerKey?: AnswerKey;
  /** Content words that count as text evidence (infiere / reflexiona). */
  evidenceKeys?: string[];
}

export interface CounterEvidence {
  text: string;
  textEs?: string;
}

export type MissionSource = "sample" | "pasted" | "llm";

export interface Mission {
  id: string;
  title: string;
  lang: Lang;
  grade: Grade;
  /** Reading text the child reads aloud. */
  text: string;
  /** Spanish translation of the reading text (Quechua missions). */
  textEs?: string;
  questions: [Question, Question, Question];
  counter: CounterEvidence;
  source: MissionSource;
  createdAt: string;
}

/** Self-reported mood. The ONLY affect data the app keeps. */
export type Mood = "muy_bien" | "bien" | "regular" | "no_tan_bien" | "mal";
export type Confidence = "poco" | "mas_o_menos" | "muy";
export type Decision = "mantengo" | "cambio";

/** One audio analysis frame. Derived numbers only; raw samples are never kept. */
export interface FrameFeature {
  /** Milliseconds since the analyzer started. */
  t: number;
  rms: number;
  voiced: boolean;
  /** Fundamental frequency in Hz, null if unvoiced/undetected. */
  f0: number | null;
  /** Ratio of clipped samples in the frame (0..1). */
  clip: number;
}

/** Per-turn derived audio summary. Absolute pitch stays in memory only. */
export interface TurnAudioSummary {
  latencyMs: number | null;
  longPauses: number;
  finalIntonation: "sube" | "baja" | "plana" | null;
  meanF0: number | null;
  f0RangeSemitones: number | null;
  noiseFloorDb: number | null;
  snrDb: number | null;
  clippingRatio: number;
  speechDetected: boolean;
  possibleAdultHelp: boolean;
  speechMs: number;
}

export type TurnState = "READ" | "Q_OBTIENE" | "Q_INFIERE" | "STANCE" | "REVISE";

/** Provenance only: no word timings, confidence, credentials or raw audio. */
export interface TranscriptionProvenance {
  provider: "manual" | "web-speech" | "deepgram" | "local-whisper";
  model: "human-entered" | "browser-managed" | "nova-3" | "onnx-community/whisper-base_timestamped";
  language: Lang;
  timingsAvailable: boolean;
  normalization: "asr-may-normalize" | "manual-unverified";
}

export interface TurnRecord {
  state: TurnState;
  transcript: string;
  /** True when typed in simulation mode. */
  simulated: boolean;
  /** Audio summary; null in simulation or when the mic analyzer is unavailable. */
  audio: TurnAudioSummary | null;
  /** Latency typed by the adult in simulation mode (ms). */
  simulatedLatencyMs?: number | null;
  /** Reading duration in seconds (READ only). */
  readingSeconds?: number;
  /** True when the speech onset happened while the agent was speaking. */
  bargeIn?: boolean;
  /** True when measurement conditions made the turn not observable. */
  unobservable?: boolean;
  transcription?: TranscriptionProvenance;
  at: number;
}

export interface Profile {
  alias: string;
  grade: Grade;
  homeLang: Lang;
  readingLang: Lang;
}

export interface Permissions {
  voice: boolean;
  process: boolean; // "cómo lo dice"
  mood: boolean; // "cómo se siente"
}

export interface Consent {
  version: string;
  acceptedAt: string;
  permissions: Permissions;
}

export type ResultStatus = "ok" | "dudoso" | "no_observable";

export interface LevelResult {
  level: Level;
  withHelp: boolean;
  helps: number;
  quote: string;
  status: ResultStatus;
  source: "reglas" | "ia";
  explanation: string;
}

export interface JudgmentChain {
  stance: { present: boolean; quote: string };
  reason: { present: boolean; quote: string };
  evidence: { present: boolean; quote: string };
  alternative: { present: boolean; quote: string };
  revision: { decision: Decision | null; changed: boolean; withReason: boolean; quote: string };
}

export type Calibration = "ajustada" | "sobreconfianza" | "subconfianza" | "sin_dato";

export type ReviewTarget = QuestionKind | "lectura";
export type ReviewerRole = "familia" | "docente";
export type EvidenceDecision = "pendiente" | "confirmado" | "no_observable";
export interface ReportReview {
  status: "provisional" | "revisado";
  evidence: Record<ReviewTarget, {
    decision: EvidenceDecision;
    reviewedBy?: ReviewerRole;
    reviewedAt?: string;
  }>;
  /** A person's declaration, never an acoustic inference. */
  adultHelp: { declared: boolean; reviewedBy: ReviewerRole; reviewedAt: string } | null;
}

export interface Report {
  id: string;
  createdAt: string;
  durationSec: number;
  alias: string;
  missionTitle: string;
  missionId: string;
  lang: Lang;
  simulated: boolean;
  /** Missing on older reports: always treat them as provisional. */
  review?: ReportReview;
  /** Optional on older reports. Does not contain audio or per-word timings. */
  transcription?: TranscriptionProvenance[];
  headline: string;
  fluency: {
    /** Evidence to be checked by a person; absent on older reports. */
    quote?: string;
    status: "ok" | "no_observable";
    pcpm: number | null;
    accuracy: number | null;
    correct: number;
    attempted: number;
    selfCorrections: number;
    repetitions: number;
    substitutions: number;
    omissions: number;
    insertions: number;
    prosody: number | null;
    /** Words read differently (shown to adults only). */
    differentWords: string[];
  };
  levels: Record<QuestionKind, LevelResult>;
  chain: JudgmentChain;
  process: {
    enabled: boolean;
    audioAvailable: boolean;
    latencyMs: number | null;
    longPauses: number | null;
    selfCorrections: number;
    fillers: number;
    hedges: string[];
    finalIntonation: "sube" | "baja" | "plana" | null;
    confidence: Confidence | null;
    calibration: Calibration;
  };
  mood: { enabled: boolean; start: Mood | null; end: Mood | null; source: "autorreporte" };
  context: {
    noise: "ok" | "alto" | "no_disponible";
    saturated?: boolean;
    /** Legacy field; never evidence of adult help. New reports always set false. */
    possibleAdultHelp: boolean;
  };
  conversation: {
    repeatRequests: number;
    answerRequests: number;
    ownQuestions: string[];
    bargeIns: number;
    changedWithReason: boolean;
    keptWithReason: boolean;
  };
  homeQuestion: { es: string };
  notMeasured: string[];
}
