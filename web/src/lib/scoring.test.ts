import { describe, expect, it } from "vitest";
import { scoreObtiene, scoreInfiere, scoreReflexiona, toLevelResult, buildJudgmentChain, calibrate, MAX_HELPS } from "./scoring";
import { SAMPLE_ES, SAMPLE_QU } from "./mission/samples";

const [qO, qI, qR] = SAMPLE_ES.questions;

describe("Obtiene (rules: 0/2/3/NO)", () => {
  it("3 with the key word (accent-insensitive)", () => {
    expect(scoreObtiene("fue al rio", qO).level).toBe(3);
  });
  it("2 with a partial answer", () => {
    expect(scoreObtiene("a traer agua", qO).level).toBe(2);
  });
  it("0 with an unrelated answer", () => {
    expect(scoreObtiene("al colegio", qO).level).toBe(0);
  });
  it("NO when not observable or empty — never 0", () => {
    expect(scoreObtiene("", qO).level).toBe("NO");
    expect(scoreObtiene("fue al río", qO, { unobservable: true }).level).toBe("NO");
  });
  it("works with Quechua answers", () => {
    expect(scoreObtiene("mayuman", SAMPLE_QU.questions[0]).level).toBe(3);
  });
});

describe("Infiere (0 unrelated, 1 repeats, 2 valid, 3 + evidence)", () => {
  it("3: causal connector + text evidence", () => {
    expect(scoreInfiere("porque el río estaba seco", qI, SAMPLE_ES).level).toBe(3);
  });
  it("2: causal connector + content from the text", () => {
    expect(scoreInfiere("porque necesitaba agua para su familia", qI, SAMPLE_ES).level).toBe(2);
  });
  it("1: repeats the text without explaining", () => {
    expect(scoreInfiere("llevaba dos baldes y cantaba", qI, SAMPLE_ES).level).toBe(1);
  });
  it("0: unrelated", () => {
    expect(scoreInfiere("porque quería jugar fútbol", qI, SAMPLE_ES).level).toBe(0);
  });
  it("Quechua: chaymi + chakisqa", () => {
    expect(scoreInfiere("mayu chakisqam karqa, chaymi", SAMPLE_QU.questions[1], SAMPLE_QU).level).toBe(3);
  });
});

describe("Reflexiona with counter-evidence (PRD §11.2)", () => {
  it("0: no reason", () => {
    expect(scoreReflexiona("no sé", SAMPLE_ES).level).toBe(0);
    expect(scoreReflexiona("porque sí", SAMPLE_ES).level).toBe(0);
  });
  it("1: reason not from the text or the counter", () => {
    expect(scoreReflexiona("porque Rosa es buena", SAMPLE_ES).level).toBe(1);
  });
  it("2: reason uses a fact from the text or the counter", () => {
    expect(scoreReflexiona("porque estaba oscuro y es lejos", SAMPLE_ES).level).toBe(2);
  });
  it("3: also considers another option", () => {
    expect(scoreReflexiona("debió ir con su mamá, porque es lejos y estaba oscuro", SAMPLE_ES).level).toBe(3);
  });
  it("keeping the idea with a good reason is worth the same as changing", () => {
    const reason = "porque su familia necesitaba agua y el río estaba seco";
    expect(scoreReflexiona(reason, SAMPLE_ES, { decision: "mantengo" }).level).toBe(scoreReflexiona(reason, SAMPLE_ES, { decision: "cambio" }).level);
    expect(scoreReflexiona(reason, SAMPLE_ES, { decision: "mantengo" }).level).toBe(2);
  });
  it("NO when not observable", () => {
    expect(scoreReflexiona("porque es lejos", SAMPLE_ES, { unobservable: true }).level).toBe("NO");
  });
});

describe("help and level results", () => {
  it("marks 'con ayuda' and caps helps at 2", () => {
    const r = toLevelResult(scoreObtiene("fue al río", qO), 3);
    expect(r.withHelp).toBe(true);
    expect(r.helps).toBe(MAX_HELPS);
    expect(toLevelResult(scoreObtiene("fue al río", qO), 0).withHelp).toBe(false);
  });
  it("NO observable results carry status no_observable", () => {
    expect(toLevelResult(scoreObtiene("", qO), 0).status).toBe("no_observable");
  });
});

describe("judgment chain (Toulmin)", () => {
  it("collects stance, reason, evidence, alternative and revision with quotes", () => {
    const c = buildJudgmentChain({
      stance: "Sí, hizo bien porque necesitaban agua",
      reason: "Cambio, debió ir con su mamá porque es lejos y estaba oscuro",
      decision: "cambio",
      mission: SAMPLE_ES,
    });
    expect(c.stance.present).toBe(true);
    expect(c.reason.present).toBe(true);
    expect(c.evidence.present).toBe(true);
    expect(c.alternative.present).toBe(true);
    expect(c.alternative.quote).toMatch(/debió ir con su mamá/);
    expect(c.revision).toMatchObject({ decision: "cambio", changed: true, withReason: true });
  });
  it("missing elements are marked absent", () => {
    const c = buildJudgmentChain({ stance: "sí", reason: "no sé", decision: "mantengo", mission: SAMPLE_ES });
    expect(c.reason.present).toBe(false);
    expect(c.evidence.present).toBe(false);
    expect(c.revision.withReason).toBe(false);
    void qR;
  });
});

describe("calibration (confidence vs. correctness)", () => {
  it("ajustada / sobreconfianza / subconfianza / sin_dato", () => {
    expect(calibrate("muy", [3, 3])).toBe("ajustada");
    expect(calibrate("muy", [0, 1])).toBe("sobreconfianza");
    expect(calibrate("poco", [3, 2])).toBe("subconfianza");
    expect(calibrate("poco", [0, 0])).toBe("ajustada");
    expect(calibrate(null, [3])).toBe("sin_dato");
    expect(calibrate("muy", ["NO", "NO"])).toBe("sin_dato");
  });
});
