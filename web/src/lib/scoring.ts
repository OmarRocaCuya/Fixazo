// Rule-based scorer (default judge) for PRD §11. Process and affect signals
// never enter these levels (RF-78). "NO" (not observable) is never a 0.
import type { Confidence, Decision, JudgmentChain, Level, LevelResult, Mission, Question } from "./types";
import { containsAnyStem, contentWords, evidenceOverlap, hasCausalConnector, normalizeWord, tokenize } from "./signals/text";

export const MAX_HELPS = 2;

export interface Score {
  level: Level;
  quote: string;
  explanation: string;
}

interface ScoreOpts {
  unobservable?: boolean;
}

function notObservable(text: string, opts: ScoreOpts): Score | null {
  if (opts.unobservable) return { level: "NO", quote: text.trim(), explanation: "No se pudo escuchar bien la respuesta." };
  if (tokenize(text).length === 0) return { level: "NO", quote: "", explanation: "No hubo respuesta que se pudiera escuchar." };
  return null;
}

const NO_REASON_RE = /^(no se|ni idea|porque si|porque no|asi nomas|nada)$/;

function stripQuestionWords(words: string[], q: Question): string[] {
  const own = new Set([...tokenize(q.text), ...tokenize(q.textEs ?? "")]);
  return words.filter((w) => !own.has(normalizeWord(w)));
}

// ---------------------------------------------------------------------------

export function scoreObtiene(answer: string, q: Question, opts: ScoreOpts = {}): Score {
  const no = notObservable(answer, opts);
  if (no) return no;
  const key = q.answerKey ?? { primary: [], partial: [] };
  const quote = answer.trim();
  if (containsAnyStem(answer, key.primary).length > 0) return { level: 3, quote, explanation: "Encontró el dato exacto de la lectura." };
  if (containsAnyStem(answer, key.partial).length > 0) return { level: 2, quote, explanation: "Encontró parte del dato de la lectura." };
  return { level: 0, quote, explanation: "Todavía no encontró el dato en la lectura." };
}

export function scoreInfiere(answer: string, q: Question, mission: Mission): Score {
  const no = notObservable(answer, {});
  if (no) return no;
  const quote = answer.trim();
  const overlap = stripQuestionWords(evidenceOverlap(answer, `${mission.text} ${mission.textEs ?? ""}`), q);
  const evidence = containsAnyStem(answer, q.evidenceKeys ?? []);
  const causal = hasCausalConnector(answer);
  if (evidence.length > 0 && causal && overlap.length >= 2)
    return { level: 3, quote, explanation: "Explicó la causa y la apoyó con un dato del texto." };
  if (evidence.length > 0 || (causal && overlap.length > 0))
    return { level: 2, quote, explanation: "Dio una explicación válida de por qué pasó." };
  if (overlap.length > 0) return { level: 1, quote, explanation: "Repitió partes del texto sin explicar por qué." };
  return { level: 0, quote, explanation: "Su respuesta todavía no se relaciona con la lectura." };
}

export const ALTERNATIVE_MARKERS = [
  "debió", "debio", "debería", "deberia", "debía", "mejor", "en cambio", "otra opción", "otra opcion", "otra forma",
  "podría", "podria", "hubiera", "con su mamá", "con su mama", "con su papá", "con alguien", "acompañada", "acompañado",
  "sin embargo", "pero también", "ichaqa",
];

function findAlternative(text: string): string | null {
  const segments = text.split(/[.;!?]+/).map((s) => s.trim()).filter(Boolean);
  const lower = (s: string) => ` ${tokenize(s).join(" ")} `;
  for (const seg of segments) {
    const l = lower(seg);
    if (ALTERNATIVE_MARKERS.some((m) => l.includes(` ${tokenize(m).join(" ")} `))) return seg;
  }
  return null;
}

export function scoreReflexiona(reason: string, mission: Mission, opts: ScoreOpts & { decision?: Decision } = {}): Score {
  const no = notObservable(reason, opts);
  if (no) return no;
  const quote = reason.trim();
  const q = mission.questions[2];
  const joined = tokenize(reason).join(" ");
  const content = stripQuestionWords(contentWords(reason), q);
  if (NO_REASON_RE.test(joined) || content.length === 0) return { level: 0, quote, explanation: "Todavía no dio una razón." };
  const source = `${mission.text} ${mission.textEs ?? ""} ${mission.counter.text} ${mission.counter.textEs ?? ""}`;
  const overlap = stripQuestionWords(evidenceOverlap(reason, source), q);
  if (overlap.length === 0) return { level: 1, quote, explanation: "Dio una razón, pero no usó la lectura ni el dato nuevo." };
  // The decision (mantengo / cambio) never changes the level.
  if (findAlternative(reason)) return { level: 3, quote, explanation: "Usó un dato y además pensó en otra opción." };
  return { level: 2, quote, explanation: "Su razón se apoya en la lectura o en el dato nuevo." };
}

export function toLevelResult(score: Score, helps: number, source: "reglas" | "ia" = "reglas"): LevelResult {
  const h = Math.min(MAX_HELPS, Math.max(0, helps));
  return {
    level: score.level,
    withHelp: h > 0,
    helps: h,
    quote: score.quote,
    status: score.level === "NO" ? "no_observable" : "ok",
    source,
    explanation: score.explanation,
  };
}

// ---------------------------------------------------------------------------
// Judgment chain (Toulmin-style)
// ---------------------------------------------------------------------------

export function buildJudgmentChain({
  stance,
  reason,
  decision,
  mission,
}: {
  stance: string;
  reason: string;
  decision: Decision | null;
  mission: Mission;
}): JudgmentChain {
  const r = scoreReflexiona(reason, mission);
  const lvl = r.level === "NO" ? -1 : r.level;
  const source = `${mission.text} ${mission.textEs ?? ""} ${mission.counter.text}`;
  const evidenceWords = stripQuestionWords(evidenceOverlap(reason, source), mission.questions[2]);
  const alternative = findAlternative(reason);
  return {
    stance: { present: tokenize(stance).length > 0, quote: stance.trim() },
    reason: { present: lvl >= 1, quote: lvl >= 1 ? reason.trim() : "" },
    evidence: { present: lvl >= 2, quote: lvl >= 2 ? evidenceWords.join(", ") : "" },
    alternative: { present: alternative !== null, quote: alternative ?? "" },
    revision: {
      decision,
      changed: decision === "cambio",
      withReason: lvl >= 2,
      quote: reason.trim(),
    },
  };
}

// ---------------------------------------------------------------------------
// Calibration
// ---------------------------------------------------------------------------

export function calibrate(confidence: Confidence | null, levels: Level[]) {
  const nums = levels.filter((l): l is 0 | 1 | 2 | 3 => l !== "NO");
  if (!confidence || nums.length === 0) return "sin_dato" as const;
  const correct = nums.reduce<number>((a, b) => a + b, 0) / nums.length >= 2;
  if (confidence === "mas_o_menos") return "ajustada" as const;
  if (confidence === "muy") return correct ? ("ajustada" as const) : ("sobreconfianza" as const);
  return correct ? ("subconfianza" as const) : ("ajustada" as const);
}
