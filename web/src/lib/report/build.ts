// Builds the family report (F5) from a finished session. Pure.
// Pace (layer 3) is deliberately NOT an input: it never reaches a report.
import type { Level, LevelResult, Mission, Permissions, Profile, QuestionKind, Report, ReportReview, ReviewerRole, ReviewTarget, TurnRecord, TurnState } from "../types";
import type { MachineContext } from "../session/machine";
import { readingMetrics } from "../signals/reading";
import { countFillers, prosodyScore } from "../signals/prosody";
import { assessContext } from "../signals/context";
import { buildJudgmentChain, calibrate, scoreInfiere, scoreObtiene, scoreReflexiona, toLevelResult } from "../scoring";
import { NOT_MEASURED } from "../guardrails";
import { findProtagonist, splitSentences } from "../mission/builder";
import { mean } from "../dsp";
import { cleanTranscriptionProvenance } from "../transcription";

export interface JudgeOutcome {
  level: Level;
  status: "ok" | "dudoso";
  quote: string;
  runs: Level[];
}

export interface SessionRecord {
  mission: Mission;
  profile: Profile;
  permissions: Permissions;
  ctx: MachineContext;
  turns: TurnRecord[];
  startedAt: number;
  endedAt: number;
  simulated: boolean;
  bargeIns: number;
  judge?: Partial<Record<"infiere" | "reflexiona", JudgeOutcome>>;
}

const ANSWER_STATES: TurnState[] = ["Q_OBTIENE", "Q_INFIERE", "STANCE", "REVISE"];

function turnsOf(turns: TurnRecord[], state: TurnState) {
  return turns.filter((t) => t.state === state);
}

function unobservable(turns: TurnRecord[], state: TurnState): boolean {
  const ts = turnsOf(turns, state);
  return ts.at(-1)?.unobservable === true;
}

export function provisionalReview(): ReportReview {
  return {
    status: "provisional",
    evidence: {
      lectura: { decision: "pendiente" }, obtiene: { decision: "pendiente" },
      infiere: { decision: "pendiente" }, reflexiona: { decision: "pendiente" },
    },
    adultHelp: null,
  };
}

/** Human review is explicit, attributable to a role, and independent of doubt cues. */
export function reviewReport(
  report: Report,
  action: { target: ReviewTarget; decision: "confirmado" | "no_observable"; role: ReviewerRole } | { adultHelp: boolean; role: ReviewerRole },
  now = new Date().toISOString(),
): Report {
  const review = report.review ?? provisionalReview();
  if ("adultHelp" in action) {
    return { ...report, review: { ...review, adultHelp: { declared: action.adultHelp, reviewedBy: action.role, reviewedAt: now } } };
  }
  const evidence = { ...review.evidence, [action.target]: { decision: action.decision, reviewedBy: action.role, reviewedAt: now } };
  const result: Report = {
    ...report,
    review: { ...review, evidence, status: Object.values(evidence).every((e) => e.decision !== "pendiente") ? "revisado" : "provisional" },
  };
  if (action.decision === "no_observable") {
    result.headline = `${firstWord(report.alias)} completó su misión de lectura`;
    if (action.target === "lectura") {
      result.fluency = { ...report.fluency, status: "no_observable", pcpm: null, accuracy: null, prosody: null };
    } else {
      result.levels = { ...report.levels, [action.target]: { ...report.levels[action.target], level: "NO", status: "no_observable", explanation: "La familia o docente marcó esta evidencia como no observable; no equivale a 0." } };
      result.process = { ...report.process, calibration: calibrate(report.process.confidence, [result.levels.obtiene.level, result.levels.infiere.level]) };
      if (action.target === "reflexiona") {
        result.chain = { ...report.chain, stance: { ...report.chain.stance, present: false }, reason: { ...report.chain.reason, present: false }, evidence: { ...report.chain.evidence, present: false }, alternative: { ...report.chain.alternative, present: false }, revision: { ...report.chain.revision, withReason: false } };
        result.conversation = { ...report.conversation, changedWithReason: false, keptWithReason: false };
      }
    }
  }
  return result;
}

function recordingIsObservable(turn: TurnRecord): boolean {
  return !turn.unobservable && (!turn.audio || assessContext(turn.audio).observable);
}

const numeric = (l: Level): number => (l === "NO" ? -1 : l);
const firstWord = (s: string) => s.trim().split(/\s+/)[0] || "Tu hijo";

export function makeHeadline(alias: string, levels: Record<QuestionKind, LevelResult>, decision: MachineContext["decision"], pcpm: number | null): string {
  const a = firstWord(alias);
  const ok = (k: QuestionKind) => (levels[k].status === "ok" ? numeric(levels[k].level) : -1);
  let h: string;
  if (decision && ok("reflexiona") >= 2) h = decision === "cambio" ? `${a} cambió de opinión con una buena razón` : `${a} defendió su idea con una buena razón`;
  else if (ok("infiere") >= 2) h = `${a} explicó por qué pasó lo que leyó`;
  else if (ok("obtiene") >= 2) h = `${a} encontró datos importantes en la lectura`;
  else if (pcpm !== null) h = `${a} leyó ${pcpm} palabras correctas por minuto`;
  else h = `${a} completó su misión de lectura`;
  return h.split(/\s+/).slice(0, 10).join(" ");
}

function homeQuestion(mission: Mission, levels: Record<QuestionKind, LevelResult>): string {
  const name = findProtagonist(splitSentences([mission.textEs ?? mission.text, ...mission.questions.map((q) => q.textEs ?? q.text)].join(" ")));
  const who = name ?? "el personaje";
  const lvl = (k: QuestionKind) => numeric(levels[k].level);
  if (lvl("reflexiona") < 2) return `Si tú fueras ${who}, ¿qué habrías hecho? ¿Por qué?`;
  if (lvl("infiere") < 2) return `¿Por qué crees que pasó lo que cuenta «${mission.title}»?`;
  if (lvl("obtiene") < 2) return `¿Me cuentas con tus palabras qué pasa en «${mission.title}»?`;
  return `¿Qué otro dato te haría cambiar de idea sobre lo que hizo ${who}?`;
}

function judged(rule: LevelResult, j: JudgeOutcome | undefined): LevelResult {
  if (!j || rule.level === "NO") return rule;
  return { ...rule, level: j.level, status: j.status, source: "ia", quote: j.quote || rule.quote };
}

export function buildReport(rec: SessionRecord, { id, now }: { id: string; now?: string }): Report {
  const { mission, ctx, permissions } = rec;
  const turns = rec.turns.map((t) => ({ ...t, unobservable: !recordingIsObservable(t) }));
  const [qO, qI] = mission.questions;

  // --- Fluency -------------------------------------------------------------
  const read = turnsOf(turns, "READ").at(-1);
  const readingSeconds = read?.readingSeconds ?? 0;
  const readObservable = !!read && !read.unobservable && read.transcript.trim().length > 0;
  const m = readingMetrics(mission.text, readObservable ? read!.transcript : "", readingSeconds);
  const readAudio = read?.audio ?? null;
  const prosody =
    readObservable && readAudio && permissions.process
      ? prosodyScore({
          pcpm: m.pcpm,
          longPausesPerMin: readingSeconds > 0 ? readAudio.longPauses / (readingSeconds / 60) : null,
          f0RangeSemitones: readAudio.f0RangeSemitones,
        })
      : null;

  // --- Levels (rules; judge may override infiere / reflexiona) -------------
  const answers = ctx.answers;
  const levels: Record<QuestionKind, LevelResult> = {
    obtiene: toLevelResult(scoreObtiene(answers.obtiene ?? "", qO, { unobservable: unobservable(turns, "Q_OBTIENE") }), ctx.helps.obtiene),
    infiere: judged(
      toLevelResult(unobservable(turns, "Q_INFIERE") ? scoreObtiene("", qI, { unobservable: true }) : scoreInfiere(answers.infiere ?? "", qI, mission), ctx.helps.infiere),
      rec.judge?.infiere,
    ),
    reflexiona: judged(
      toLevelResult(scoreReflexiona(answers.revise ?? "", mission, { unobservable: unobservable(turns, "REVISE"), decision: ctx.decision ?? undefined }), ctx.helps.reflexiona),
      rec.judge?.reflexiona,
    ),
  };

  const chain = buildJudgmentChain({
    stance: unobservable(turns, "STANCE") ? "" : answers.stance ?? "",
    reason: unobservable(turns, "REVISE") ? "" : answers.revise ?? "",
    decision: unobservable(turns, "REVISE") ? null : ctx.decision,
    mission,
  });
  const reflexOk = levels.reflexiona.status === "ok" && numeric(levels.reflexiona.level) >= 2;
  chain.revision.withReason = reflexOk;

  // --- Process ("Cómo lo dijo") --------------------------------------------
  const answerTurns = turns.filter((t) => ANSWER_STATES.includes(t.state));
  const audioTurns = turns.filter((t) => t.audio);
  const audioAvailable = audioTurns.length > 0;
  const fill = answerTurns.map((t) => countFillers(t.transcript));
  const latencies = answerTurns
    .map((t) => (t.audio ? t.audio.latencyMs : t.simulatedLatencyMs ?? null))
    .filter((v): v is number => typeof v === "number");
  const stanceAudio = turnsOf(turns, "STANCE").at(-1)?.audio ?? null;
  const p = permissions.process;
  const provenance = [...new Map(turns.flatMap((turn) => {
    const item = cleanTranscriptionProvenance(turn.transcription);
    return item ? [[JSON.stringify(item), item] as const] : [];
  })).values()];
  const process: Report["process"] = {
    enabled: p,
    audioAvailable: p && audioAvailable,
    latencyMs: p && latencies.length ? Math.round(mean(latencies) as number) : null,
    longPauses: p && audioAvailable ? audioTurns.reduce((a, t) => a + (t.audio?.longPauses ?? 0), 0) : null,
    selfCorrections: p ? m.selfCorrections : 0,
    fillers: p ? fill.reduce((a, f) => a + f.count, 0) : 0,
    hedges: p ? Array.from(new Set(fill.flatMap((f) => f.hedges))) : [],
    finalIntonation: p ? stanceAudio?.finalIntonation ?? null : null,
    confidence: ctx.confidence,
    calibration: calibrate(ctx.confidence, [levels.obtiene.level, levels.infiere.level]),
  };

  // --- Context ------------------------------------------------------------
  const noisy = audioTurns.some(
    (t) => assessContext(t.audio!).noise === "alto",
  );

  const report: Report = {
    id,
    createdAt: now ?? new Date().toISOString(),
    durationSec: Math.max(0, Math.round((rec.endedAt - rec.startedAt) / 1000)),
    alias: rec.profile.alias,
    missionTitle: mission.title,
    missionId: mission.id,
    lang: mission.lang,
    simulated: rec.simulated,
    review: provisionalReview(),
    ...(provenance.length ? { transcription: provenance } : {}),
    headline: makeHeadline(rec.profile.alias, levels, ctx.decision, readObservable ? m.pcpm : null),
    fluency: {
      quote: read?.transcript ?? "",
      status: readObservable && m.pcpm !== null ? "ok" : "no_observable",
      pcpm: readObservable ? m.pcpm : null,
      accuracy: readObservable ? m.accuracy : null,
      correct: readObservable ? m.correct : 0,
      attempted: readObservable ? m.attempted : 0,
      selfCorrections: m.selfCorrections,
      repetitions: m.repetitions,
      substitutions: m.substitutions,
      omissions: m.omissions,
      insertions: m.insertions,
      prosody,
      differentWords: m.differentWords,
    },
    levels,
    chain,
    process,
    mood: {
      enabled: permissions.mood,
      start: permissions.mood ? ctx.moodStart : null,
      end: permissions.mood ? ctx.moodEnd : null,
      source: "autorreporte",
    },
    context: {
      noise: audioAvailable ? (noisy ? "alto" : "ok") : "no_disponible",
      saturated: audioTurns.some((t) => t.audio!.clippingRatio >= 0.01),
      possibleAdultHelp: false,
    },
    conversation: {
      repeatRequests: ctx.repeatRequests,
      answerRequests: ctx.answerRequests,
      ownQuestions: ctx.ownQuestions,
      bargeIns: rec.bargeIns,
      changedWithReason: ctx.decision === "cambio" && reflexOk,
      keptWithReason: ctx.decision === "mantengo" && reflexOk,
    },
    homeQuestion: { es: homeQuestion(mission, levels) },
    notMeasured: [...NOT_MEASURED],
  };
  return report;
}
