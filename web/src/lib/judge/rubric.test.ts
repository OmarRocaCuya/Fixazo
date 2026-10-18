import { describe, expect, it } from "vitest";
import { aggregateRuns, buildJudgePrompt, judgeWithRules, parseJudgeRequest, sanitizeQuote } from "./rubric";
import { SAMPLE_ES } from "../mission/samples";

const req = {
  kind: "reflexiona" as const,
  question: SAMPLE_ES.questions[2].text,
  answer: "debió ir con su mamá porque es lejos y estaba oscuro",
  readingText: SAMPLE_ES.text,
  counterText: SAMPLE_ES.counter.text,
  decision: "cambio" as const,
};

describe("judge request parsing", () => {
  it("accepts a valid body", () => {
    expect(parseJudgeRequest(req)).toMatchObject({ kind: "reflexiona" });
  });
  it("rejects invalid bodies", () => {
    expect(parseJudgeRequest(null)).toBeNull();
    expect(parseJudgeRequest({ ...req, kind: "otra" })).toBeNull();
    expect(parseJudgeRequest({ ...req, answer: "x".repeat(5000) })).toBeNull();
  });
});

describe("rubric-anchored prompt", () => {
  it("includes every level, two examples per level and the child's answer", () => {
    const p = buildJudgePrompt(req);
    for (const l of ["0", "1", "2", "3", "NO"]) expect(p.system).toContain(`Nivel ${l}`);
    expect((p.system.match(/Ejemplo:/g) ?? []).length).toBeGreaterThanOrEqual(8);
    expect(p.user).toContain(req.answer);
    expect(p.system).toMatch(/igual que cambiar/);
  });
});

describe("3 runs → agreement or 'dudoso'", () => {
  it("all agree → ok", () => {
    expect(aggregateRuns([{ level: 2, quote: "a" }, { level: 2, quote: "a" }, { level: 2, quote: "a" }])).toMatchObject({ level: 2, status: "ok" });
  });
  it("disagreement → dudoso with the median level", () => {
    expect(aggregateRuns([{ level: 2, quote: "" }, { level: 3, quote: "" }, { level: 2, quote: "" }])).toMatchObject({ level: 2, status: "dudoso" });
    expect(aggregateRuns([{ level: 1, quote: "" }, { level: 3, quote: "" }, { level: 2, quote: "" }])).toMatchObject({ level: 2, status: "dudoso" });
  });
  it("NO observable is kept apart from 0", () => {
    expect(aggregateRuns([{ level: "NO", quote: "" }, { level: "NO", quote: "" }, { level: "NO", quote: "" }]).level).toBe("NO");
  });
});

describe("rules fallback and quote safety", () => {
  it("rules judge returns a rubric level", () => {
    const r = judgeWithRules(req);
    expect(r.source).toBe("reglas");
    expect(r.level).toBe(3);
  });
  it("quotes must come from the child's answer", () => {
    expect(sanitizeQuote("es lejos", req.answer)).toBe("es lejos");
    expect(sanitizeQuote("inventado por el modelo", req.answer)).toBe(req.answer);
  });
});
