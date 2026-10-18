// Guardrails: what Ñawinchay must NEVER compute or store.
//  (a) labeled emotions — mood only by the child's self-report;
//  (b) voice identity: voiceprints, speaker embeddings, speaker IDs — only an alias;
//  (c) judgments about accent or way of speaking;
//  (d) health signals (hoarseness, breathing…).
// Plus: live pace state and raw audio are never persisted.
// Exception (demo): an `experimentalAffect` block is allowed ONLY with every entry
// marked experimental and nothing but labels and two bounded numbers. It never
// feeds scoring and is never invented without a real model result.
// `assertReportIsClean` runs before ANY report is saved (see storage.ts).
import { experimentalAffectViolations } from "./signals/affect";

export const FORBIDDEN_FIELDS = [
  // (a) emotions
  "emotion", "emotions", "emotionLabel", "detectedEmotion", "emocion", "emociones", "sentiment", "affect", "affectLabel",
  // (b) voice identity
  "voiceprint", "voicePrint", "speakerEmbedding", "embedding", "speakerId", "voiceId", "speakerIdentity", "xvector", "dvector",
  // (c) accent / way of speaking
  "accent", "accentScore", "acento", "dialectScore", "speakingStyle", "wayOfSpeaking", "pronunciationJudgment",
  // (d) health
  "hoarseness", "ronquera", "breathing", "breathingRate", "respiracion", "health", "salud", "voiceHealth", "jitter", "shimmer",
  // live-only / raw
  "pace", "paceState", "audio", "audioBlob", "rawAudio", "samples", "pcm", "waveform", "recording",
] as const;

/** Emotion words the system must never assign as labels. */
export const EMOTION_LABELS = [
  "ansioso", "ansiosa", "triste", "enojado", "enojada", "feliz", "frustrado", "frustrada", "nervioso", "nerviosa",
  "asustado", "asustada", "miedo", "estresado", "estresada", "aburrido", "aburrida", "alegre", "deprimido", "deprimida",
  "anxious", "sad", "angry", "happy", "frustrated", "nervous", "scared", "stressed", "bored",
];

export const MOOD_VALUES = ["muy_bien", "bien", "regular", "no_tan_bien", "mal"];

/** Shown in every report under "Lo que no medimos". */
export const NOT_MEASURED = [
  "Emociones con etiqueta para calificar: la estimación experimental nunca entra en la nota.",
  "Identidad de la voz: no guardamos huellas de voz; solo usamos su alias.",
  "Acento o forma de hablar: no se juzga ni se califica.",
  "Señales de salud (ronquera, respiración): no se miden.",
];

// Fields that hold the child's own words or adult-facing copy.
const FREE_TEXT_KEYS = new Set(["quote", "ownquestions", "headline", "es", "differentwords", "hedges", "missiontitle", "explanation", "alias", "notmeasured", "text"]);

const norm = (k: string) =>
  k
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z]/g, "");

const FORBIDDEN_NORMALIZED = new Set(FORBIDDEN_FIELDS.map(norm));
const FORBIDDEN_STEMS = ["emotion", "emocion", "sentiment", "voiceprint", "embedding", "speakerid", "voiceid", "accent", "acento", "hoarse", "ronquera", "breath", "respirac", "health", "salud"];

export function isForbiddenKey(key: string): boolean {
  const n = norm(key);
  if (FORBIDDEN_NORMALIZED.has(n)) return true;
  return FORBIDDEN_STEMS.some((s) => n.includes(s));
}

function isBinary(value: unknown): boolean {
  if (typeof ArrayBuffer !== "undefined" && (value instanceof ArrayBuffer || ArrayBuffer.isView(value))) return true;
  if (typeof Blob !== "undefined" && value instanceof Blob) return true;
  return false;
}

export function findViolations(value: unknown, path = "report", parentKey = ""): string[] {
  const out: string[] = [];
  if (isBinary(value)) {
    out.push(`${path}: audio/binary data`);
    return out;
  }
  if (typeof value === "string") {
    if (!FREE_TEXT_KEYS.has(norm(parentKey)) && EMOTION_LABELS.includes(value.toLowerCase())) out.push(`${path}: emotion label "${value}"`);
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => out.push(...findViolations(v, `${path}[${i}]`, parentKey)));
    return out;
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      // The opt-in experimental block is validated separately with a strict
      // allowlist (see assertReportIsClean); only there may emotion words appear.
      if (path === "report" && k === "experimentalAffect") continue;
      if (isForbiddenKey(k)) out.push(`${path}.${k}: forbidden field`);
      out.push(...findViolations(v, `${path}.${k}`, k));
    }
    if (path === "report" && "mood" in (value as Record<string, unknown>)) {
      const mood = (value as { mood?: { source?: unknown; start?: unknown; end?: unknown } }).mood;
      if (mood && mood.source !== "autorreporte") out.push("report.mood: mood must be self-reported");
      for (const m of [mood?.start, mood?.end]) {
        if (m !== null && m !== undefined && !MOOD_VALUES.includes(String(m))) out.push(`report.mood: invalid mood "${String(m)}"`);
      }
    }
  }
  return out;
}

export class GuardrailViolation extends Error {
  constructor(public readonly violations: string[]) {
    super(`Guardrail violation: ${violations.join("; ")}`);
    this.name = "GuardrailViolation";
  }
}

/** Throws if the report contains anything the product promised not to measure. */
export function assertReportIsClean(report: unknown): void {
  const v = findViolations(report);
  if (report && typeof report === "object" && "experimentalAffect" in report) {
    const block = (report as { experimentalAffect?: unknown }).experimentalAffect;
    if (block !== undefined) v.push(...experimentalAffectViolations(block));
  }
  if (v.length > 0) throw new GuardrailViolation(v);
}
