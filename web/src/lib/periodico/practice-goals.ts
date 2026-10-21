import type { ResultadoNoticia } from "./progreso";

export const practiceGoals = {
  evidence: "Busca una palabra o dato del fragmento que justifique tu respuesta. Después prueba una pregunta nueva sin pistas.",
  explain: "En otra lectura, explica con tus palabras qué evidencia apoya tu respuesta.",
  accompanied: "Lee un fragmento acompañado y explica una idea con una razón del texto.",
};
export type PracticeGoal = keyof typeof practiceGoals;

export function nextPracticeGoal(result: ResultadoNoticia): PracticeGoal {
  const observations = Object.values(result.habilidades).filter((value) => typeof value === "boolean");
  if (observations.some((achieved) => !achieved) || (result.protocolo?.apoyos ?? 0) > 0) return "evidence";
  if (observations.length) return "explain";
  return "accompanied";
}
