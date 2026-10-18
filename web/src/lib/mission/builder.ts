// Deterministic mission builder: turns pasted text into a mission with no LLM.
// It picks sentences for the grade's word range and fills question templates.
import type { Grade, Lang, Mission, Question } from "../types";
import { codeSwitching, contentWords, normalizeWord, SPANISH_STOPWORDS, tokenize } from "../signals/text";
import { verifyAgentUtterance } from "../signals/conversation";

export const GRADE_WORD_RANGE: Record<Grade, [number, number]> = {
  3: [40, 60],
  4: [60, 90],
  5: [90, 130],
  6: [90, 130],
};

export const MIN_PASTED_WORDS = 20;

export function detectTextLang(text: string): Lang {
  const c = codeSwitching(text);
  return c.quechua > c.spanish ? "qu" : "es";
}

function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?…])\s+(?=[¿¡"“«A-ZÁÉÍÓÚÑ0-9])/)
    .map((s) => s.trim())
    .filter((s) => tokenize(s).length > 0);
}

const wc = (s: string) => tokenize(s).length;
const stripEnd = (s: string) => s.replace(/[\s.,;:!?…]+$/, "");

function lowerFirst(s: string): string {
  const first = s.split(/\s+/)[0] ?? "";
  return SPANISH_STOPWORDS.has(normalizeWord(first)) ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

function pickReading(sentences: string[], grade: Grade): { reading: string[]; leftover: string[] } {
  const [, max] = GRADE_WORD_RANGE[grade];
  const reading: string[] = [];
  let n = 0;
  let i = 0;
  for (; i < sentences.length; i++) {
    const w = wc(sentences[i]);
    if (reading.length > 0 && n + w > max) break;
    reading.push(sentences[i]);
    n += w;
  }
  return { reading, leftover: sentences.slice(i) };
}

function buildObtiene(reading: string[], avoid: { idx: Set<number>; words: Set<string> }): Question {
  const candidates = reading.map((s, idx) => ({ s, idx })).filter(({ s, idx }) => wc(s) >= 6 && !avoid.idx.has(idx));
  const ordered = [...candidates.filter((c) => c.idx >= 1 && c.idx <= 3), ...candidates];
  for (const { s } of ordered) {
    const words = stripEnd(s).split(/\s+/);
    const last = words[words.length - 1];
    const nLast = normalizeWord(last);
    const prefix = words.slice(0, -1).join(" ");
    if (nLast.length >= 4 && !SPANISH_STOPWORDS.has(nLast) && !tokenize(prefix).includes(nLast) && !avoid.words.has(nLast)) {
      return {
        id: "o",
        kind: "obtiene",
        text: `Completa lo que dice la lectura: «${prefix}…»`,
        simpler: "Vuelve a mirar la lectura y busca esa frase. ¿Cómo termina?",
        answerKey: { primary: [last.replace(/[^\p{L}]/gu, "")], partial: [] },
      };
    }
  }
  const words = contentWords(reading.join(" "));
  const key = words[0] ?? "";
  return {
    id: "o",
    kind: "obtiene",
    text: "¿De qué habla la lectura? Dime una cosa que dice.",
    simpler: "¿Qué cosa aparece en la lectura?",
    answerKey: { primary: words.slice(0, 5), partial: [key] },
  };
}

function buildInfiere(reading: string[]): { q: Question; used: number[] } {
  const questionFrom = (effect: string, cause: string, used: number[]): { q: Question; used: number[] } => {
    const text = `¿Por qué ${lowerFirst(stripEnd(effect))}?`;
    const own = new Set(tokenize(text));
    return {
      q: {
        id: "i",
        kind: "infiere",
        text,
        simpler: "¿Qué pasó antes de eso en la lectura?",
        evidenceKeys: Array.from(new Set(contentWords(cause).filter((w) => !own.has(w)))),
      },
      used,
    };
  };
  for (let k = 0; k < reading.length; k++) {
    const s = stripEnd(reading[k]);
    const mid = /^(.{8,}?),?\s+porque\s+(.{4,})$/i.exec(s);
    if (mid) return questionFrom(mid[1], mid[2], [k]);
    const lead = /^(por eso|entonces|así que|por lo tanto),?\s+(.{4,})$/i.exec(s);
    if (lead && k > 0) return questionFrom(lead[2], reading[k - 1], [k - 1, k]);
    const conseq = /^(.{6,}?),\s*(entonces|por eso|así que)\s+(.{4,})$/i.exec(s);
    if (conseq) return questionFrom(conseq[3], conseq[1], [k]);
  }
  return {
    q: {
      id: "i",
      kind: "infiere",
      text: "¿Por qué crees que pasó lo que cuenta la lectura?",
      simpler: "¿Qué pasó primero y qué pasó después?",
      evidenceKeys: contentWords(reading[reading.length - 1] ?? ""),
    },
    used: [],
  };
}

export function findProtagonist(sentences: string[]): string | null {
  const counts = new Map<string, number>();
  for (const s of sentences) {
    const words = s.split(/\s+/).slice(1);
    for (const w of words) {
      const clean = w.replace(/[^\p{L}]/gu, "");
      if (/^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,}$/.test(clean)) counts.set(clean, (counts.get(clean) ?? 0) + 1);
    }
  }
  let best: string | null = null;
  let max = 0;
  for (const [w, c] of counts) if (c > max) { best = w; max = c; }
  if (best) return best;
  // A sentence-initial name that repeats across sentences.
  const initial = new Map<string, number>();
  for (const s of sentences) {
    const w = (s.split(/\s+/)[0] ?? "").replace(/[^\p{L}]/gu, "");
    if (w && !SPANISH_STOPWORDS.has(normalizeWord(w))) initial.set(w, (initial.get(w) ?? 0) + 1);
  }
  for (const [w, c] of initial) if (c >= 2) return w;
  return null;
}

function buildReflexiona(reading: string[]): Question {
  const name = findProtagonist(reading);
  return name
    ? { id: "r", kind: "reflexiona", text: `¿Qué opinas de lo que hizo ${name}? ¿Estuvo bien? ¿Por qué?`, simpler: `¿Te parece bien lo que hizo ${name}?` }
    : { id: "r", kind: "reflexiona", text: "¿Qué opinas de lo que cuenta la lectura? ¿Estás de acuerdo? ¿Por qué?", simpler: "¿Te parece bien o mal lo que pasa en la lectura?" };
}

const CONTRAST_RE = /\b(pero|aunque|sin embargo|en cambio)\b/i;

function buildCounter(reading: string[], leftover: string[]): string {
  const pick =
    leftover.find((s) => CONTRAST_RE.test(s)) ??
    reading.slice(1).find((s) => CONTRAST_RE.test(s)) ??
    leftover[0];
  if (pick) return pick;
  return "Imagina que otra persona leyó lo mismo y piensa justo lo contrario que tú.";
}

export type BuildResult = { ok: true; mission: Mission; warnings: string[] } | { ok: false; error: string };

export function buildMissionFromText(raw: string, { grade, now }: { grade: Grade; now?: string }): BuildResult {
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let title = "";
  let body = raw;
  if (lines.length > 1 && wc(lines[0]) <= 8 && !/[.!?]$/.test(lines[0])) {
    title = lines[0];
    body = lines.slice(1).join(" ");
  }
  if (wc(body) < MIN_PASTED_WORDS) {
    return { ok: false, error: `Necesito un texto de al menos ${MIN_PASTED_WORDS} palabras para armar la misión.` };
  }
  const sentences = splitSentences(body);
  const { reading, leftover } = pickReading(sentences, grade);
  const text = reading.join(" ");
  if (!title) title = stripEnd(reading[0]).split(/\s+/).slice(0, 5).join(" ") + "…";

  const infiere = buildInfiere(reading);
  const avoid = { idx: new Set(infiere.used), words: new Set([...tokenize(infiere.q.text), ...(infiere.q.evidenceKeys ?? [])]) };
  const mission: Mission = {
    id: `m-${hash(raw)}-${grade}`,
    title,
    lang: "es",
    grade,
    text,
    questions: [buildObtiene(reading, avoid), infiere.q, buildReflexiona(reading)],
    counter: { text: buildCounter(reading, leftover) },
    source: "pasted",
    createdAt: now ?? new Date().toISOString(),
  };
  const v = validateMission(mission);
  if (!v.valid) return { ok: false, error: v.errors.join(" ") };
  return { ok: true, mission, warnings: v.warnings };
}

// ---------------------------------------------------------------------------
// Validation (RF-46): structure, labels, length, no answer leaks
// ---------------------------------------------------------------------------

export function validateMission(m: Mission): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!m.text || wc(m.text) === 0) errors.push("Falta el texto de lectura.");
  if (!Array.isArray(m.questions) || m.questions.length !== 3) {
    errors.push("La misión debe tener 3 preguntas.");
  } else {
    const kinds = m.questions.map((q) => q.kind).join(",");
    if (kinds !== "obtiene,infiere,reflexiona") errors.push("Las preguntas deben ser Obtiene, Infiere y Reflexiona, en ese orden.");
    for (const q of m.questions) {
      if (!q.text?.trim()) errors.push(`La pregunta ${q.kind} está vacía.`);
      if (!verifyAgentUtterance(q.text ?? "", q).ok) errors.push(`La pregunta ${q.kind} revela la respuesta.`);
    }
    if (!m.questions[0]?.answerKey?.primary?.length) errors.push("La pregunta Obtiene necesita una respuesta clave.");
  }
  if (!m.counter?.text?.trim()) errors.push("Falta la contraprueba.");
  const range = GRADE_WORD_RANGE[m.grade] ?? GRADE_WORD_RANGE[4];
  const n = wc(m.text ?? "");
  if (n > range[1] + 40) errors.push("El texto es demasiado largo para el grado.");
  if (n > 0 && n < range[0]) warnings.push("El texto es más corto de lo recomendado para el grado.");
  return { valid: errors.length === 0, errors, warnings };
}
