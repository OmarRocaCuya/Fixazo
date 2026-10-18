import { describe, expect, it } from "vitest";
import { timeline, type Segment } from "./fixtures";
import {
  AFFECT_LABELS,
  MODEL_LABELS_ES,
  NO_AUDIO_MESSAGE,
  SOURCE_LABEL,
  analyzeTurnAffect,
  estimateLocalAffect,
  localActivation,
  mapModelResult,
  moodAgreement,
  summarizeAffect,
  voiceAffectEstimator,
  voiceBaseline,
  voiceFeatures,
  type EmotionModelResult,
} from "./affect";

// One syllable every `period` ms; pitch may wobble by ±`wobble` Hz; `gap` adds pauses.
function speech(ms: number, { f0 = 250, period = 200, rms = 0.08, wobble = 10, gap = 0 } = {}) {
  const segs: Segment[] = [];
  let k = 0;
  for (let t = 0; t < ms; t += period + gap) {
    const pitch = f0 + (k++ % 2 === 0 ? wobble : -wobble);
    segs.push({ ms: period * 0.6, voiced: true, f0: pitch, rms }, { ms: period * 0.4 + gap, voiced: false });
  }
  return timeline(segs);
}

const base = voiceBaseline(speech(30000))!;

function model(top: string, score: number): EmotionModelResult {
  const rest = ["angry", "disgusted", "fearful", "happy", "neutral", "other", "sad", "surprised", "unknown"].filter((l) => l !== top);
  const each = (1 - score) / rest.length;
  return { labels: [{ label: top, score }, ...rest.map((label) => ({ label, score: each }))], top: { label: top, score }, model: "emotion2vec/emotion2vec_plus_base" };
}

describe("voice features and the child's own baseline", () => {
  it("baseline needs at least 5 s of speech", () => {
    expect(voiceBaseline(speech(2000))).toBeNull();
    expect(base.meanF0).toBeCloseTo(250, 0);
    expect(base.f0VariabilitySt).toBeGreaterThan(0);
  });
  it("pause ratio grows with longer gaps", () => {
    expect(voiceFeatures(speech(6000, { gap: 600 }))!.pauseRatio).toBeGreaterThan(voiceFeatures(speech(6000))!.pauseRatio);
  });
  it("features are null without speech", () => {
    expect(voiceFeatures(timeline([{ ms: 3000, voiced: false }]))).toBeNull();
  });
});

describe("local audio-only fallback (relative to the baseline)", () => {
  it("similar voice → tranquilo/a", () => {
    const e = estimateLocalAffect(base, voiceFeatures(speech(5000)));
    expect(e.label).toBe("tranquilo/a");
    expect(Math.abs(e.activation as number)).toBeLessThan(0.25);
  });
  it("faster, higher, louder, more varied → activado/a", () => {
    expect(estimateLocalAffect(base, voiceFeatures(speech(5000, { f0: 300, period: 120, rms: 0.13, wobble: 30 }))).label).toBe("activado/a");
  });
  it("slower, quieter, flatter, more pauses → apagado/a", () => {
    expect(estimateLocalAffect(base, voiceFeatures(speech(6000, { f0: 235, period: 380, rms: 0.045, wobble: 2, gap: 500 }))).label).toBe("apagado/a");
  });
  it("without baseline or speech → sin datos suficientes", () => {
    const e = estimateLocalAffect(null, voiceFeatures(speech(5000)));
    expect(e.label).toBe("sin datos suficientes");
    expect(e.note).toMatch(/línea base/);
    expect(localActivation(base, null)).toBeNull();
  });
  it("is always low confidence, local voice source, experimental", () => {
    for (const turn of [speech(5000), speech(5000, { f0: 320, period: 100, rms: 0.2 })]) {
      const e = estimateLocalAffect(base, voiceFeatures(turn));
      expect(e).toMatchObject({ confidence: "baja", source: "voz-local", experimental: true, score: null });
    }
    expect(SOURCE_LABEL["voz-local"]).toContain("no emoción");
  });
});

describe("emotion2vec+ result mapping (Spanish, never 'alta')", () => {
  it.each([
    ["angry", "enojado/a"], ["disgusted", "disgustado/a"], ["fearful", "con miedo"], ["happy", "contento/a"],
    ["neutral", "neutral"], ["sad", "triste"], ["surprised", "sorprendido/a"], ["other", "sin datos suficientes"], ["unknown", "sin datos suficientes"],
  ])("%s → %s", (en, es) => {
    expect(mapModelResult(model(en, 0.7)).label).toBe(es);
  });
  it("confidence media only when top score ≥ 0.6", () => {
    expect(mapModelResult(model("happy", 0.6)).confidence).toBe("media");
    expect(mapModelResult(model("happy", 0.59)).confidence).toBe("baja");
    expect(mapModelResult(model("sad", 0.99))).toMatchObject({ confidence: "media", source: "voz-emotion2vec", score: 0.99, experimental: true });
    expect(SOURCE_LABEL["voz-emotion2vec"]).toBe("voz (emotion2vec+)");
  });
  it("unknown labels never become an emotion", () => {
    expect(mapModelResult({ ...model("happy", 0.9), top: { label: "joy", score: 0.9 } }).label).toBe("sin datos suficientes");
  });
  it("every mapped label belongs to the closed label set", () => {
    for (const es of Object.values(MODEL_LABELS_ES)) expect(AFFECT_LABELS).toContain(es);
  });
});

describe("the estimator uses AUDIO only, never the transcript", () => {
  const frames = speech(5000, { f0: 300, period: 120, rms: 0.13, wobble: 30 });
  it("changing the transcript never changes the label (local and model paths)", () => {
    for (const remote of [null, model("sad", 0.8)]) {
      const results = ["estoy muy feliz", "estoy triste y tengo miedo", "", "no me gusta nada"].map((transcript) =>
        analyzeTurnAffect({ state: "Q_INFIERE", transcript }, { frames, baseline: base, remote }),
      );
      for (const r of results) expect(r).toEqual(results[0]);
    }
  });
  it("uses only the emotion2vec+ result; no heuristic emotion when unavailable", () => {
    expect(voiceAffectEstimator.estimate({ frames, baseline: base, remote: model("sad", 0.8) }).source).toBe("voz-emotion2vec");
    expect(voiceAffectEstimator.estimate({ frames, baseline: base, remote: null })).toMatchObject({ source: "sin-modelo", label: "sin datos suficientes", score: null, activation: null });
  });
  it("explains the missing microphone in simulation", () => {
    expect(NO_AUDIO_MESSAGE).toBe("sin audio: la estimación necesita el micrófono");
  });
});

describe("agreement with the child's carita and session summary", () => {
  it("compares only labels with a clear valence", () => {
    expect(moodAgreement("bien", "contento/a")).toBe("coincide");
    expect(moodAgreement("muy_bien", "triste")).toBe("no coincide");
    expect(moodAgreement("mal", "enojado/a")).toBe("coincide");
    expect(moodAgreement("regular", "neutral")).toBe("coincide");
    expect(moodAgreement("bien", "activado/a")).toBe("sin comparación");
    expect(moodAgreement("bien", "sorprendido/a")).toBe("sin comparación");
    expect(moodAgreement(null, "contento/a")).toBe("sin comparación");
  });
  it("summarizes timeline, most frequent label and start/end agreement", () => {
    const s = summarizeAffect(
      [
        { state: "Q_OBTIENE", estimate: mapModelResult(model("happy", 0.7)) },
        { state: "Q_INFIERE", estimate: mapModelResult(model("happy", 0.65)) },
        { state: "REVISE", estimate: mapModelResult(model("fearful", 0.5)) },
      ],
      "bien",
      "bien",
    );
    expect(s.turns.map((t) => t.label)).toEqual(["contento/a", "contento/a", "con miedo"]);
    expect(s.overall).toBe("contento/a");
    expect(s.agreement).toEqual({ start: "coincide", end: "no coincide" });
    expect(s.turns.every((t) => t.experimental)).toBe(true);
  });
});
