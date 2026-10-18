// Layer 5 · "Conversación": what the child does in the dialogue, plus the
// output verifier that keeps the agent from ever giving the answer (RF-61).
import type { Decision, Level, Question } from "../types";
import { answerLength, containsAnyStem, normalizeWord, tokenize } from "./text";

export interface ChildTurnClass {
  empty: boolean;
  tooShort: boolean;
  asksRepeat: boolean;
  asksAnswer: boolean;
  dontKnow: boolean;
  ownQuestions: string[];
}

const REPEAT_RE = /\b(otra vez|repite|repitelo|repiteme|repitemelo|no entendi|no escuche|que dijiste|de nuevo)\b/;
const ANSWER_RE = /\b(dime la respuesta|cual es la respuesta|dimelo|dime cual es|dame la respuesta|dime tu|tu dime|dime que es)\b/;
const QUESTION_START_RE = /^(por qué|qué|cómo|dónde|cuándo|quién|cuál|para qué)\s/i;

export function classifyChildTurn(text: string): ChildTurnClass {
  const tokens = tokenize(text);
  const joined = tokens.join(" ");
  const empty = tokens.length === 0;
  const asksRepeat = REPEAT_RE.test(joined) || joined === "que" || joined === "ah que";
  const asksAnswer = ANSWER_RE.test(joined);

  const ownQuestions: string[] = [];
  if (!asksRepeat && !asksAnswer) {
    const marked = text.match(/¿[^?]*\?|[^.?!¿]+\?/g);
    if (marked) ownQuestions.push(...marked.map((s) => s.trim()).filter((s) => answerLength(s) >= 2));
    else if (QUESTION_START_RE.test(text.trim())) ownQuestions.push(text.trim());
  }

  return {
    empty,
    tooShort: !empty && tokens.length < 3,
    asksRepeat,
    asksAnswer,
    dontKnow: /\b(no se|ni idea)\b/.test(joined),
    ownQuestions,
  };
}

export interface Interval {
  start: number;
  end: number;
}

/** Speech onset while the agent's voice was playing. */
export function isBargeIn(onsetMs: number, agentSpeaking: Interval[]): boolean {
  return agentSpeaking.some((i) => onsetMs >= i.start && onsetMs <= i.end);
}

// ---------------------------------------------------------------------------
// Answer-leak verifier
// ---------------------------------------------------------------------------

const LEAK_PHRASES = /(la respuesta (correcta )?es|la respuesta seria|te digo la respuesta|la respuesta correcta)/;

function leakWords(q: Question): string[] {
  const keys = [
    ...(q.answerKey?.primary ?? []),
    ...(q.answerKey?.partial ?? []),
    ...(q.kind === "infiere" ? q.evidenceKeys ?? [] : []),
  ];
  const own = new Set([...tokenize(q.text), ...tokenize(q.textEs ?? ""), ...tokenize(q.simpler)]);
  return keys.filter((k) => !own.has(normalizeWord(k)));
}

export function verifyAgentUtterance(utterance: string, q: Question): { ok: boolean; leaked: string[] } {
  const joined = tokenize(utterance).join(" ");
  const leaked = containsAnyStem(utterance, leakWords(q));
  if (LEAK_PHRASES.test(joined)) leaked.push("frase de respuesta");
  return { ok: leaked.length === 0, leaked };
}

const HINTS: Record<Question["kind"], string> = {
  obtiene: "Vuelve a mirar la lectura y busca la parte que habla de eso.",
  infiere: "Piensa en lo que pasó antes en la historia.",
  reflexiona: "Aquí no hay una sola respuesta: quiero saber qué piensas tú y por qué.",
};

/** What the agent says when the child asks for the answer. Never contains it. */
export function reaskWithoutAnswer(q: Question): string {
  const base = `Yo no te voy a dar la respuesta, pero sé que tú puedes. ${HINTS[q.kind]}`;
  const withSimpler = `${base} ${q.simpler}`;
  return verifyAgentUtterance(withSimpler, q).ok ? withSimpler : base;
}

/** Blocks any agent utterance that would reveal the answer. */
export function safeAgentUtterance(utterance: string, q: Question): string {
  return verifyAgentUtterance(utterance, q).ok ? utterance : reaskWithoutAnswer(q);
}

// ---------------------------------------------------------------------------
// Revision after the counter-evidence
// ---------------------------------------------------------------------------

export type RevisionQuality = "sin_razon" | "razon_externa" | "razon_con_dato" | "considera_otra";

/** Keeping the idea with a good reason is worth the same as changing with a good reason. */
export function revisionQuality(decision: Decision, level: Level): { kind: "mantiene" | "cambia"; withReason: boolean; quality: RevisionQuality } {
  const kind = decision === "cambio" ? "cambia" : "mantiene";
  const quality: RevisionQuality =
    level === 3 ? "considera_otra" : level === 2 ? "razon_con_dato" : level === 1 ? "razon_externa" : "sin_razon";
  return { kind, withReason: level === 2 || level === 3, quality };
}
