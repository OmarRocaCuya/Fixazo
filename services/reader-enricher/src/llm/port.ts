import type { Bloque, LlmAnalysis } from "../types.ts";

export interface LlmInput {
  blocks: Bloque[];
  /** School grade 1–11, used to adapt glossary definitions. */
  grado: number;
}

/**
 * Driven port: one structured call that returns genre, layout hints, glossary,
 * entities and 5W. Implementations must return null (never throw) on any failure;
 * callers still guard with try/catch and fall back to deterministic heuristics.
 */
export interface LlmPort {
  readonly modelo: string;
  analyze(input: LlmInput): Promise<LlmAnalysis | null>;
}
