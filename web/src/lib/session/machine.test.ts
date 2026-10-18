import { describe, expect, it } from "vitest";
import { initialContext, start, transition, type MachineContext, type MachineEvent, type Effect } from "./machine";
import { SAMPLE_ES, SAMPLE_QU } from "../mission/samples";
import { verifyAgentUtterance } from "../signals/conversation";

const opts = { alias: "Yeni", moodEnabled: true };

function run(events: MachineEvent[], mission = SAMPLE_ES, o = opts) {
  let r = start(initialContext(o), mission);
  const all: Effect[] = [...r.effects];
  for (const e of events) {
    r = transition(r.ctx, e, mission);
    all.push(...r.effects);
  }
  return { ctx: r.ctx, effects: all, last: r.effects };
}

const says = (effects: Effect[]) => effects.filter((e) => e.type === "say").map((e) => (e.type === "say" ? e.utterance.speak : ""));

describe("session state machine (PRD §10)", () => {
  it("starts in CHECK_IN asking how the child arrives", () => {
    const { ctx, effects } = run([]);
    expect(ctx.state).toBe("CHECK_IN");
    expect(says(effects)[0]).toMatch(/¿Cómo llegas hoy\?/);
  });

  it("skips the mood picker when the family disabled it", () => {
    expect(run([], SAMPLE_ES, { alias: "Yeni", moodEnabled: false }).ctx.state).toBe("READ");
  });

  it("runs the full happy path in order", () => {
    const seen: string[] = [];
    let r = start(initialContext(opts), SAMPLE_ES);
    seen.push(r.ctx.state);
    const events: MachineEvent[] = [
      { type: "MOOD", mood: "bien" },
      { type: "READ_DONE" },
      { type: "ANSWER", text: "fue al río" },
      { type: "ANSWER", text: "porque el río estaba seco" },
      { type: "ANSWER", text: "sí, hizo bien porque necesitaban agua" },
      { type: "CONFIDENCE", value: "muy" },
      { type: "DECISION", value: "cambio" },
      { type: "ANSWER", text: "debió ir con su mamá porque es lejos" },
      { type: "MOOD", mood: "muy_bien" },
      { type: "REPORT_SAVED" },
    ];
    for (const e of events) {
      r = transition(r.ctx, e, SAMPLE_ES);
      if (seen[seen.length - 1] !== r.ctx.state) seen.push(r.ctx.state);
    }
    expect(seen).toEqual(["CHECK_IN", "READ", "Q_OBTIENE", "Q_INFIERE", "STANCE", "COUNTER", "REVISE", "CHECK_OUT", "REPORT", "DONE"]);
    expect(r.ctx.moodStart).toBe("bien");
    expect(r.ctx.moodEnd).toBe("muy_bien");
    expect(r.ctx.answers.revise).toMatch(/mamá/);
  });

  it("asks for confidence BEFORE showing the counter-evidence", () => {
    const { ctx, last } = run([{ type: "MOOD", mood: "bien" }, { type: "READ_DONE" }, { type: "ANSWER", text: "al río" }, { type: "ANSWER", text: "porque estaba seco" }, { type: "ANSWER", text: "sí hizo bien" }]);
    expect(ctx.state).toBe("STANCE");
    expect(ctx.awaitingConfidence).toBe(true);
    expect(says(last)[0]).toMatch(/segur/);
    // A decision before confidence is ignored.
    const ignored = transition(ctx, { type: "DECISION", value: "cambio" }, SAMPLE_ES);
    expect(ignored.ctx.state).toBe("STANCE");
    const counter = transition(ctx, { type: "CONFIDENCE", value: "poco" }, SAMPLE_ES);
    expect(counter.ctx.state).toBe("COUNTER");
    expect(says(counter.effects).join(" ")).toContain(SAMPLE_ES.counter.text);
  });

  it("silence repeats the question, then simplifies it (max 2 helps), then moves on", () => {
    const base = [{ type: "MOOD", mood: "bien" }, { type: "READ_DONE" }] as MachineEvent[];
    const a = run([...base, { type: "SILENCE" }]);
    expect(a.ctx.state).toBe("Q_OBTIENE");
    expect(a.ctx.helps.obtiene).toBe(1);
    expect(says(a.last)[0]).toContain(SAMPLE_ES.questions[0].text);
    const b = run([...base, { type: "SILENCE" }, { type: "SILENCE" }]);
    expect(b.ctx.helps.obtiene).toBe(2);
    expect(says(b.last)[0]).toContain(SAMPLE_ES.questions[0].simpler);
    const c = run([...base, { type: "SILENCE" }, { type: "SILENCE" }, { type: "SILENCE" }]);
    expect(c.ctx.state).toBe("Q_INFIERE");
    expect(c.ctx.helps.obtiene).toBe(2);
    expect(c.ctx.answers.obtiene).toBe("");
  });

  it("'otra vez' counts as a help", () => {
    const r = run([{ type: "MOOD", mood: "bien" }, { type: "READ_DONE" }, { type: "ANSWER", text: "¿otra vez?" }]);
    expect(r.ctx.state).toBe("Q_OBTIENE");
    expect(r.ctx.helps.obtiene).toBe(1);
    expect(r.ctx.repeatRequests).toBe(1);
  });

  it("never gives the answer when the child asks for it", () => {
    const r = run([{ type: "MOOD", mood: "bien" }, { type: "READ_DONE" }, { type: "ANSWER", text: "dime la respuesta" }]);
    expect(r.ctx.state).toBe("Q_OBTIENE");
    expect(r.ctx.helps.obtiene).toBe(0);
    expect(r.ctx.answerRequests).toBe(1);
    const spoken = says(r.last).join(" ");
    expect(verifyAgentUtterance(spoken, SAMPLE_ES.questions[0]).ok).toBe(true);
    expect(r.last.some((e) => e.type === "log" && e.name === "answer_requested_blocked")).toBe(true);
  });

  it("asks 'cuéntame un poquito más' once for a very short reason", () => {
    const pre: MachineEvent[] = [
      { type: "MOOD", mood: "bien" }, { type: "READ_DONE" }, { type: "ANSWER", text: "al río" }, { type: "ANSWER", text: "porque estaba seco" },
      { type: "ANSWER", text: "sí hizo bien" }, { type: "CONFIDENCE", value: "muy" }, { type: "DECISION", value: "mantengo" },
    ];
    const a = run([...pre, { type: "ANSWER", text: "porque sí" }]);
    expect(a.ctx.state).toBe("REVISE");
    expect(says(a.last)[0]).toMatch(/Cuéntame un poquito más/);
    const b = run([...pre, { type: "ANSWER", text: "porque sí" }, { type: "ANSWER", text: "ya" }]);
    expect(b.ctx.state).toBe("CHECK_OUT");
    expect(b.ctx.answers.revise).toBe("porque sí ya");
  });

  it("pause works from any state and resume returns to it", () => {
    const p = run([{ type: "MOOD", mood: "bien" }, { type: "PAUSE" }]);
    expect(p.ctx.state).toBe("PAUSED");
    expect(p.ctx.resumeState).toBe("READ");
    const back = transition(p.ctx, { type: "RESUME" }, SAMPLE_ES);
    expect(back.ctx.state).toBe("READ");
    expect(back.effects.some((e) => e.type === "say")).toBe(true);
  });

  it("CHECK_IN timeout continues without mood data", () => {
    const r = run([{ type: "TIMEOUT" }]);
    expect(r.ctx.state).toBe("READ");
    expect(r.ctx.moodStart).toBeNull();
  });

  it("ignores events that do not belong to the current state", () => {
    const { ctx } = run([]);
    const r = transition(ctx, { type: "ANSWER", text: "hola" }, SAMPLE_ES);
    expect(r.ctx).toEqual(ctx as MachineContext);
    expect(r.effects).toEqual([]);
  });

  it("logs state_entered for every state change", () => {
    const { effects } = run([{ type: "MOOD", mood: "bien" }]);
    const entered = effects.filter((e) => e.type === "log" && e.name === "state_entered");
    expect(entered.length).toBe(2);
  });

  it("Quechua: shows Quechua, speaks the Spanish translation", () => {
    const r = run([{ type: "MOOD", mood: "bien" }, { type: "READ_DONE" }], SAMPLE_QU);
    const say = r.last.find((e) => e.type === "say");
    expect(say && say.type === "say" && say.utterance.show).toBe(SAMPLE_QU.questions[0].text);
    expect(say && say.type === "say" && say.utterance.speak).toBe(SAMPLE_QU.questions[0].textEs);
  });
});
