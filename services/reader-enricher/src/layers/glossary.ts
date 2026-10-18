import { locateAll } from "../guards/grounding.ts";
import { splitSentences } from "../text.ts";
import type { Bloque, GlosarioItem, LlmAnalysis } from "../types.ts";

type LlmTerm = LlmAnalysis["glosario"][number];

const MAX_TERMS = 12;

/** Younger readers get shorter definitions. */
export function maxDefinitionChars(grado: number): number {
  return grado <= 4 ? 90 : grado <= 6 ? 130 : 200;
}

function fit(text: string, max: number): string {
  const t = text.trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  const first = splitSentences(t)[0]?.texto ?? t;
  return first.length <= max ? first : `${first.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Glossary layer. Terms come only from the LLM (empty without it) and are kept only
 * if they appear literally (whole word) in the source.
 */
export function buildGlossary(blocks: Bloque[], llm: LlmTerm[] | null, grado: number) {
  let descartados = 0;
  const items: GlosarioItem[] = [];
  const seen = new Set<string>();
  for (const term of llm ?? []) {
    const key = term.termino.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    const apariciones = locateAll(blocks, term.termino);
    if (!apariciones.length || !term.definicion.trim()) {
      descartados++;
      continue;
    }
    seen.add(key);
    const first = apariciones[0]!;
    const b = blocks.find((x) => x.id === first.bloqueId)!;
    items.push({
      id: `g${items.length}`,
      termino: b.texto.slice(first.inicio, first.fin),
      definicion: fit(term.definicion, maxDefinitionChars(grado)),
      ejemplo: fit(term.ejemplo, 200),
      fuente: first,
      apariciones,
    });
    if (items.length >= MAX_TERMS) break;
  }
  return { items, descartados };
}
