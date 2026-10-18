import type { z } from "zod";
import type { Bloque, CincoW, Entidad, Genero, LayoutId, LlmAnalysis, Visuales } from "../types.ts";

/** Everything a layout builder may use. All layers are already grounded. */
export interface LayoutContext {
  blocks: Bloque[];
  /** Validated LLM output, or null on the deterministic path. Quotes in it are NOT yet grounded. */
  analysis: LlmAnalysis | null;
  entidades: Entidad[];
  cincoW: CincoW;
  visuales: Visuales;
}

export interface LayoutResult<T> {
  data: T;
  /** Items dropped by the grounding guard. */
  descartados: number;
}

/** One file per layout implements this. Register it in ./index.ts. */
export interface LayoutDef<T = unknown> {
  id: LayoutId;
  /** User-facing name (Spanish). */
  nombre: string;
  /** User-facing description (Spanish). */
  descripcion: string;
  generos: Genero[];
  schema: z.ZodType<T>;
  build(ctx: LayoutContext): LayoutResult<T>;
}
