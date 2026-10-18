import { describe, expect, it } from "vitest";
import { alignWords, liveReadingProgress, readingMetrics, readingProgress, tokenizeDisplay } from "./reading";

const EXPECTED = "Rosa se levantó temprano. El río estaba seco.";

describe("word alignment", () => {
  it("perfect reading", () => {
    const m = readingMetrics(EXPECTED, "rosa se levanto temprano el rio estaba seco", 8);
    expect(m.correct).toBe(8);
    expect(m.accuracy).toBe(1);
    expect(m.pcpm).toBe(60);
    expect(m.substitutions + m.omissions + m.insertions).toBe(0);
  });
  it("detects a substitution", () => {
    const ops = alignWords(["el", "rio", "estaba", "seco"], ["el", "lio", "estaba", "seco"]);
    expect(ops.map((o) => o.type)).toEqual(["correct", "substitution", "correct", "correct"]);
  });
  it("detects an omission and an insertion", () => {
    expect(alignWords(["el", "rio", "estaba", "seco"], ["el", "rio", "seco"]).filter((o) => o.type === "omission")).toHaveLength(1);
    const m = readingMetrics("el río estaba seco", "el río muy estaba seco", 4);
    expect(m.insertions).toBe(1);
    expect(m.accuracy).toBe(1);
  });
  it("tolerates small ASR differences on long words", () => {
    const ops = alignWords(["hatarispa"], ["hatarisp"]);
    expect(ops[0].type).toBe("correct");
  });
  it("words not reached in time are not errors", () => {
    const m = readingMetrics(EXPECTED, "rosa se levantó", 3);
    expect(m.attempted).toBe(3);
    expect(m.accuracy).toBe(1);
    expect(m.omissions).toBe(0);
    expect(m.reachedIndex).toBe(3);
    expect(m.ops.every((op) => op.expIndex === undefined || op.expIndex < 3)).toBe(true);
  });
  it("does not assign unread repeated phrases to later occurrences in the report", () => {
    const m = readingMetrics("La niña lee y la niña canta.", "la niña", 60);
    expect(m).toMatchObject({ reachedIndex: 2, correct: 2, attempted: 2, omissions: 0, accuracy: 1 });
    expect(m.differentIndices).toEqual([]);
  });
  it("does not turn unrelated speech into fluency errors", () => {
    const m = readingMetrics(EXPECTED, "Hola soy Diego", 60);
    expect(m).toMatchObject({ reachedIndex: 0, attempted: 0, accuracy: null, pcpm: null, omissions: 0 });
  });
  it("still detects anchored internal omissions in a partial reading", () => {
    const m = readingMetrics("Rosa se levantó temprano. El río estaba seco y volvió a casa.", "rosa levantó temprano el río estaba seco", 20);
    expect(m).toMatchObject({ reachedIndex: 8, omissions: 1, correct: 7, attempted: 8 });
    expect(m.differentIndices).toEqual([1]);
  });
  it("counts self-corrections and does not penalize them", () => {
    const m = readingMetrics("Rosa pukyuman rirqa", "rosa puk pukyuman rirqa", 3);
    expect(m.selfCorrections).toBe(1);
    expect(m.insertions).toBe(0);
    expect(m.accuracy).toBe(1);
  });
  it("counts repetitions", () => {
    const m = readingMetrics("el río estaba seco", "el el río estaba seco", 4);
    expect(m.repetitions).toBe(1);
    expect(m.insertions).toBe(0);
  });
  it("PCPM is null without reading time and reports different words for adults", () => {
    const m = readingMetrics("el río estaba seco", "el lio estaba seco", 0);
    expect(m.pcpm).toBeNull();
    expect(m.differentWords).toEqual(["río"]);
  });
  it("counts an anchored terminal mismatch instead of reporting perfect accuracy", () => {
    const m = readingMetrics("el río estaba seco", "el río estaba mojado", 30);
    expect(m).toMatchObject({ correct: 3, attempted: 4, substitutions: 1, omissions: 0, accuracy: 0.75 });
    expect(m.differentWords).toEqual(["seco"]);
    const longer = readingMetrics(EXPECTED, "rosa se levantó temprano el río estaba mojado", 30);
    expect(longer).toMatchObject({ correct: 7, attempted: 8, substitutions: 1, accuracy: 0.875 });
  });
  it("does not substitute future words for terminal fillers or repetitions", () => {
    for (const tail of ["eh", "eeeh", "mmm", "no sé", "levantó"]) {
      const m = readingMetrics(EXPECTED, `rosa se levantó ${tail}`, 30);
      expect(m).toMatchObject({ reachedIndex: 3, correct: 3, attempted: 3, substitutions: 0, omissions: 0, accuracy: 1 });
    }
    const repeated = readingMetrics(EXPECTED, "rosa se levantó levantó", 30);
    expect(repeated.repetitions).toBe(1);
  });
  it("can count an anchored terminal mismatch alongside a genuine trailing filler", () => {
    const m = readingMetrics("el río estaba seco", "el río estaba mojado eh", 30);
    expect(m).toMatchObject({ correct: 3, attempted: 4, substitutions: 1, omissions: 0, accuracy: 0.75 });
    const repeatedMismatch = readingMetrics("el río estaba seco", "el río estaba mojado mojado", 30);
    expect(repeatedMismatch).toMatchObject({ correct: 3, attempted: 4, substitutions: 1, repetitions: 1, accuracy: 0.75 });
  });
  it("does not extend unanchored noise or infer the rest of a partial passage", () => {
    expect(readingMetrics(EXPECTED, "Hola soy Diego", 30).attempted).toBe(0);
    expect(readingMetrics(EXPECTED, "seco", 30).attempted).toBe(0);
    const m = readingMetrics(EXPECTED, "rosa se gato", 30);
    expect(m).toMatchObject({ reachedIndex: 3, attempted: 3, substitutions: 1, omissions: 0 });
    expect(m.ops.every((op) => op.expIndex === undefined || op.expIndex < 3)).toBe(true);
  });
});

describe("live progress", () => {
  it("returns the index of the next word to read", () => {
    expect(readingProgress(EXPECTED, "")).toBe(0);
    expect(readingProgress(EXPECTED, "rosa se levanto")).toBe(3);
    expect(readingProgress(EXPECTED, "rosa se levanto temprano el rio estaba seco")).toBe(8);
  });
  it("keeps display words with punctuation", () => {
    const t = tokenizeDisplay("Hola, Rosa.");
    expect(t.map((w) => w.display)).toEqual(["Hola,", "Rosa."]);
    expect(t[1].norm).toBe("rosa");
    expect(t[1].endsSentence).toBe(true);
  });
  it("does not skip to an isolated final word or advance on unrelated speech", () => {
    const text = "Rosa fue al río para buscar agua y regresó a casa.";
    expect(liveReadingProgress(text, "casa")).toMatchObject({ reachedIndex: 0, matchedWords: 0, complete: false });
    expect(liveReadingProgress(text, "Hola soy Diego")).toMatchObject({ reachedIndex: 0, matchedWords: 0, complete: false });
  });
  it("chooses the first matching occurrence and tolerates a repetition", () => {
    const text = "La niña lee y la niña canta.";
    expect(readingProgress(text, "la niña")).toBe(2);
    expect(readingProgress(text, "la la niña lee")).toBe(3);
    expect(liveReadingProgress(text, text).complete).toBe(true);
  });
  it("recomputes from rewritten cumulative hypotheses instead of locking the furthest index", () => {
    expect(readingProgress(EXPECTED, "rosa se levantó temprano el río")).toBe(6);
    expect(readingProgress(EXPECTED, "rosa se levantó")).toBe(3);
    expect(readingProgress(EXPECTED, "")).toBe(0);
  });
  it("requires substantial matched coverage and a matched final word to complete", () => {
    expect(liveReadingProgress("Uno dos tres cuatro cinco.", "uno gato perro cuatro cinco").complete).toBe(false);
    expect(liveReadingProgress("Uno dos tres cuatro cinco.", "uno dos tres cuatro perro").complete).toBe(false);
    expect(liveReadingProgress("Uno dos tres cuatro cinco.", "uno dos tres perro cinco").complete).toBe(true);
    expect(liveReadingProgress("", "").complete).toBe(false);
  });
  it("keeps a mismatched terminal word out of the live cursor even when final metrics count it", () => {
    const expected = "el río estaba seco";
    const transcript = "el río estaba mojado";
    expect(readingMetrics(expected, transcript, 30).reachedIndex).toBe(4);
    expect(liveReadingProgress(expected, transcript)).toMatchObject({ reachedIndex: 3, matchedWords: 3, complete: false });
  });
});
