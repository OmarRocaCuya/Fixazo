// EXPERIMENTAL · opt-in only · adult view only · never used for grading.
//
// Emotion estimate from the VOICE (how the child speaks), never from the words.
// The transcript is not an input of any function in this module.
//  1. Primary: emotion2vec+ base on the private backend (9 classes) → Spanish.
// No emotion is inferred when the model is unavailable. Acoustic activation
// helpers remain only for historical compatibility, never the live estimator.
// Neither is validated with children, Peruvian Spanish or Quechua. It is an
// estimate, not a diagnosis. The child's own carita always prevails.
import type { FrameFeature, Mood, TurnState } from "../types";
import { hzToSemitones } from "../dsp";
import { paceFeatures } from "./pace";
import { speechOnset } from "./prosody";

export const MODEL_LABELS_ES = {
  angry: "enojado/a",
  disgusted: "disgustado/a",
  fearful: "con miedo",
  happy: "contento/a",
  neutral: "neutral",
  sad: "triste",
  surprised: "sorprendido/a",
  other: "sin datos suficientes",
  unknown: "sin datos suficientes",
} as const;

export const AFFECT_LABELS = [
  "enojado/a", "disgustado/a", "con miedo", "contento/a", "neutral", "triste", "sorprendido/a",
  "tranquilo/a", "activado/a", "apagado/a", "sin datos suficientes",
] as const;
export type AffectLabel = (typeof AFFECT_LABELS)[number];
export type AffectSource = "voz-emotion2vec" | "voz-local" | "sin-modelo";
export type AffectConfidence = "baja" | "media";

export const SOURCE_LABEL: Record<AffectSource, string> = {
  "voz-emotion2vec": "voz (emotion2vec+)",
  "voz-local": "voz (activación acústica histórica, no emoción)",
  "sin-modelo": "sin inferencia del modelo",
};

export const NO_AUDIO_MESSAGE = "sin audio: la estimación necesita el micrófono";

export interface AffectEstimate {
  label: AffectLabel;
  /** Never higher than "media". */
  confidence: AffectConfidence;
  source: AffectSource;
  /** Top probability from emotion2vec+ (0..1); null for the local fallback. */
  score: number | null;
  /** Local activation vs. the child's baseline (-1..1); null for the model. */
  activation: number | null;
  experimental: true;
  note?: string;
}

const clamp = (x: number) => Math.max(-1, Math.min(1, x));
const round2 = (x: number) => Math.round(x * 100) / 100;

// ---------------------------------------------------------------------------
// Voice features (derived numbers only)
// ---------------------------------------------------------------------------

export interface VoiceFeatures {
  peaksPerSec: number;
  meanF0: number | null;
  /** Standard deviation of F0 in semitones around its median. */
  f0VariabilitySt: number | null;
  meanRms: number | null;
  /** Share of silent frames between the first and last voiced frame. */
  pauseRatio: number;
  voicedSec: number;
  durationSec: number;
}

export function voiceFeatures(frames: FrameFeature[]): VoiceFeatures | null {
  const first = frames.findIndex((f) => f.voiced);
  let last = -1;
  for (let i = frames.length - 1; i >= 0; i--) if (frames[i].voiced) { last = i; break; }
  if (first < 0 || last <= first) return null;
  const span = frames.slice(first, last + 1);
  const frameMs = frames.length > 1 ? frames[1].t - frames[0].t : 20;
  const voiced = span.filter((f) => f.voiced);
  if (voiced.length * frameMs < 500) return null;
  const pace = paceFeatures(span);
  const f0s = voiced.map((f) => f.f0).filter((v): v is number => v !== null).sort((a, b) => a - b);
  let variability: number | null = null;
  if (f0s.length >= 5) {
    const median = f0s[Math.floor(f0s.length / 2)];
    const st = f0s.map((f) => hzToSemitones(f, median));
    const m = st.reduce((a, b) => a + b, 0) / st.length;
    variability = Math.sqrt(st.reduce((a, b) => a + (b - m) ** 2, 0) / st.length);
  }
  return {
    peaksPerSec: pace.peaksPerSec,
    meanF0: pace.meanF0,
    f0VariabilitySt: variability,
    meanRms: pace.meanRms,
    pauseRatio: 1 - voiced.length / span.length,
    voicedSec: (voiced.length * frameMs) / 1000,
    durationSec: pace.durationSec,
  };
}

/** The child's own baseline: first 30 s after speech onset, at least 5 s voiced. */
export function voiceBaseline(frames: FrameFeature[], windowMs = 30000, minVoicedSec = 5): VoiceFeatures | null {
  const onset = speechOnset(frames);
  if (onset === null) return null;
  const f = voiceFeatures(frames.filter((x) => x.t >= onset && x.t < onset + windowMs));
  return f && f.voicedSec >= minVoicedSec ? f : null;
}

// ---------------------------------------------------------------------------
// Local audio-only fallback
// ---------------------------------------------------------------------------

export const HIGH_ACTIVATION = 0.25;

/** Weighted log-ratios vs. the baseline, scaled so that ±0.5 reaches ±1. */
export function localActivation(base: VoiceFeatures | null, turn: VoiceFeatures | null): number | null {
  if (!base || !turn) return null;
  const parts: Array<[number, number]> = [];
  if (base.peaksPerSec > 0 && turn.peaksPerSec > 0) parts.push([Math.log2(turn.peaksPerSec / base.peaksPerSec), 0.3]);
  if (base.meanF0 && turn.meanF0) parts.push([Math.log2(turn.meanF0 / base.meanF0), 0.25]);
  if (base.f0VariabilitySt !== null && turn.f0VariabilitySt !== null) parts.push([Math.log2((turn.f0VariabilitySt + 0.5) / (base.f0VariabilitySt + 0.5)), 0.15]);
  if (base.meanRms && turn.meanRms) parts.push([Math.log2(turn.meanRms / base.meanRms), 0.2]);
  parts.push([clamp(-(turn.pauseRatio - base.pauseRatio) * 2), 0.1]);
  const w = parts.reduce((a, [, wt]) => a + wt, 0);
  return round2(clamp(parts.reduce((a, [v, wt]) => a + v * wt, 0) / w / 0.5));
}

export function estimateLocalAffect(base: VoiceFeatures | null, turn: VoiceFeatures | null): AffectEstimate {
  const common = { confidence: "baja" as const, source: "voz-local" as const, score: null, experimental: true as const };
  if (!base) return { ...common, label: "sin datos suficientes", activation: null, note: "falta la línea base de la voz (lectura en voz alta)" };
  const activation = localActivation(base, turn);
  if (activation === null) return { ...common, label: "sin datos suficientes", activation: null, note: "no hubo suficiente voz en el turno" };
  const label: AffectLabel = activation > HIGH_ACTIVATION ? "activado/a" : activation < -HIGH_ACTIVATION ? "apagado/a" : "tranquilo/a";
  const note = label === "activado/a" ? "la voz sola no distingue ánimo de tensión" : undefined;
  return { ...common, label, activation, ...(note ? { note } : {}) };
}

// ---------------------------------------------------------------------------
// emotion2vec+ result → Spanish
// ---------------------------------------------------------------------------

export interface EmotionModelResult {
  labels: Array<{ label: string; score: number }>;
  top: { label: string; score: number };
  model: string;
}

export function mapModelResult(result: EmotionModelResult): AffectEstimate {
  const top = result.top;
  const label: AffectLabel = Object.hasOwn(MODEL_LABELS_ES, top.label) ? MODEL_LABELS_ES[top.label as keyof typeof MODEL_LABELS_ES] : "sin datos suficientes";
  const score = Number.isFinite(top.score) ? round2(Math.max(0, Math.min(1, top.score))) : 0;
  return { label, confidence: score >= 0.6 ? "media" : "baja", source: "voz-emotion2vec", score, activation: null, experimental: true };
}

export function unavailableAffect(note = "emotion2vec+ no está disponible; no se sustituye con texto ni heurísticas"): AffectEstimate {
  return { label: "sin datos suficientes", confidence: "baja", source: "sin-modelo", score: null, activation: null, experimental: true, note };
}

// ---------------------------------------------------------------------------
// Estimator interface (audio only)
// ---------------------------------------------------------------------------

export interface AffectAudioInput {
  /** This answer turn's derived frame features. */
  frames: FrameFeature[];
  /** The child's own baseline from reading aloud; null if unavailable. */
  baseline: VoiceFeatures | null;
  /** emotion2vec+ result from the private backend, or null (unavailable). */
  remote: EmotionModelResult | null;
}

export interface AffectEstimator {
  readonly id: string;
  estimate(input: AffectAudioInput): AffectEstimate;
}

export const voiceAffectEstimator: AffectEstimator = {
  id: "voz-emotion2vec+-v3",
  estimate: ({ remote }) => (remote ? mapModelResult(remote) : unavailableAffect()),
};

/** Turn-level entry point. The turn's transcript is deliberately ignored. */
export function analyzeTurnAffect(_turn: { state: TurnState; transcript: string }, input: AffectAudioInput, estimator: AffectEstimator = voiceAffectEstimator): AffectEstimate {
  return estimator.estimate({ frames: input.frames, baseline: input.baseline, remote: input.remote });
}

// ---------------------------------------------------------------------------
// Session summary for the report
// ---------------------------------------------------------------------------

export type Agreement = "coincide" | "no coincide" | "sin comparación";

export interface ExperimentalAffectEntry {
  state: TurnState;
  label: AffectLabel;
  confidence: AffectConfidence;
  source: AffectSource;
  score: number | null;
  activation: number | null;
  experimental: true;
}

export interface ExperimentalAffectReport {
  experimental: true;
  method: string;
  turns: ExperimentalAffectEntry[];
  overall: AffectLabel;
  agreement: { start: Agreement; end: Agreement };
}

const LABEL_POLARITY: Partial<Record<AffectLabel, -1 | 0 | 1>> = {
  "contento/a": 1, neutral: 0, "enojado/a": -1, "disgustado/a": -1, "con miedo": -1, triste: -1,
};
const MOOD_POLARITY: Record<Mood, -1 | 0 | 1> = { muy_bien: 1, bien: 1, regular: 0, no_tan_bien: -1, mal: -1 };

export function moodAgreement(mood: Mood | null, label: AffectLabel | null): Agreement {
  if (!mood || !label) return "sin comparación";
  const p = LABEL_POLARITY[label];
  if (p === undefined) return "sin comparación";
  return p === MOOD_POLARITY[mood] ? "coincide" : "no coincide";
}

export function summarizeAffect(
  entries: Array<{ state: TurnState; estimate: AffectEstimate }>,
  moodStart: Mood | null,
  moodEnd: Mood | null,
  method = voiceAffectEstimator.id,
): ExperimentalAffectReport {
  const turns: ExperimentalAffectEntry[] = entries.map(({ state, estimate: e }) => ({
    state, label: e.label, confidence: e.confidence, source: e.source, score: e.score, activation: e.activation, experimental: true,
  }));
  const known = turns.filter((x) => x.label !== "sin datos suficientes");
  const counts = new Map<AffectLabel, number>();
  for (const x of known) counts.set(x.label, (counts.get(x.label) ?? 0) + 1);
  let overall: AffectLabel = "sin datos suficientes";
  let best = 0;
  for (const x of known) {
    const c = counts.get(x.label) as number;
    if (c > best) { best = c; overall = x.label; }
  }
  return {
    experimental: true,
    method,
    turns,
    overall,
    agreement: { start: moodAgreement(moodStart, known[0]?.label ?? null), end: moodAgreement(moodEnd, known.at(-1)?.label ?? null) },
  };
}

/** Strict shape check used by the guardrails (no extra keys, bounded numbers). */
export function experimentalAffectViolations(value: unknown): string[] {
  const out: string[] = [];
  const isLabel = (v: unknown) => typeof v === "string" && (AFFECT_LABELS as readonly string[]).includes(v);
  const agreements = ["coincide", "no coincide", "sin comparación"];
  const bounded = (v: unknown, min: number) => v === null || (typeof v === "number" && Number.isFinite(v) && v >= min && v <= 1);
  if (!value || typeof value !== "object" || Array.isArray(value)) return ["experimentalAffect: must be an object"];
  const block = value as Record<string, unknown>;
  for (const k of Object.keys(block)) if (!["experimental", "method", "turns", "overall", "agreement"].includes(k)) out.push(`experimentalAffect.${k}: field not allowed`);
  if (block.experimental !== true) out.push("experimentalAffect: must be marked experimental");
  if (typeof block.method !== "string" || block.method.length > 80) out.push("experimentalAffect.method: invalid");
  if (!isLabel(block.overall)) out.push("experimentalAffect.overall: invalid label");
  const ag = block.agreement as Record<string, unknown> | undefined;
  if (!ag || typeof ag !== "object" || Object.keys(ag).length !== 2 || !agreements.includes(String(ag.start)) || !agreements.includes(String(ag.end))) {
    out.push("experimentalAffect.agreement: invalid");
  }
  if (!Array.isArray(block.turns)) return [...out, "experimentalAffect.turns: must be an array"];
  const allowed = ["state", "label", "confidence", "source", "score", "activation", "experimental"];
  block.turns.forEach((entry, i) => {
    const p = `experimentalAffect.turns[${i}]`;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return out.push(`${p}: must be an object`);
    const e = entry as Record<string, unknown>;
    for (const k of Object.keys(e)) if (!allowed.includes(k)) out.push(`${p}.${k}: field not allowed`);
    if (e.experimental !== true) out.push(`${p}: must be marked experimental`);
    if (!isLabel(e.label)) out.push(`${p}.label: invalid`);
    if (e.confidence !== "baja" && e.confidence !== "media") out.push(`${p}.confidence: invalid`);
    if (e.source !== "voz-emotion2vec" && e.source !== "voz-local" && e.source !== "sin-modelo") out.push(`${p}.source: invalid`);
    if (!bounded(e.score, 0)) out.push(`${p}.score: must be null or 0..1`);
    if (!bounded(e.activation, -1)) out.push(`${p}.activation: must be null or -1..1`);
    if (typeof e.state !== "string") out.push(`${p}.state: invalid`);
  });
  return out;
}
