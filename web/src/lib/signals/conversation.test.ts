import { describe, expect, it } from "vitest";
import {
  classifyChildTurn,
  isBargeIn,
  reaskWithoutAnswer,
  verifyAgentUtterance,
  safeAgentUtterance,
  revisionQuality,
} from "./conversation";
import type { Question } from "../types";

const q: Question = {
  id: "q1",
  kind: "obtiene",
  text: "¿A dónde fue Rosa primero?",
  simpler: "¿Qué lugar dice la lectura?",
  answerKey: { primary: ["río"], partial: ["agua"] },
};

describe("child turn classification", () => {
  it("asks to repeat", () => {
    expect(classifyChildTurn("¿otra vez?").asksRepeat).toBe(true);
    expect(classifyChildTurn("no entendí").asksRepeat).toBe(true);
    expect(classifyChildTurn("¿qué?").asksRepeat).toBe(true);
    expect(classifyChildTurn("repite por favor").asksRepeat).toBe(true);
  });
  it("asks for the answer", () => {
    expect(classifyChildTurn("dime la respuesta").asksAnswer).toBe(true);
    expect(classifyChildTurn("¿cuál es la respuesta?").asksAnswer).toBe(true);
    expect(classifyChildTurn("dímelo tú").asksAnswer).toBe(true);
    expect(classifyChildTurn("fue al río").asksAnswer).toBe(false);
  });
  it("detects the child's own questions", () => {
    expect(classifyChildTurn("¿por qué estaba seco el río?").ownQuestions).toEqual(["¿por qué estaba seco el río?"]);
    expect(classifyChildTurn("porque estaba seco").ownQuestions).toEqual([]);
  });
  it("too short / empty", () => {
    expect(classifyChildTurn("sí").tooShort).toBe(true);
    expect(classifyChildTurn("   ").empty).toBe(true);
  });
});

describe("barge-in", () => {
  it("is true when speech starts while the agent speaks", () => {
    expect(isBargeIn(1500, [{ start: 1000, end: 3000 }])).toBe(true);
    expect(isBargeIn(3500, [{ start: 1000, end: 3000 }])).toBe(false);
  });
});

describe("answer-leak verifier", () => {
  it("blocks utterances that reveal the answer", () => {
    expect(verifyAgentUtterance("La respuesta es: fue al río.", q).ok).toBe(false);
    expect(verifyAgentUtterance("Rosa fue al río primero.", q).ok).toBe(false);
  });
  it("allows the question itself and neutral prompts", () => {
    expect(verifyAgentUtterance("¿A dónde fue Rosa primero?", q).ok).toBe(true);
    expect(verifyAgentUtterance("Busca en la primera línea de la lectura.", q).ok).toBe(true);
  });
  it("the re-ask never leaks", () => {
    const r = reaskWithoutAnswer(q);
    expect(verifyAgentUtterance(r, q).ok).toBe(true);
    expect(r).toMatch(/no te voy a dar la respuesta/i);
  });
  it("safeAgentUtterance replaces a leak with a re-ask", () => {
    expect(safeAgentUtterance("La respuesta es el río", q)).toBe(reaskWithoutAnswer(q));
  });
});

describe("revision after counter-evidence", () => {
  it("keeping with a good reason counts as revision with reason", () => {
    expect(revisionQuality("mantengo", 2)).toEqual({ kind: "mantiene", withReason: true, quality: "razon_con_dato" });
    expect(revisionQuality("cambio", 3)).toEqual({ kind: "cambia", withReason: true, quality: "considera_otra" });
    expect(revisionQuality("cambio", 0).withReason).toBe(false);
  });
});
