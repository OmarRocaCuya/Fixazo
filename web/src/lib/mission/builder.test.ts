import { describe, expect, it } from "vitest";
import { buildMissionFromText, validateMission, GRADE_WORD_RANGE, detectTextLang } from "./builder";
import { SAMPLE_ES, SAMPLE_QU } from "./samples";
import { verifyAgentUtterance } from "../signals/conversation";
import { tokenize } from "../signals/text";

const PASTED = `El ciclo del agua
El sol calienta el agua de los ríos y del mar. Por eso el agua sube al cielo como vapor.
Arriba hace frío, entonces el vapor se junta y forma las nubes. Cuando las nubes pesan mucho, cae la lluvia.
La lluvia llena otra vez los ríos, porque el agua baja de los cerros. Así el agua da vueltas y vueltas.
Pero no toda el agua vuelve al río: una parte se queda dentro de la tierra y alimenta a las plantas.
Los campesinos de la sierra cuidan los puquios, porque allí sale el agua que guardó la tierra.`;

describe("deterministic mission builder", () => {
  const r = buildMissionFromText(PASTED, { grade: 4, now: "2026-10-17T10:00:00.000Z" });
  if (!r.ok) throw new Error(r.error);
  const m = r.mission;

  it("uses a short first line as the title", () => {
    expect(m.title).toBe("El ciclo del agua");
  });
  it("keeps the reading within the grade range", () => {
    const n = tokenize(m.text).length;
    const [min, max] = GRADE_WORD_RANGE[4];
    expect(n).toBeGreaterThanOrEqual(min);
    expect(n).toBeLessThanOrEqual(max);
  });
  it("always has Obtiene, Infiere, Reflexiona and a counter", () => {
    expect(m.questions.map((q) => q.kind)).toEqual(["obtiene", "infiere", "reflexiona"]);
    expect(m.counter.text.length).toBeGreaterThan(10);
    expect(validateMission(m).errors).toEqual([]);
  });
  it("Obtiene has an answer key taken from the text", () => {
    const key = m.questions[0].answerKey!;
    expect(key.primary.length).toBeGreaterThan(0);
    const words = tokenize(m.text);
    expect(words).toContain(tokenize(key.primary[0])[0]);
  });
  it("Infiere uses a causal sentence and has evidence keys", () => {
    expect(m.questions[1].text).toMatch(/^¿Por qué/);
    expect(m.questions[1].evidenceKeys!.length).toBeGreaterThan(0);
  });
  it("questions never reveal their own answer", () => {
    for (const q of m.questions) expect(verifyAgentUtterance(q.text, q).ok).toBe(true);
  });
  it("the Infiere question does not reveal the Obtiene answer", () => {
    expect(verifyAgentUtterance(m.questions[1].text, m.questions[0]).ok).toBe(true);
  });
  it("is deterministic", () => {
    const again = buildMissionFromText(PASTED, { grade: 4, now: "2026-10-17T10:00:00.000Z" });
    expect(again.ok && again.mission).toEqual(m);
  });
  it("rejects very short texts with a clear message", () => {
    const bad = buildMissionFromText("Hola, ¿cómo estás?", { grade: 4 });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toMatch(/20 palabras/);
  });
});

describe("mission validation (RF-46)", () => {
  it("samples are valid", () => {
    expect(validateMission(SAMPLE_ES).errors).toEqual([]);
    expect(validateMission(SAMPLE_QU).errors).toEqual([]);
  });
  it("detects structural problems", () => {
    const broken = { ...SAMPLE_ES, questions: [SAMPLE_ES.questions[0]], counter: { text: "" } };
    const v = validateMission(broken as never);
    expect(v.valid).toBe(false);
    expect(v.errors.join(" ")).toMatch(/3 preguntas/);
    expect(v.errors.join(" ")).toMatch(/contraprueba/);
  });
  it("detects text language", () => {
    expect(detectTextLang(SAMPLE_QU.text)).toBe("qu");
    expect(detectTextLang(SAMPLE_ES.text)).toBe("es");
  });
});
