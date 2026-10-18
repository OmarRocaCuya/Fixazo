// Explicit session state machine (PRD §10). The orchestrator decides the order;
// language only fills templates inside each state. Pure: (ctx, event) → (ctx, effects).
import type { Confidence, Decision, Mission, Mood, Question, QuestionKind } from "../types";
import { classifyChildTurn, reaskWithoutAnswer, safeAgentUtterance } from "../signals/conversation";
import { MAX_HELPS } from "../scoring";

export type SessionState =
  | "CHECK_IN"
  | "READ"
  | "Q_OBTIENE"
  | "Q_INFIERE"
  | "STANCE"
  | "COUNTER"
  | "REVISE"
  | "CHECK_OUT"
  | "REPORT"
  | "DONE"
  | "PAUSED";

export const STEP_ORDER: SessionState[] = ["CHECK_IN", "READ", "Q_OBTIENE", "Q_INFIERE", "STANCE", "COUNTER", "REVISE", "CHECK_OUT"];

export const STEP_LABELS: Record<string, string> = {
  CHECK_IN: "Cómo llegas",
  READ: "Lee",
  Q_OBTIENE: "Qué dice",
  Q_INFIERE: "Por qué pasó",
  STANCE: "Qué opinas",
  COUNTER: "Contraprueba",
  REVISE: "Contraprueba",
  CHECK_OUT: "Cierre",
};

export type AnswerSlot = "obtiene" | "infiere" | "stance" | "revise";

export interface MachineContext {
  state: SessionState;
  resumeState: SessionState | null;
  alias: string;
  moodEnabled: boolean;
  helps: Record<QuestionKind, number>;
  answers: Partial<Record<AnswerSlot, string>>;
  awaitingConfidence: boolean;
  askedMore: boolean;
  confidence: Confidence | null;
  decision: Decision | null;
  moodStart: Mood | null;
  moodEnd: Mood | null;
  repeatRequests: number;
  answerRequests: number;
  ownQuestions: string[];
}

export type MachineEvent =
  | { type: "MOOD"; mood: Mood }
  | { type: "TIMEOUT" }
  | { type: "READ_DONE" }
  | { type: "ANSWER"; text: string }
  | { type: "SILENCE" }
  | { type: "CONFIDENCE"; value: Confidence }
  | { type: "DECISION"; value: Decision }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "REPORT_SAVED" };

export interface Utterance {
  /** What the agent voice says (always Spanish in this MVP). */
  speak: string;
  /** What is shown on screen (Quechua in Quechua missions). */
  show: string;
  /** Spanish subtitle when `show` is Quechua. */
  showEs?: string;
  kind: "prompt" | "help" | "reask" | "feedback";
}

export type ProductEvent =
  | "session_started"
  | "state_entered"
  | "help_given"
  | "answer_requested_blocked"
  | "session_paused"
  | "session_resumed"
  | "session_completed";

export type Effect =
  | { type: "say"; utterance: Utterance }
  | { type: "log"; name: ProductEvent; payload?: Record<string, unknown> }
  | { type: "record"; slot: AnswerSlot; text: string };

export interface MachineResult {
  ctx: MachineContext;
  effects: Effect[];
}

export function initialContext({ alias, moodEnabled }: { alias: string; moodEnabled: boolean }): MachineContext {
  return {
    state: "CHECK_IN",
    resumeState: null,
    alias,
    moodEnabled,
    helps: { obtiene: 0, infiere: 0, reflexiona: 0 },
    answers: {},
    awaitingConfidence: false,
    askedMore: false,
    confidence: null,
    decision: null,
    moodStart: null,
    moodEnd: null,
    repeatRequests: 0,
    answerRequests: 0,
    ownQuestions: [],
  };
}

// ---------------------------------------------------------------------------
// Utterances
// ---------------------------------------------------------------------------

const plain = (text: string, kind: Utterance["kind"] = "prompt"): Utterance => ({ speak: text, show: text, kind });

function questionUtterance(q: Question, mission: Mission, text = q.text, kind: Utterance["kind"] = "prompt"): Utterance {
  if (mission.lang === "qu" && text === q.text && q.textEs) {
    return { speak: q.textEs, show: q.text, showEs: q.textEs, kind };
  }
  return { speak: text, show: text, kind };
}

const QUESTION_FOR: Partial<Record<SessionState, number>> = { Q_OBTIENE: 0, Q_INFIERE: 1, STANCE: 2, REVISE: 2 };
const SLOT_FOR: Partial<Record<SessionState, AnswerSlot>> = { Q_OBTIENE: "obtiene", Q_INFIERE: "infiere", STANCE: "stance", REVISE: "revise" };
const KIND_FOR: Partial<Record<SessionState, QuestionKind>> = { Q_OBTIENE: "obtiene", Q_INFIERE: "infiere", STANCE: "reflexiona", REVISE: "reflexiona" };

export const CONFIDENCE_PROMPT = "¿Qué tan seguro o segura estás de tu idea?";
export const TELL_ME_MORE = "Cuéntame un poquito más.";

function counterUtterance(mission: Mission): Utterance {
  const text = `Mira este dato nuevo: ${mission.counter.text} ¿Mantienes tu idea o la cambias?`;
  return { speak: text, show: mission.counter.textEs ? mission.counter.text : text, kind: "prompt" };
}

function closingMessage(ctx: MachineContext): string {
  if (ctx.decision === "cambio") return "Hoy explicaste por qué cambiaste de idea.";
  if (ctx.decision === "mantengo") return "Hoy defendiste tu idea con tus propias razones.";
  return "Hoy pensaste en voz alta con tus propias palabras.";
}

/** The prompt the agent says when entering (or resuming) a state. */
export function promptFor(state: SessionState, ctx: MachineContext, mission: Mission): Utterance | null {
  switch (state) {
    case "CHECK_IN":
      return plain(`Hola, ${ctx.alias}. ¿Cómo llegas hoy? Elige una carita.`);
    case "READ":
      return plain(
        mission.lang === "qu"
          ? `Ahora lee en voz alta, en quechua. Si te equivocas, sigue no más.`
          : `Ahora lee en voz alta. Si te equivocas, sigue no más.`,
      );
    case "Q_OBTIENE":
    case "Q_INFIERE":
      return questionUtterance(mission.questions[QUESTION_FOR[state] as number], mission);
    case "STANCE":
      return ctx.awaitingConfidence ? plain(CONFIDENCE_PROMPT) : questionUtterance(mission.questions[2], mission);
    case "COUNTER":
      return counterUtterance(mission);
    case "REVISE":
      return plain("¿Por qué?");
    case "CHECK_OUT":
      return plain(ctx.moodEnabled ? `${closingMessage(ctx)} ¿Cómo te fuiste?` : closingMessage(ctx), "feedback");
    default:
      return null;
  }
}

function enter(ctx: MachineContext, state: SessionState, mission: Mission, extra: Effect[] = []): MachineResult {
  const next = { ...ctx, state };
  const effects: Effect[] = [...extra, { type: "log", name: "state_entered", payload: { state } }];
  const say = promptFor(state, next, mission);
  if (say) effects.push({ type: "say", utterance: say });
  if (state === "REPORT") effects.push({ type: "log", name: "session_completed" });
  return { ctx: next, effects };
}

// ---------------------------------------------------------------------------
// Transitions
// ---------------------------------------------------------------------------

export function start(ctx: MachineContext, mission: Mission): MachineResult {
  const first = ctx.moodEnabled ? "CHECK_IN" : "READ";
  return enter(ctx, first, mission, [{ type: "log", name: "session_started", payload: { missionId: mission.id, lang: mission.lang } }]);
}

const UNCHANGED = (ctx: MachineContext): MachineResult => ({ ctx, effects: [] });

function nextAfterAnswer(state: SessionState): SessionState {
  switch (state) {
    case "Q_OBTIENE":
      return "Q_INFIERE";
    case "Q_INFIERE":
      return "STANCE";
    case "REVISE":
      return "CHECK_OUT";
    default:
      return state;
  }
}

function giveHelp(ctx: MachineContext, mission: Mission, reason: "silencio" | "pidio_repetir"): MachineResult | null {
  const kind = KIND_FOR[ctx.state] as QuestionKind;
  const used = ctx.helps[kind];
  if (used >= MAX_HELPS) return null;
  const q = mission.questions[QUESTION_FOR[ctx.state] as number];
  const helps = { ...ctx.helps, [kind]: used + 1 };
  const utterance =
    ctx.state === "REVISE"
      ? plain("Te pregunto otra vez: ¿por qué piensas eso?", "help")
      : used === 0
        ? questionUtterance(q, mission, q.text, "help")
        : questionUtterance(q, mission, q.simpler, "help");
  if (used === 0 && utterance.kind === "help" && ctx.state !== "REVISE") {
    utterance.speak = `Te la repito. ${utterance.speak}`;
  }
  return {
    ctx: { ...ctx, helps },
    effects: [
      { type: "log", name: "help_given", payload: { state: ctx.state, kind, n: used + 1, reason } },
      { type: "say", utterance },
    ],
  };
}

function handleAnswer(ctx: MachineContext, text: string, mission: Mission, silence: boolean): MachineResult {
  const slot = SLOT_FOR[ctx.state] as AnswerSlot;
  const cls = classifyChildTurn(text);
  const q = mission.questions[QUESTION_FOR[ctx.state] as number];

  if (!silence && cls.asksAnswer) {
    const reask = safeAgentUtterance(reaskWithoutAnswer(q), q);
    return {
      ctx: { ...ctx, answerRequests: ctx.answerRequests + 1 },
      effects: [
        { type: "log", name: "answer_requested_blocked", payload: { state: ctx.state } },
        { type: "say", utterance: plain(reask, "reask") },
      ],
    };
  }

  const ownQuestions = cls.ownQuestions.length ? [...ctx.ownQuestions, ...cls.ownQuestions] : ctx.ownQuestions;
  const isRepeat = !silence && cls.asksRepeat;
  if (silence || cls.empty || isRepeat) {
    const base = isRepeat ? { ...ctx, repeatRequests: ctx.repeatRequests + 1 } : ctx;
    const helped = giveHelp(base, mission, isRepeat ? "pidio_repetir" : "silencio");
    if (helped) return helped;
    // Out of helps: record what we have (possibly nothing → NO observable) and move on.
    return advance({ ...base, ownQuestions }, slot, silence || isRepeat ? "" : text, mission);
  }

  if (ctx.state === "REVISE" && cls.tooShort && !ctx.askedMore) {
    return {
      ctx: { ...ctx, askedMore: true, ownQuestions, answers: { ...ctx.answers, revise: text.trim() } },
      effects: [{ type: "say", utterance: plain(TELL_ME_MORE, "help") }],
    };
  }

  const combined = ctx.state === "REVISE" && ctx.answers.revise ? `${ctx.answers.revise} ${text.trim()}` : text.trim();
  return advance({ ...ctx, ownQuestions }, slot, combined, mission);
}

function advance(ctx: MachineContext, slot: AnswerSlot, text: string, mission: Mission): MachineResult {
  const answers = { ...ctx.answers, [slot]: text };
  const record: Effect = { type: "record", slot, text };
  if (ctx.state === "STANCE") {
    const next = { ...ctx, answers, awaitingConfidence: true };
    const say = promptFor("STANCE", next, mission) as Utterance;
    return { ctx: next, effects: [record, { type: "say", utterance: say }] };
  }
  const nextState = nextAfterAnswer(ctx.state);
  if (nextState === "CHECK_OUT" && !ctx.moodEnabled) {
    const out = enter({ ...ctx, answers }, "CHECK_OUT", mission, [record]);
    const rep = enter(out.ctx, "REPORT", mission);
    return { ctx: rep.ctx, effects: [...out.effects, ...rep.effects] };
  }
  return enter({ ...ctx, answers }, nextState, mission, [record]);
}

export function transition(ctx: MachineContext, event: MachineEvent, mission: Mission): MachineResult {
  if (event.type === "PAUSE") {
    if (ctx.state === "PAUSED" || ctx.state === "REPORT" || ctx.state === "DONE") return UNCHANGED(ctx);
    return {
      ctx: { ...ctx, state: "PAUSED", resumeState: ctx.state },
      effects: [{ type: "log", name: "session_paused", payload: { state: ctx.state } }],
    };
  }
  if (event.type === "RESUME") {
    if (ctx.state !== "PAUSED" || !ctx.resumeState) return UNCHANGED(ctx);
    const state = ctx.resumeState;
    const next = { ...ctx, state, resumeState: null };
    const say = promptFor(state, next, mission);
    const effects: Effect[] = [{ type: "log", name: "session_resumed", payload: { state } }];
    if (say) effects.push({ type: "say", utterance: say });
    return { ctx: next, effects };
  }

  switch (ctx.state) {
    case "CHECK_IN":
      if (event.type === "MOOD") return enter({ ...ctx, moodStart: event.mood }, "READ", mission);
      if (event.type === "TIMEOUT") return enter(ctx, "READ", mission);
      return UNCHANGED(ctx);
    case "READ":
      if (event.type === "READ_DONE") return enter(ctx, "Q_OBTIENE", mission);
      return UNCHANGED(ctx);
    case "Q_OBTIENE":
    case "Q_INFIERE":
    case "REVISE":
      if (event.type === "ANSWER") return handleAnswer(ctx, event.text, mission, false);
      if (event.type === "SILENCE") return handleAnswer(ctx, "", mission, true);
      return UNCHANGED(ctx);
    case "STANCE":
      if (ctx.awaitingConfidence) {
        if (event.type === "CONFIDENCE") return enter({ ...ctx, confidence: event.value, awaitingConfidence: false }, "COUNTER", mission);
        return UNCHANGED(ctx);
      }
      if (event.type === "ANSWER") return handleAnswer(ctx, event.text, mission, false);
      if (event.type === "SILENCE") return handleAnswer(ctx, "", mission, true);
      return UNCHANGED(ctx);
    case "COUNTER":
      if (event.type === "DECISION") return enter({ ...ctx, decision: event.value }, "REVISE", mission);
      return UNCHANGED(ctx);
    case "CHECK_OUT":
      if (event.type === "MOOD") return enter({ ...ctx, moodEnd: event.mood }, "REPORT", mission);
      if (event.type === "TIMEOUT") return enter(ctx, "REPORT", mission);
      return UNCHANGED(ctx);
    case "REPORT":
      if (event.type === "REPORT_SAVED") return { ctx: { ...ctx, state: "DONE" }, effects: [{ type: "log", name: "state_entered", payload: { state: "DONE" } }] };
      return UNCHANGED(ctx);
    default:
      return UNCHANGED(ctx);
  }
}
