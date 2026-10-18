import type { z } from "zod";
import { buildBlocks } from "./blocks.ts";
import { resolveGenre } from "./genre/classify.ts";
import { classifyHeuristic } from "./genre/heuristics.ts";
import { buildEntities } from "./layers/entities.ts";
import { buildFiveW } from "./layers/fiveW.ts";
import { buildGlossary } from "./layers/glossary.ts";
import { mergeTimings, tokenize } from "./layers/karaoke.ts";
import { buildSpans } from "./layers/spans.ts";
import { detectVisuals } from "./layers/visuals.ts";
import { layoutForGenre } from "./layouts/index.ts";
import type { LlmPort } from "./llm/port.ts";
import { EnrichedDocumentSchema, type EnrichRequestSchema, SCHEMA_VERSION } from "./schemas.ts";
import type { EnrichedDocument, LlmAnalysis } from "./types.ts";

export const DEFAULT_GRADE = 8;

export interface EnrichDeps {
  llm: LlmPort | null;
}

/** Use case: article → enriched, genre-aware reading document. Never throws on LLM failure. */
export async function enrich(request: z.output<typeof EnrichRequestSchema>, deps: EnrichDeps): Promise<EnrichedDocument> {
  const { article } = request;
  const options = request.options ?? {};
  const grado = options.grado ?? DEFAULT_GRADE;
  const avisos: string[] = [];
  const blocks = buildBlocks(article);

  let analysis: LlmAnalysis | null = null;
  if (!deps.llm) avisos.push("llm_unavailable");
  else {
    try {
      analysis = await deps.llm.analyze({ blocks, grado });
    } catch {
      analysis = null;
    }
    if (!analysis) avisos.push("llm_failed");
  }

  const genre = resolveGenre({
    blocks,
    forced: options.generoForzado,
    llm: analysis ? { genero: analysis.genero, confianza: analysis.confianza } : null,
    heuristic: classifyHeuristic(blocks),
  });

  const entities = buildEntities(blocks, analysis?.entidades ?? null);
  const glossary = buildGlossary(blocks, analysis?.glosario ?? null, grado);
  const fiveW = buildFiveW(blocks, analysis?.cincoW ?? null, entities.items);
  const visuales = detectVisuals(blocks);
  const timed = mergeTimings(tokenize(blocks), options.timings ?? []);
  if (timed.ignorados) avisos.push(`timings_ignored:${timed.ignorados}`);

  const layout = layoutForGenre(genre.genero);
  const built = layout.build({ blocks, analysis, entidades: entities.items, cincoW: fiveW.cincoW, visuales });
  const data = layout.schema.parse(built.data);

  const doc: EnrichedDocument = {
    version: SCHEMA_VERSION,
    articulo: {
      id: article.id ?? null,
      titular: article.titular,
      bajada: article.bajada ?? null,
      seccion: article.seccion ?? null,
    },
    genero: genre.genero,
    layout: { id: layout.id, nombre: layout.nombre, data },
    bloques: blocks,
    capas: {
      glosario: glossary.items,
      entidades: entities.items,
      cincoW: fiveW.cincoW,
      karaoke: timed.karaoke,
      visuales,
    },
    spans: buildSpans(glossary.items, entities.items),
    meta: {
      ia: analysis !== null,
      modelo: analysis ? deps.llm!.modelo : null,
      generoConfianza: genre.confianza,
      generoFuente: genre.fuente,
      grado,
      version: SCHEMA_VERSION,
      descartados: entities.descartados + glossary.descartados + fiveW.descartados + built.descartados,
      avisos,
    },
  };
  return EnrichedDocumentSchema.parse(doc) as EnrichedDocument;
}
