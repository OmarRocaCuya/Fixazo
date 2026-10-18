import { hasTwoSides } from "../blocks.ts";
import type { Bloque, Genero } from "../types.ts";
import type { GenreGuess } from "./heuristics.ts";

export const MIN_LLM_CONFIDENCE = 0.5;

export interface ResolvedGenre {
  genero: Genero;
  confianza: number;
  fuente: "forzado" | "ia" | "heuristica";
}

/** Priority: forced > confident LLM > heuristic. "comparada" is only valid with sides a and b. */
export function resolveGenre(input: {
  blocks: Bloque[];
  forced?: Genero;
  llm: GenreGuess | null;
  heuristic: GenreGuess;
}): ResolvedGenre {
  const twoSides = hasTwoSides(input.blocks);
  const valid = (g: Genero) => g !== "comparada" || twoSides;

  if (input.forced && valid(input.forced)) return { genero: input.forced, confianza: 1, fuente: "forzado" };
  if (input.llm && input.llm.confianza >= MIN_LLM_CONFIDENCE && valid(input.llm.genero)) {
    return { genero: input.llm.genero, confianza: input.llm.confianza, fuente: "ia" };
  }
  return { ...input.heuristic, fuente: "heuristica" };
}
