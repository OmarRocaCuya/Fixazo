import { describe, expect, it } from "vitest";
import { FORBIDDEN_FIELDS, NOT_MEASURED, assertReportIsClean, findViolations, isForbiddenKey } from "./guardrails";

const cleanish = {
  id: "r1",
  mood: { enabled: true, start: "bien", end: "muy_bien", source: "autorreporte" },
  levels: { reflexiona: { quote: "estaba triste" } },
};

describe("guardrails", () => {
  it("covers the four forbidden families", () => {
    const all = FORBIDDEN_FIELDS.join(" ");
    expect(all).toMatch(/emotion/);
    expect(all).toMatch(/voiceprint/);
    expect(all).toMatch(/accent/);
    expect(all).toMatch(/hoarseness/);
    expect(all).toMatch(/breathing/);
    expect(NOT_MEASURED).toHaveLength(4);
  });

  it("accepts a clean report (free text may mention feelings)", () => {
    expect(() => assertReportIsClean(cleanish)).not.toThrow();
  });

  it.each([
    ["emotion", { emotion: "ansioso" }],
    ["detectedEmotion nested", { a: { b: { detectedEmotion: "triste" } } }],
    ["speaker embedding", { speakerEmbedding: [0.1, 0.2] }],
    ["voiceprint", { voice_print: "abc" }],
    ["accent judgment", { accentScore: 2 }],
    ["way of speaking", { speakingStyle: "raro" }],
    ["hoarseness", { hoarseness: true }],
    ["breathing", { breathingRate: 12 }],
    ["live pace state", { pace: "acelerado" }],
  ])("rejects %s", (_name, extra) => {
    expect(() => assertReportIsClean({ ...cleanish, ...extra })).toThrow(/guardrail/i);
  });

  it("rejects emotion labels used as values outside free text", () => {
    expect(findViolations({ ...cleanish, state: "ansioso" })).not.toHaveLength(0);
  });

  it("rejects raw audio of any kind", () => {
    expect(() => assertReportIsClean({ ...cleanish, samples: new Float32Array(4) })).toThrow();
    expect(() => assertReportIsClean({ ...cleanish, x: { y: new ArrayBuffer(8) } })).toThrow();
  });

  it("mood must be self-reported", () => {
    expect(() => assertReportIsClean({ ...cleanish, mood: { start: "bien", source: "modelo" } })).toThrow();
    expect(() => assertReportIsClean({ ...cleanish, mood: { start: "feliz", source: "autorreporte" } })).toThrow();
  });

  it("key matching ignores case and separators", () => {
    expect(isForbiddenKey("Voice_Print")).toBe(true);
    expect(isForbiddenKey("emocionDetectada")).toBe(true);
    expect(isForbiddenKey("accuracy")).toBe(false);
    expect(isForbiddenKey("prosody")).toBe(false);
  });
});
