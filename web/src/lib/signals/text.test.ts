import { describe, expect, it } from "vitest";
import {
  normalizeWord,
  tokenize,
  contentWords,
  findConnectors,
  hasCausalConnector,
  epistemicStance,
  evidenceOverlap,
  answerLength,
  codeSwitching,
  isQuechuaWord,
} from "./text";

describe("normalization", () => {
  it("lowercases, strips accents and punctuation but keeps ñ", () => {
    expect(normalizeWord("¿Río?")).toBe("rio");
    expect(normalizeWord("Ñawinchay,")).toBe("ñawinchay");
    expect(tokenize("Rosa fue al río. ¡Sí!")).toEqual(["rosa", "fue", "al", "rio", "si"]);
  });
  it("content words drop Spanish stopwords", () => {
    expect(contentWords("el río estaba seco y ella fue al puquio")).toEqual(["rio", "seco", "puquio"]);
  });
});

describe("reasoning connectors", () => {
  it("finds Spanish causal connectors", () => {
    expect(findConnectors("Fue al puquio porque el río estaba seco")).toContain("porque");
    expect(findConnectors("Por eso caminó lejos")).toContain("por eso");
    expect(findConnectors("Si llueve, entonces no va")).toContain("si…entonces");
    expect(hasCausalConnector("ya que no había agua")).toBe(true);
  });
  it("contrastive connectors are found but are not causal", () => {
    expect(findConnectors("Fue, pero estaba cansada")).toContain("pero");
    expect(hasCausalConnector("Fue, pero estaba cansada")).toBe(false);
  });
  it("finds Quechua connectors and -pti/-ptin clauses", () => {
    expect(findConnectors("Mayuqa chakisqam karqa. Chaymi pukyuman rirqa.")).toContain("chaymi");
    expect(findConnectors("Mayu chakiptinmi rirqa")).toContain("-ptin");
    expect(hasCausalConnector("chayrayku rirqa")).toBe(true);
    expect(findConnectors("ichaqa manam")).toContain("ichaqa");
  });
});

describe("Quechua evidentials (TODO validate with speaker)", () => {
  it("counts direct -mi/-m", () => {
    expect(epistemicStance("Mayuqa chakisqam karqa").direct).toBe(1);
  });
  it("counts reported -si/-s and conjecture -chá", () => {
    const s = epistemicStance("Paysi rirqa. Paraychá");
    expect(s.reported).toBe(1);
    expect(s.conjecture).toBe(1);
  });
  it("does not count Spanish words", () => {
    expect(epistemicStance("Rosa fue a traer las cosas mismas")).toEqual({ direct: 0, reported: 0, conjecture: 0 });
  });
  it("classifies Quechua words", () => {
    expect(isQuechuaWord("pukyuman")).toBe(true);
    expect(isQuechuaWord("rirqa")).toBe(true);
    expect(isQuechuaWord("porque")).toBe(false);
  });
});

describe("evidence, length, code-switching", () => {
  const reading = "Rosa fue al río a traer agua. Pero el río estaba seco. Por eso caminó hasta el puquio.";
  it("finds content-word overlap with the source", () => {
    expect(evidenceOverlap("porque el río estaba secos", reading)).toEqual(["rio", "seco"]);
    expect(evidenceOverlap("porque sí", reading)).toEqual([]);
  });
  it("counts answer length in words", () => {
    expect(answerLength("  porque el río  estaba seco ")).toBe(5);
    expect(answerLength("")).toBe(0);
  });
  it("measures code-switching", () => {
    const mixed = codeSwitching("Rosaqa fue al río porque mayuqa chakisqam karqa");
    expect(mixed.quechua).toBeGreaterThan(0);
    expect(mixed.spanish).toBeGreaterThan(0);
    expect(mixed.ratio).toBeGreaterThan(0);
    expect(codeSwitching("Rosa fue al río").ratio).toBe(0);
  });
});
