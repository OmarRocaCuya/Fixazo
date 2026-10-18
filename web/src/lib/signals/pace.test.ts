import { describe, expect, it } from "vitest";
import { timeline, type Segment } from "./fixtures";
import { computeBaseline, paceFeatures, classifyPace, PACE_LABELS, PAUSE_OFFER, shouldOfferBreak } from "./pace";
import { EMOTION_LABELS } from "../guardrails";

// Rhythm: one syllable every `period` ms.
function speech(ms: number, f0: number, period = 200) {
  const segs: Segment[] = [];
  for (let t = 0; t < ms; t += period) segs.push({ ms: period * 0.6, voiced: true, f0 }, { ms: period * 0.4, voiced: false });
  return timeline(segs);
}

describe("baseline (first 30 s of speech)", () => {
  it("is null with too little speech", () => {
    expect(computeBaseline(speech(2000, 250))).toBeNull();
  });
  it("measures rate and pitch", () => {
    const b = computeBaseline(speech(30000, 250));
    expect(b).not.toBeNull();
    expect(b!.meanF0).toBeCloseTo(250, 0);
    expect(b!.peaksPerSec).toBeGreaterThan(3);
  });
});

describe("pace classification", () => {
  const base = paceFeatures(speech(30000, 250, 200));
  it("ok when similar to baseline", () => {
    expect(classifyPace(base, paceFeatures(speech(5000, 255, 200)), [6, 6])).toBe("ok");
  });
  it("acelerado: rate +35% and F0 +15%", () => {
    expect(classifyPace(base, paceFeatures(speech(5000, 300, 120)), [6, 6])).toBe("acelerado");
  });
  it("faster speech without higher pitch is still ok", () => {
    expect(classifyPace(base, paceFeatures(speech(5000, 250, 120)), [6, 6])).toBe("ok");
  });
  it("cansado: rate -30% and answers getting shorter", () => {
    expect(classifyPace(base, paceFeatures(speech(5000, 250, 400)), [8, 4])).toBe("cansado");
    expect(classifyPace(base, paceFeatures(speech(5000, 250, 400)), [4, 8])).toBe("ok");
  });
  it("only offers a break; labels are not emotions", () => {
    expect(shouldOfferBreak("acelerado")).toBe(true);
    expect(shouldOfferBreak("ok")).toBe(false);
    expect(PAUSE_OFFER).toBe("¿Hacemos una pausa de un minuto?");
    for (const l of PACE_LABELS) expect(EMOTION_LABELS).not.toContain(l);
  });
});
