import { describe, expect, it } from "vitest";
import { buildPeriodicoReport } from "./informe";
import type { ResultadoNoticia } from "./progreso";

export function result(over: Partial<ResultadoNoticia> = {}): ResultadoNoticia {
  return {
    noticiaId: "private-id", titular: "private-topic", fecha: "2026-10-18",
    habilidades: { "Reconocer evidencia": true, "Distinguir opiniones": false },
    postura: "private-stance", seguridad: "private-confidence", decision: "private-decision", voz: null,
    ...over,
  };
}

describe("per-quiz final report", () => {
  it("describes observed educational responses without inventing a voice grade", () => {
    const report = buildPeriodicoReport(result());
    expect(report.achieved).toBe(1); expect(report.observed).toBe(2);
    expect(report.voiceStatus).toBe("no_evaluable"); expect(report.voiceCriteria).toEqual([]);
    expect(report.nextStep).toContain("Vuelve al fragmento");
    expect(report.share.text).toContain("sin evaluación (no es un fallo)");
  });
  it("keeps raw voice words, opinions and identifying metadata out of the shared projection", () => {
    const report = buildPeriodicoReport(result({
      voz: { listo: false, intentos: 2, criterios: [{ nombre: "private-provider-criterion", cumple: false }], dudas: ["private-hedge"], muletillas: ["private-filler"], pausasLargas: 4, segundosHablando: 29, porVoz: true },
    }));
    expect(report.voiceStatus).toBe("evaluada");
    expect(report.voiceCriteria).toEqual([{ name: "private-provider-criterion", achieved: false }]);
    expect(JSON.stringify(report.share)).not.toContain("private-");
    expect(report.share.text).toContain("provisional");
  });
  it("handles a quiz without evaluable answers without asserting failure or success", () => {
    const report = buildPeriodicoReport(result({ habilidades: {} }));
    expect(report.observed).toBe(0); expect(report.achieved).toBe(0);
    expect(report.nextStep).toContain("Revisa el texto");
  });
  it("suggests applying evidence in another reading when all observed skills were achieved", () => {
    const report = buildPeriodicoReport(result({ habilidades: { "Evidencia": true } }));
    expect(report.nextStep).toContain("Prueba otra lectura");
  });

  it("separates first responses from supported practice and never claims independent mastery", () => {
    const report = buildPeriodicoReport(result({
      habilidades: { "Evidencia": true, "Inferencia": true },
      protocolo: {
        version: "contraprueba-v1", apoyos: 2, transferencia: "no_observada",
        preguntas: [
          { preguntaId: "private-question-1", habilidad: "Evidencia", aciertoInicial: false, aciertoFinal: true, conApoyo: true, intentos: 2 },
          { preguntaId: "private-question-2", habilidad: "Inferencia", aciertoInicial: true, aciertoFinal: true, conApoyo: false, intentos: 1 },
          { preguntaId: "private-opinion", habilidad: null, aciertoInicial: null, aciertoFinal: null, conApoyo: true, intentos: 1 },
        ],
      },
    }));
    expect(report.initial).toEqual({ correct: 1, observed: 2 });
    expect(report.assisted).toEqual({ correct: 1, observed: 1 });
    expect(report.supports).toBe(2);
    expect(report.share.text).toContain("Apoyos presentados en opción múltiple: 2.");
    expect(report.share.text).not.toContain("Apoyos utilizados");
    expect(report.share.text).toContain("Primeras respuestas sin apoyo: 1 de 2");
    expect(report.share.text).toContain("Respuestas finales con apoyo: 1 de 1");
    expect(report.share.text).toContain("no demuestra dominio ni transferencia independiente");
    expect(report.share.text).not.toContain("private-");
    expect(report.nextStep).toContain("pregunta nueva sin pistas");
  });
  it("does not turn unknown historic first responses or subjective options into failures", () => {
    const report = buildPeriodicoReport(result({
      protocolo: {
        version: "contraprueba-v1", apoyos: 0, transferencia: "no_observada",
        preguntas: [{ preguntaId: "old", habilidad: null, aciertoInicial: null, aciertoFinal: null, conApoyo: false, intentos: 1 }],
      },
    }));
    expect(report.initial).toEqual({ correct: 0, observed: 0 });
    expect(report.share.text).toContain("sin observaciones con criterio de acierto");
    expect(report.share.text).not.toContain("0 de 0");
  });
});

