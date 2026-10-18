// Experimental emotion estimate (from the VOICE only): inclusion flag,
// isolation from scoring, child-facing isolation and data minimization.
import { describe, expect, it } from "vitest";
import { buildReport, type SessionRecord } from "./report/build";
import { SAMPLE_ES } from "./mission/samples";
import { initialContext, start, transition, type MachineEvent } from "./session/machine";
import { assertReportIsClean, findViolations, NOT_MEASURED } from "./guardrails";
import { mapModelResult, type EmotionModelResult } from "./signals/affect";
import { createStore, memoryStorage } from "./storage";
import { toChildView } from "./session/childView";
import type { Report, TurnRecord } from "./types";

const events: MachineEvent[] = [
  { type: "MOOD", mood: "bien" },
  { type: "READ_DONE" },
  { type: "ANSWER", text: "fue al río" },
  { type: "ANSWER", text: "porque el río estaba seco" },
  { type: "ANSWER", text: "sí, hizo bien porque necesitaban agua" },
  { type: "CONFIDENCE", value: "muy" },
  { type: "DECISION", value: "cambio" },
  { type: "ANSWER", text: "debió ir con su mamá porque es lejos y estaba oscuro" },
  { type: "MOOD", mood: "muy_bien" },
];

function ctx() {
  let r = start(initialContext({ alias: "Yeni", moodEnabled: true }), SAMPLE_ES);
  for (const e of events) r = transition(r.ctx, e, SAMPLE_ES);
  return r.ctx;
}

function model(top: string, score: number): EmotionModelResult {
  const rest = ["angry", "disgusted", "fearful", "happy", "neutral", "other", "sad", "surprised", "unknown"].filter((l) => l !== top);
  return { labels: [{ label: top, score }, ...rest.map((label) => ({ label, score: (1 - score) / 8 }))], top: { label: top, score }, model: "emotion2vec/emotion2vec_plus_base" };
}

const t = (state: TurnRecord["state"], transcript: string, extra: Partial<TurnRecord> = {}): TurnRecord => ({
  state, transcript, simulated: false, audio: null, at: 0, ...extra,
});

function record(withAffect: boolean, experimentalEmotion: boolean): SessionRecord {
  const a = (top: string, score: number) => (withAffect ? { affect: mapModelResult(model(top, score)) } : {});
  return {
    mission: SAMPLE_ES,
    profile: { alias: "Yeni", grade: 4, homeLang: "qu", readingLang: "es" },
    permissions: { voice: true, process: true, mood: true },
    experimentalEmotion,
    ctx: ctx(),
    turns: [
      t("READ", SAMPLE_ES.text, { readingSeconds: 50 }),
      t("Q_OBTIENE", "fue al río", a("happy", 0.7)),
      t("Q_INFIERE", "porque el río estaba seco", a("happy", 0.65)),
      t("STANCE", "sí, hizo bien porque necesitaban agua", a("neutral", 0.5)),
      t("REVISE", "debió ir con su mamá porque es lejos y estaba oscuro", a("sad", 0.8)),
    ],
    startedAt: 0,
    endedAt: 400_000,
    simulated: false,
    bargeIns: 0,
  };
}

const on = buildReport(record(true, true), { id: "r-on", now: "2026-10-18T10:00:00.000Z" });
const off = buildReport(record(false, false), { id: "r-off", now: "2026-10-18T10:00:00.000Z" });

describe("experimental affect in the report", () => {
  it("is present only when included, marked experimental, with agreement vs. the carita", () => {
    expect(on.experimentalAffect?.experimental).toBe(true);
    expect(on.experimentalAffect?.turns).toHaveLength(4);
    expect(on.experimentalAffect?.overall).toBe("contento/a");
    expect(on.experimentalAffect?.agreement).toEqual({ start: "coincide", end: "no coincide" });
    expect(off.experimentalAffect).toBeUndefined();
    expect(buildReport(record(true, false), { id: "x" }).experimentalAffect).toBeUndefined();
  });

  it("(b) never changes scoring: levels, headline, chain, process and fluency are identical", () => {
    expect(on.levels).toEqual(off.levels);
    expect(on.headline).toBe(off.headline);
    expect(on.chain).toEqual(off.chain);
    expect(on.process).toEqual(off.process);
    expect(on.fluency).toEqual(off.fluency);
  });

  it("'Lo que no medimos' keeps the four guardrails with the updated first item", () => {
    expect(NOT_MEASURED).toHaveLength(4);
    expect(NOT_MEASURED[0]).toBe("Emociones con etiqueta para calificar: la estimación experimental nunca entra en la nota.");
    expect(NOT_MEASURED.join(" ")).toMatch(/huellas de voz/);
    expect(NOT_MEASURED.join(" ")).toMatch(/[Aa]cento/);
    expect(NOT_MEASURED.join(" ")).toMatch(/salud/);
  });
});

describe("guardrails for experimentalAffect", () => {
  it("(a) a well-formed experimental block is accepted without any consent record", () => {
    expect(() => assertReportIsClean(on)).not.toThrow();
    expect(() => assertReportIsClean(off)).not.toThrow();
  });

  it("every entry must be marked experimental", () => {
    const bad = structuredClone(on);
    (bad.experimentalAffect!.turns[0] as { experimental: boolean }).experimental = false;
    expect(() => assertReportIsClean(bad)).toThrow(/experimental/);
  });

  it("(d) no raw audio, F0 arrays or embeddings: only label / source / confidence / two bounded numbers", () => {
    for (const extra of [{ f0: [220, 230] }, { samples: [0.1, 0.2] }, { embedding: [1, 2, 3] }, { scores: [0.1, 0.2] }]) {
      const dirty = structuredClone(on) as unknown as { experimentalAffect: { turns: Array<Record<string, unknown>> } };
      Object.assign(dirty.experimentalAffect.turns[0], extra);
      expect(() => assertReportIsClean(dirty)).toThrow();
    }
    const outOfRange = structuredClone(on);
    outOfRange.experimentalAffect!.turns[0].score = 7;
    expect(() => assertReportIsClean(outOfRange)).toThrow();
    const badSource = structuredClone(on) as unknown as { experimentalAffect: { turns: Array<Record<string, unknown>> } };
    badSource.experimentalAffect.turns[0].source = "texto";
    expect(() => assertReportIsClean(badSource)).toThrow();
    const keys = new Set(on.experimentalAffect!.turns.flatMap((e) => Object.keys(e)));
    expect([...keys].sort()).toEqual(["activation", "confidence", "experimental", "label", "score", "source", "state"]);
  });

  it("emotion words stay forbidden everywhere outside the experimental block", () => {
    expect(findViolations({ ...off, process: { ...off.process, state: "triste" } })).not.toHaveLength(0);
    expect(() => assertReportIsClean({ ...off, mood: { ...off.mood, start: "triste" } })).toThrow();
  });

  it("other guardrails still hold next to the experimental block (no voiceprint, accent, health, emotion keys)", () => {
    for (const extra of [{ voiceprint: [1] }, { accentScore: 2 }, { hoarseness: true }, { emotion: "ansioso" }]) {
      expect(() => assertReportIsClean({ ...on, ...extra })).toThrow();
    }
  });
});

describe("storage", () => {
  const store = () => createStore(memoryStorage());
  it("saves a well-formed affect report without consent, but never a malformed one", () => {
    const s = store();
    s.saveReport(on);
    expect(s.getReport("r-on")?.experimentalAffect?.experimental).toBe(true);
    const bad = structuredClone(on);
    (bad.experimentalAffect!.turns[0] as { experimental: boolean }).experimental = false;
    expect(() => store().saveReport(bad)).toThrow(/experimental/);
  });
  it("deleting estimates removes stored experimentalAffect from saved reports", () => {
    const s = store();
    s.saveReport(on);
    s.saveReport(off);
    expect(s.stripExperimentalAffect()).toBe(1);
    expect(s.listReports().some((r: Report) => "experimentalAffect" in r)).toBe(false);
    expect(s.getReport("r-on")?.levels).toEqual(on.levels);
  });
});

describe("(c) child-facing view model", () => {
  it("never carries the affect estimate", () => {
    const snap = {
      phase: "running" as const,
      ctx: { state: "Q_INFIERE" as const, resumeState: null, awaitingConfidence: false },
      utterance: { speak: "¿Por qué?", show: "¿Por qué?", kind: "prompt" as const },
      lines: [{ who: "agente" as const, show: "¿Por qué?" }, { who: "nino" as const, show: "porque sí" }],
      readProgress: 0,
      caption: "",
      listening: true,
      simulation: false,
      experimentalEmotion: true,
      affect: [{ state: "Q_INFIERE" as const, estimate: mapModelResult(model("sad", 0.8)) }],
    };
    const view = toChildView(snap);
    const json = JSON.stringify(view);
    expect(json).not.toMatch(/triste|contento|enojad|activation|score|affect|experimental|emotion2vec/);
    expect(Object.keys(view).sort()).toEqual(["awaitingConfidence", "caption", "lines", "listening", "phase", "readProgress", "simulation", "state", "utterance"]);
  });
});
