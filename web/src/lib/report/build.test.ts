import { describe, expect, it } from "vitest";
import { buildReport, reviewReport, type SessionRecord } from "./build";
import { SAMPLE_ES } from "../mission/samples";
import { initialContext, start, transition, type MachineEvent } from "../session/machine";
import { assertReportIsClean, NOT_MEASURED } from "../guardrails";
import type { TurnAudioSummary, TurnRecord } from "../types";

function session(events: MachineEvent[], moodEnabled = true) {
  let r = start(initialContext({ alias: "Yeni", moodEnabled }), SAMPLE_ES);
  for (const e of events) r = transition(r.ctx, e, SAMPLE_ES);
  return r.ctx;
}

const happy = (decision: "cambio" | "mantengo", reason: string): MachineEvent[] => [
  { type: "MOOD", mood: "bien" },
  { type: "READ_DONE" },
  { type: "ANSWER", text: "fue al río" },
  { type: "ANSWER", text: "porque el río estaba seco" },
  { type: "ANSWER", text: "sí, hizo bien porque necesitaban agua" },
  { type: "CONFIDENCE", value: "muy" },
  { type: "DECISION", value: decision },
  { type: "ANSWER", text: reason },
  { type: "MOOD", mood: "muy_bien" },
];

const turn = (state: TurnRecord["state"], transcript: string, extra: Partial<TurnRecord> = {}): TurnRecord => ({
  state,
  transcript,
  simulated: true,
  audio: null,
  at: 0,
  ...extra,
});

function record(over: Partial<SessionRecord> = {}): SessionRecord {
  const ctx = session(happy("cambio", "debió ir con su mamá porque es lejos y estaba oscuro"));
  return {
    mission: SAMPLE_ES,
    profile: { alias: "Yeni", grade: 4, homeLang: "qu", readingLang: "es" },
    permissions: { voice: true, process: true, mood: true },
    ctx,
    turns: [
      turn("READ", SAMPLE_ES.text.split(" ").slice(0, 40).join(" "), { readingSeconds: 40 }),
      turn("Q_OBTIENE", "fue al río", { simulatedLatencyMs: 2000 }),
      turn("Q_INFIERE", "eh, creo que porque el río estaba seco", { simulatedLatencyMs: 4000 }),
      turn("STANCE", "sí, hizo bien porque necesitaban agua"),
      turn("REVISE", "debió ir con su mamá porque es lejos y estaba oscuro"),
    ],
    startedAt: 0,
    endedAt: 480_000,
    simulated: true,
    bargeIns: 0,
    ...over,
  };
}

describe("report builder (F5)", () => {
  const rep = buildReport(record(), { id: "r1", now: "2026-10-17T12:00:00.000Z" });

  it("is always clean (guardrails) and lists what we do not measure", () => {
    expect(() => assertReportIsClean(rep)).not.toThrow();
    expect(rep.notMeasured).toEqual(NOT_MEASURED);
  });
  it("keeps optional minimal transcription provenance, deduplicates sources and drops provider payloads", () => {
    const transcription = { provider: "deepgram", model: "nova-3", language: "es", timingsAvailable: true, normalization: "asr-may-normalize" } as const;
    const dirty = { ...transcription, accessCode: "secret-access", tokens: "secret-token", words: [{ word: "Rosa", start: 0, end: 1, confidence: 0.99 }], rawAudio: [1, 2] };
    const r = buildReport(record({ turns: record().turns.map((t) => ({ ...t, transcription: dirty })) }), { id: "provenance" });
    expect(r.transcription).toEqual([transcription]);
    const json = JSON.stringify(r);
    expect(json).not.toMatch(/secret-access|secret-token|rawAudio|"words"|0\.99/);
    expect(() => assertReportIsClean(r)).not.toThrow();
  });
  it("does not invent transcription provenance on legacy turns", () => {
    expect(rep.transcription).toBeUndefined();
  });
  it("headline ≤ 10 words, template-based", () => {
    expect(rep.headline).toBe("Yeni cambió de opinión con una buena razón");
    expect(rep.headline.split(/\s+/).length).toBeLessThanOrEqual(10);
  });
  it("fluency from the reading turn", () => {
    expect(rep.fluency.status).toBe("ok");
    expect(rep.fluency.pcpm).toBe(60);
    expect(rep.fluency.accuracy).toBe(1);
  });
  it("levels with quotes", () => {
    expect(rep.levels.obtiene.level).toBe(3);
    expect(rep.levels.infiere.level).toBe(3);
    expect(rep.levels.reflexiona.level).toBe(3);
    expect(rep.levels.reflexiona.quote).toMatch(/mamá/);
    expect(rep.chain.revision.changed).toBe(true);
  });
  it("process signals in simulation: text features yes, audio features unavailable", () => {
    expect(rep.process.audioAvailable).toBe(false);
    expect(rep.process.latencyMs).toBe(3000);
    expect(rep.process.longPauses).toBeNull();
    expect(rep.process.fillers).toBe(2);
    expect(rep.process.calibration).toBe("ajustada");
    expect(rep.context.noise).toBe("no_disponible");
  });
  it("mood is the child's self-report", () => {
    expect(rep.mood).toEqual({ enabled: true, start: "bien", end: "muy_bien", source: "autorreporte" });
  });
  it("has one concrete question for home", () => {
    expect(rep.homeQuestion.es).toMatch(/\?/);
  });

  it("keeping the idea with a good reason gets its own headline and equal credit", () => {
    const ctx = session(happy("mantengo", "porque su familia necesitaba agua y el río estaba seco"));
    const r = buildReport(record({ ctx, turns: record().turns.map((t) => (t.state === "REVISE" ? { ...t, transcript: ctx.answers.revise as string } : t)) }), { id: "r2" });
    expect(r.headline).toBe("Yeni defendió su idea con una buena razón");
    expect(r.conversation.keptWithReason).toBe(true);
    expect(r.levels.reflexiona.level).toBe(2);
  });

  it("not observable reading → no PCPM (never 0)", () => {
    const r = buildReport(record({ turns: [turn("READ", "", { readingSeconds: 60, unobservable: true }), ...record().turns.slice(1)] }), { id: "r3" });
    expect(r.fluency.status).toBe("no_observable");
    expect(r.fluency.pcpm).toBeNull();
  });

  it("respects the 'cómo lo dice' and 'cómo se siente' permissions", () => {
    const r = buildReport(record({ permissions: { voice: true, process: false, mood: false } }), { id: "r4" });
    expect(r.process.enabled).toBe(false);
    expect(r.process.latencyMs).toBeNull();
    expect(r.process.fillers).toBe(0);
    expect(r.mood.enabled).toBe(false);
    expect(r.mood.start).toBeNull();
  });

  it("uses judge results and marks disagreement as dudoso", () => {
    const r = buildReport(record({ judge: { infiere: { level: 2, status: "dudoso", quote: "porque el río estaba seco", runs: [2, 3, 2] } } }), { id: "r5" });
    expect(r.levels.infiere.status).toBe("dudoso");
    expect(r.levels.infiere.source).toBe("ia");
  });

  it("never persists live pace state, even if a turn carried it", () => {
    const dirty = { ...turn("Q_OBTIENE", "fue al río"), pace: "acelerado" } as unknown as TurnRecord;
    const r = buildReport(record({ turns: [record().turns[0], dirty, ...record().turns.slice(2)] }), { id: "r6" });
    expect(JSON.stringify(r)).not.toMatch(/"pace"/);
    expect(() => assertReportIsClean(r)).not.toThrow();
  });

  it("aggregates audio summaries when available", () => {
    const audio = (o: Partial<TurnAudioSummary>): TurnAudioSummary => ({
      latencyMs: 1000, longPauses: 1, finalIntonation: "baja", meanF0: 260, f0RangeSemitones: 5, noiseFloorDb: -50, snrDb: 25,
      clippingRatio: 0, speechDetected: true, possibleAdultHelp: false, speechMs: 2000, ...o,
    });
    const turns = record().turns.map((t, i) => ({ ...t, simulated: false, audio: audio(i === 2 ? { latencyMs: 3000, snrDb: 5, possibleAdultHelp: true } : {}) }));
    const r = buildReport(record({ turns, simulated: false }), { id: "r7" });
    expect(r.process.audioAvailable).toBe(true);
    expect(r.process.latencyMs).toBe(1500);
    expect(r.process.longPauses).toBe(5);
    expect(r.context.noise).toBe("alto");
    expect(r.context.possibleAdultHelp).toBe(false);
    expect(r.levels.infiere.level).toBe("NO");
    expect(r.fluency.prosody).not.toBeNull();
  });
  it("marks saturated reading and answers not observable even with a transcript", () => {
    const audio: TurnAudioSummary = {
      latencyMs: 1000, longPauses: 1, finalIntonation: "baja", meanF0: 260, f0RangeSemitones: 5, noiseFloorDb: -50, snrDb: 25,
      clippingRatio: 0.03, speechDetected: true, possibleAdultHelp: true, speechMs: 2000,
    };
    const r = buildReport(record({ turns: record().turns.map((t) => ({ ...t, audio, simulated: false })) }), { id: "clip" });
    expect(r.fluency.pcpm).toBeNull();
    expect(r.fluency.prosody).toBeNull();
    expect(r.fluency.status).toBe("no_observable");
    for (const level of Object.values(r.levels)) expect(level.level).toBe("NO");
    expect(r.chain.reason.present).toBe(false);
    expect(r.chain.stance.present).toBe(false);
    expect(r.context.saturated).toBe(true);
    expect(r.context.possibleAdultHelp).toBe(false);
  });
  it("requires explicit human review of every evidence item and preserves the reviewer role", () => {
    expect(rep.review?.status).toBe("provisional");
    let reviewed = reviewReport(rep, { target: "obtiene", decision: "confirmado", role: "docente" }, "2026-10-17T13:00:00.000Z");
    expect(reviewed.review?.status).toBe("provisional");
    expect(reviewed.review?.evidence.obtiene.reviewedBy).toBe("docente");
    for (const target of ["lectura", "infiere", "reflexiona"] as const) reviewed = reviewReport(reviewed, { target, decision: "confirmado", role: "familia" });
    expect(reviewed.review?.status).toBe("revisado");
    expect(rep.review?.status).toBe("provisional");
    expect(() => assertReportIsClean(reviewed)).not.toThrow();
  });
  it("human invalidation is NO, never zero, and removes success claims", () => {
    const r = reviewReport(rep, { target: "reflexiona", decision: "no_observable", role: "familia" });
    expect(r.levels.reflexiona.level).toBe("NO");
    expect(r.levels.reflexiona.status).toBe("no_observable");
    expect(r.chain.revision.withReason).toBe(false);
    expect(r.conversation.changedWithReason).toBe(false);
    expect(r.headline).not.toMatch(/buena razón/);
    const reading = reviewReport(r, { target: "lectura", decision: "no_observable", role: "docente" });
    expect(reading.fluency.pcpm).toBeNull();
    expect(reading.fluency.prosody).toBeNull();
  });
  it("older reports start provisional and adult help only comes from a manual declaration", () => {
    const old = { ...rep, review: undefined, context: { ...rep.context, possibleAdultHelp: true } };
    const r = reviewReport(old, { adultHelp: true, role: "docente" }, "2026-10-17T13:00:00.000Z");
    expect(r.review?.status).toBe("provisional");
    expect(r.review?.adultHelp).toEqual({ declared: true, reviewedBy: "docente", reviewedAt: "2026-10-17T13:00:00.000Z" });
  });
});
