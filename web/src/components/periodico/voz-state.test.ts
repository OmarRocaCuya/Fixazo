import { describe, expect, it } from "vitest";
import { applyVoiceEvaluation, RecordingAnswer, voiceHistoryLabel } from "./voz-state";
import type { RespuestaVoz } from "@/lib/periodico/tipos";
const unavailable: RespuestaVoz = { evaluacion: "no_evaluable", cuenta: false, listo: false, ia: false, criterios: [], retro: "Servicio no disponible" };
describe("newspaper recording answer", () => {
  it("preserves the displayed base when a second recording is stopped", () => {
    const answer = new RecordingAnswer();
    let epoch = answer.begin("Pienso esto porque");
    expect(answer.partial(epoch, "el texto da una razón")).toBe("Pienso esto porque el texto da una razón");
    expect(answer.finish(epoch, "el texto da dos razones")).toBe("Pienso esto porque el texto da dos razones");
    epoch = answer.begin("Pienso esto porque el texto da dos razones");
    expect(answer.finish(epoch, "y muestra evidencia")).toBe("Pienso esto porque el texto da dos razones y muestra evidencia");
  });
  it("keeps the last displayed transcript if stop returns empty", () => {
    const answer = new RecordingAnswer(); const epoch = answer.begin("base");
    answer.partial(epoch, "respuesta parcial");
    expect(answer.finish(epoch, "")).toBe("base respuesta parcial");
  });
  it("ignores canceled and late callbacks, including an old stop resolution", () => {
    const answer = new RecordingAnswer(); const old = answer.begin("primera");
    answer.cancel(); const current = answer.begin("segunda");
    expect(answer.partial(old, "tarde")).toBeNull(); expect(answer.finish(old, "tarde")).toBeNull();
    expect(answer.finish(current, "válida")).toBe("segunda válida");
    expect(answer.partial(current, "después de parar")).toBeNull();
  });
});
describe("newspaper evaluation availability", () => {
  it("never consumes an attempt or completes the question after an outage", () => {
    expect(applyVoiceEvaluation(unavailable, 1)).toEqual({ evaluated: false, attempts: 1, complete: false });
    expect(applyVoiceEvaluation({ ...unavailable, listo: true, cuenta: true }, 1).complete).toBe(false);
  });
  it("requires the explicit evaluated and counted contract", () => {
    const result = { ...unavailable, evaluacion: "evaluada" as const, cuenta: true, ia: true };
    expect(applyVoiceEvaluation(result, 0)).toEqual({ evaluated: true, attempts: 1, complete: false });
    expect(applyVoiceEvaluation(result, 1)).toEqual({ evaluated: true, attempts: 2, complete: true });
    expect(applyVoiceEvaluation({ ...result, cuenta: false }, 1).attempts).toBe(1);
  });
  it("does not label missing voice evidence as a negative result", () => {
    expect(voiceHistoryLabel(null)).toBe("sin evaluación de voz");
    expect(voiceHistoryLabel({ listo: true })).toBe("porqué logrado");
    expect(voiceHistoryLabel({ listo: false })).toBe("porqué para practicar");
  });
});
