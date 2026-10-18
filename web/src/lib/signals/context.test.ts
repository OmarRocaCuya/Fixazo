import { describe, expect, it } from "vitest";
import { timeline } from "./fixtures";
import { noiseFloorDb, snrDb, meanClipping, assessContext } from "./context";

describe("noise and SNR", () => {
  const quiet = timeline([{ ms: 1000, voiced: false, rms: 0.002 }, { ms: 2000, voiced: true, rms: 0.1 }]);
  it("noise floor from pre-speech frames", () => {
    expect(noiseFloorDb(quiet) as number).toBeCloseTo(-54, 0);
  });
  it("SNR = speech level minus noise floor", () => {
    expect(snrDb(quiet) as number).toBeGreaterThan(25);
  });
  it("clipping ratio", () => {
    expect(meanClipping(timeline([{ ms: 1000, voiced: true, clip: 0.1 }]))).toBeCloseTo(0.1, 5);
  });
  it("low SNR or no speech means NO observable", () => {
    expect(assessContext({ noiseFloorDb: -55, snrDb: 30, speechDetected: true })).toEqual({ noise: "ok", observable: true });
    expect(assessContext({ noiseFloorDb: -30, snrDb: 3, speechDetected: true })).toEqual({ noise: "alto", observable: false });
    expect(assessContext({ noiseFloorDb: -55, snrDb: null, speechDetected: false }).observable).toBe(false);
  });
  it("clipping and loud background invalidate measurement without grading the child", () => {
    expect(assessContext({ noiseFloorDb: -55, snrDb: 30, speechDetected: true, clippingRatio: 0.01 }).observable).toBe(false);
    expect(assessContext({ noiseFloorDb: -55, snrDb: 30, speechDetected: true, clippingRatio: 0.009 }).observable).toBe(true);
    expect(assessContext({ noiseFloorDb: -30, snrDb: 30, speechDetected: true }).observable).toBe(false);
    expect(assessContext({ noiseFloorDb: -55, snrDb: 9, speechDetected: true }).observable).toBe(false);
  });
});
