// Judge contract shared by the rule judge and the optional Claude judge.
import type { Decision, Level, Mission, Question } from "../types";
import { scoreInfiere, scoreReflexiona } from "../scoring";
import { normalizeWord } from "../signals/text";

export interface JudgeRequest {
  kind: "infiere" | "reflexiona";
  question: string;
  answer: string;
  readingText: string;
  counterText?: string;
  decision?: Decision | null;
  evidenceKeys?: string[];
}

export interface JudgeResponse {
  source: "reglas" | "ia";
  level: Level;
  status: "ok" | "dudoso";
  quote: string;
  runs: Level[];
  fallbackReason?: string;
}

const MAX_LEN = 4000;
const isStr = (v: unknown, max = MAX_LEN): v is string => typeof v === "string" && v.length <= max;

export function parseJudgeRequest(body: unknown): JudgeRequest | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (b.kind !== "infiere" && b.kind !== "reflexiona") return null;
  if (!isStr(b.question) || !isStr(b.answer) || !isStr(b.readingText)) return null;
  if (b.counterText !== undefined && !isStr(b.counterText)) return null;
  if (b.decision !== undefined && b.decision !== null && b.decision !== "mantengo" && b.decision !== "cambio") return null;
  const keys = Array.isArray(b.evidenceKeys) ? b.evidenceKeys.filter((k): k is string => isStr(k, 60)).slice(0, 30) : undefined;
  return {
    kind: b.kind,
    question: b.question,
    answer: b.answer,
    readingText: b.readingText,
    counterText: b.counterText as string | undefined,
    decision: (b.decision as Decision | null | undefined) ?? null,
    evidenceKeys: keys,
  };
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

const RUBRICS: Record<JudgeRequest["kind"], string> = {
  infiere: `Rúbrica INFIERE (por qué pasó algo en el texto):
Nivel 0: la respuesta no se relaciona con el texto.
  Ejemplo: "porque quería jugar fútbol"
  Ejemplo: "no sé"
Nivel 1: repite partes del texto sin explicar la causa.
  Ejemplo: "llevaba dos baldes y cantaba"
  Ejemplo: "fue al puquio"
Nivel 2: da una inferencia válida (una causa razonable conectada con el texto).
  Ejemplo: "porque necesitaba agua para su familia"
  Ejemplo: "porque no había agua"
Nivel 3: inferencia válida apoyada en un dato concreto del texto.
  Ejemplo: "porque el río estaba seco"
  Ejemplo: "como el río se secó, tuvo que buscar agua en otro sitio"
Nivel NO: no hay evidencia suficiente (respuesta vacía, ininteligible o no entendió la pregunta).
  Ejemplo: ""
  Ejemplo: "¿qué?"`,
  reflexiona: `Rúbrica REFLEXIONA (opinión después de una contraprueba):
Nivel 0: responde sin razón o sin relación.
  Ejemplo: "no sé"
  Ejemplo: "porque sí"
Nivel 1: da una razón que no viene del texto ni del dato nuevo.
  Ejemplo: "porque Rosa es buena"
  Ejemplo: "porque a mí me gusta"
Nivel 2: la razón se apoya en el texto o en el dato nuevo.
  Ejemplo: "porque es lejos y estaba oscuro"
  Ejemplo: "porque su familia necesitaba agua y el río estaba seco"
Nivel 3: además considera otra opción o un límite.
  Ejemplo: "debió ir con su mamá, porque es lejos y estaba oscuro"
  Ejemplo: "hizo bien porque necesitaban agua, pero mejor hubiera esperado a que aclare"
Nivel NO: no hay evidencia suficiente (audio, ruido, no entendió).
  Ejemplo: ""
  Ejemplo: "¿otra vez?"
Mantener la idea con una buena razón vale igual que cambiarla con una buena razón.`,
};

export function buildJudgePrompt(req: JudgeRequest): { system: string; user: string } {
  const system = [
    "Eres un evaluador de comprensión lectora para niños de 8 a 12 años en Perú.",
    "Puntúas UNA respuesta oral transcrita según la rúbrica. No corriges ortografía ni forma de hablar, no juzgas el acento y no infieres emociones.",
    "La transcripción puede tener errores de reconocimiento de voz; sé tolerante con ellos.",
    RUBRICS[req.kind],
    'Devuelve el nivel ("0", "1", "2", "3" o "NO"), una cita textual corta copiada exactamente de la respuesta del niño que justifica el nivel, y una justificación breve.',
  ].join("\n\n");
  const user = [
    `<lectura>\n${req.readingText}\n</lectura>`,
    req.counterText ? `<dato_nuevo>\n${req.counterText}\n</dato_nuevo>` : "",
    req.decision ? `<decision_del_nino>${req.decision === "cambio" ? "cambió su idea" : "mantuvo su idea"}</decision_del_nino>` : "",
    `<pregunta>\n${req.question}\n</pregunta>`,
    `<respuesta_del_nino>\n${req.answer}\n</respuesta_del_nino>`,
  ]
    .filter(Boolean)
    .join("\n\n");
  return { system, user };
}

// ---------------------------------------------------------------------------
// Aggregation of 3 runs
// ---------------------------------------------------------------------------

const ORDER: Level[] = ["NO", 0, 1, 2, 3];

export function aggregateRuns(runs: Array<{ level: Level; quote: string }>): Omit<JudgeResponse, "source"> {
  const levels = runs.map((r) => r.level);
  const agree = levels.every((l) => l === levels[0]);
  const sorted = [...levels].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
  const level = agree ? levels[0] : sorted[Math.floor(sorted.length / 2)];
  const quote = runs.find((r) => r.level === level)?.quote ?? "";
  return { level, status: agree ? "ok" : "dudoso", quote, runs: levels };
}

export function sanitizeQuote(quote: string, answer: string): string {
  const q = quote.trim();
  if (q && normalizeWord(answer.replace(/\s+/g, "_")).includes(normalizeWord(q.replace(/\s+/g, "_")))) return q;
  return answer.trim();
}

// ---------------------------------------------------------------------------
// Rule judge (default and fallback)
// ---------------------------------------------------------------------------

export function judgeWithRules(req: JudgeRequest, fallbackReason?: string): JudgeResponse {
  const question: Question = { id: req.kind, kind: req.kind, text: req.question, simpler: "", evidenceKeys: req.evidenceKeys };
  const mission: Mission = {
    id: "judge",
    title: "",
    lang: "es",
    grade: 4,
    text: req.readingText,
    questions: [{ id: "o", kind: "obtiene", text: "", simpler: "" }, req.kind === "infiere" ? question : { ...question, kind: "infiere" }, { ...question, kind: "reflexiona" }],
    counter: { text: req.counterText ?? "" },
    source: "pasted",
    createdAt: "",
  };
  const s = req.kind === "infiere" ? scoreInfiere(req.answer, question, mission) : scoreReflexiona(req.answer, mission, { decision: req.decision ?? undefined });
  return { source: "reglas", level: s.level, status: "ok", quote: s.quote, runs: [], ...(fallbackReason ? { fallbackReason } : {}) };
}
