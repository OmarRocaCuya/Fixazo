import type { ResultadoNoticia } from "./progreso";
import type { FamilySummary } from "@/lib/report/family-share";

export interface PeriodicoReport {
  skills: Array<{ name: string; achieved: boolean }>;
  achieved: number;
  observed: number;
  initial: { correct: number; observed: number } | null;
  assisted: { correct: number; observed: number } | null;
  supports: number | null;
  voiceStatus: "evaluada" | "no_evaluable";
  voiceCriteria: Array<{ name: string; achieved: boolean }>;
  nextStep: string;
  share: FamilySummary;
}

/** Missing voice evidence is not failure; supported practice is not independent transfer. */
export function buildPeriodicoReport(result: ResultadoNoticia): PeriodicoReport {
  const skills = Object.entries(result.habilidades).filter(([, value]) => typeof value === "boolean").map(([name, achieved]) => ({ name, achieved }));
  const achieved = skills.filter((s) => s.achieved).length;
  const protocol = result.protocolo?.version === "contraprueba-v1" ? result.protocolo : null;
  const initialAnswers = protocol?.preguntas.filter((q) => typeof q.aciertoInicial === "boolean");
  const assistedAnswers = protocol?.preguntas.filter((q) => q.conApoyo && typeof q.aciertoFinal === "boolean");
  const initial = initialAnswers ? { correct: initialAnswers.filter((q) => q.aciertoInicial).length, observed: initialAnswers.length } : null;
  const assisted = assistedAnswers ? { correct: assistedAnswers.filter((q) => q.aciertoFinal).length, observed: assistedAnswers.length } : null;
  const supports = protocol ? Math.max(0, Math.floor(Number.isFinite(protocol.apoyos) ? protocol.apoyos : 0)) : null;
  const voiceCriteria = result.voz?.criterios.map((criterion) => ({ name: criterion.nombre, achieved: criterion.cumple })) ?? [];
  const nextStep = skills.some((s) => !s.achieved) || (supports !== null && supports > 0)
    ? "Vuelve al fragmento y busca una palabra o dato que ayude a justificar tu respuesta. Después, prueba una pregunta nueva sin pistas."
    : skills.length ? "Prueba otra lectura y explica con tus palabras qué evidencia apoya tu respuesta." : "Revisa el texto acompañado y explica una idea con una razón del fragmento.";
  const protocolLines = initial && assisted
    ? [initial.observed ? `Primeras respuestas sin apoyo: ${initial.correct} de ${initial.observed} con respuesta esperada.` : "Primeras respuestas sin apoyo: sin observaciones con criterio de acierto.", assisted.observed ? `Respuestas finales con apoyo: ${assisted.correct} de ${assisted.observed} con respuesta esperada.` : "Respuestas finales con apoyo: sin observaciones con criterio de acierto.", `Apoyos presentados en opción múltiple: ${supports}.`]
    : ["Registro anterior: detalle de primeras respuestas y apoyos no disponible."];
  return {
    skills, achieved, observed: skills.length, initial, assisted, supports,
    voiceStatus: result.voz ? "evaluada" : "no_evaluable",
    voiceCriteria,
    nextStep,
    share: {
      title: "Resumen del quiz · Ñawinchay",
      filename: "nawinchay-resumen-quiz.txt",
      text: [
        "Ñawinchay · Resumen del quiz de lectura",
        "Observaciones de esta actividad, no una nota global ni un diagnóstico.",
        ...protocolLines,
        `Resultados finales de habilidades en esta actividad: ${achieved} de ${skills.length} con respuesta esperada.`,
        "Un resultado con apoyo o en el mismo texto no demuestra dominio ni transferencia independiente.",
        result.voz ? "Explicación escrita o hablada: revisión automática provisional, pendiente de revisión humana." : "Explicación escrita o hablada: sin evaluación (no es un fallo).",
        `Siguiente paso: ${nextStep}`,
        "Resumen sin nombre, respuestas textuales, audio ni opiniones personales.",
      ].join("\n"),
    },
  };
}

