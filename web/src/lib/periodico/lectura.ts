import "server-only";

import { isDeepStrictEqual } from "node:util";
import { buildBlocks } from "@reader-enricher/blocks";
import { enrich } from "@reader-enricher/enrich";
import { tokenize } from "@reader-enricher/layers/karaoke";
import { layoutForGenre } from "@reader-enricher/layouts/index";
import { EnrichedDocumentSchema, EnrichRequestSchema, MAX_TEXT_CHARS, SCHEMA_VERSION } from "@reader-enricher/schemas";
import type { ArticleInput, Bloque, EnrichedDocument, Fuente } from "@reader-enricher/types";
import type { NoticiaPublica } from "./tipos";

const REMOTE_TIMEOUT_MS = 4_000;
const MAX_RESPONSE_CHARS = 2_000_000;

/** Explicit projection: questions, answers, rubrics and reader data never leave this server. */
function articleForReading(noticia: NoticiaPublica): ArticleInput {
  return {
    id: noticia.id,
    titular: noticia.titular,
    bajada: noticia.bajada,
    seccion: noticia.seccion,
    fragmentos: noticia.pasos.filter((p) => p.tipo === "fragmento").map((f) => ({
      lado: f.lado, medio: f.medio, fecha: f.fecha, titular: f.titular, texto: f.texto, url: f.url,
    })),
  };
}

function sourceText(blocks: Map<string, Bloque>, fuente: Fuente): string {
  const block = blocks.get(fuente.bloqueId);
  if (!block || !Number.isInteger(fuente.inicio) || !Number.isInteger(fuente.fin)
    || fuente.inicio < 0 || fuente.fin < fuente.inicio || fuente.fin > block.texto.length) {
    throw new Error("invalid-source");
  }
  return block.texto.slice(fuente.inicio, fuente.fin);
}

/** Layout schemas validate shape, not that their references actually cite this article. */
function checkReferences(value: unknown, blocks: Map<string, Bloque>): void {
  if (Array.isArray(value)) {
    value.forEach((item) => checkReferences(item, blocks));
    return;
  }
  if (!value || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  if (typeof record.bloqueId === "string") {
    if (!blocks.has(record.bloqueId)) throw new Error("unknown-block");
    if ("inicio" in record && "fin" in record) sourceText(blocks, { bloqueId: record.bloqueId, inicio: record.inicio as number, fin: record.fin as number });
  }
  if (Array.isArray(record.bloqueIds) && record.bloqueIds.some((id) => typeof id !== "string" || blocks.get(id)?.rol !== "cuerpo")) {
    throw new Error("invalid-body-reference");
  }
  if (record.fuente && typeof record.fuente === "object") {
    const literal = sourceText(blocks, record.fuente as Fuente);
    const quoted = typeof record.texto === "string" ? record.texto : record.termino;
    if (typeof quoted === "string" && quoted !== literal) throw new Error("altered-quote");
  }
  Object.values(record).forEach((item) => checkReferences(item, blocks));
}

function validatedDocument(value: unknown, article: ArticleInput): EnrichedDocument {
  const doc = EnrichedDocumentSchema.parse(value);
  const expectedArticle = { id: article.id ?? null, titular: article.titular, bajada: article.bajada ?? null, seccion: article.seccion ?? null };
  if (doc.version !== SCHEMA_VERSION || doc.meta.version !== SCHEMA_VERSION
    || !isDeepStrictEqual(doc.articulo, expectedArticle)) throw new Error("different-article");

  const expectedBlocks = buildBlocks(EnrichRequestSchema.shape.article.parse(article));
  if (!isDeepStrictEqual(doc.bloques, expectedBlocks)) throw new Error("altered-source-text");
  const layout = layoutForGenre(doc.genero);
  if (layout.id !== doc.layout.id) throw new Error("different-layout");
  doc.layout = { id: layout.id, nombre: layout.nombre, data: layout.schema.parse(doc.layout.data) };
  checkReferences([doc.layout.data, doc.capas, doc.spans], new Map(doc.bloques.map((b) => [b.id, b])));

  // No audio/timings are sent by this integration; reject invented playback alignment too.
  if (!isDeepStrictEqual(doc.capas.karaoke, tokenize(expectedBlocks))) throw new Error("altered-tokens");
  for (const span of doc.spans) {
    const items = span.tipo === "glosario" ? doc.capas.glosario : doc.capas.entidades;
    if (!items.some((item) => item.id === span.refId && item.apariciones.some((f) =>
      f.bloqueId === span.bloqueId && f.inicio === span.inicio && f.fin === span.fin))) throw new Error("invalid-span");
  }
  return doc;
}

async function remoteDocument(baseUrl: string, article: ArticleInput): Promise<EnrichedDocument> {
  const url = new URL(`${baseUrl.replace(/\/+$/, "")}/v1/enrich`);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("invalid-service-url");
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { controller.abort(); reject(new Error("enrichment-timeout")); }, REMOTE_TIMEOUT_MS);
  });
  try {
    return await Promise.race([
      (async () => {
        const token = process.env.READER_ENRICHER_TOKEN;
        const response = await fetch(url, {
          method: "POST", cache: "no-store", redirect: "error", signal: controller.signal,
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ article }),
        });
        if (!response.ok || Number(response.headers.get("content-length")) > MAX_RESPONSE_CHARS) throw new Error("enrichment-unavailable");
        const body = await response.text();
        if (body.length > MAX_RESPONSE_CHARS) throw new Error("enrichment-too-large");
        return validatedDocument(JSON.parse(body), article);
      })(),
      deadline,
    ]);
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}

/** Server-only remote enrichment → deterministic offline enrichment → original reading. */
export async function getLecturaEnriquecida(noticia: NoticiaPublica): Promise<EnrichedDocument | null> {
  try {
    const request = EnrichRequestSchema.parse({ article: articleForReading(noticia) });
    const { article } = request;
    const size = article.titular.length + (article.bajada?.length ?? 0)
      + article.fragmentos.reduce((total, f) => total + (f.titular?.length ?? 0) + f.texto.length, 0);
    if (size > MAX_TEXT_CHARS) return null;
    const remote = process.env.READER_ENRICHER_URL?.trim();
    if (remote) {
      try { return await remoteDocument(remote, article); }
      catch { /* A remote failure never removes the news text or blocks the questionnaire. */ }
    }
    return validatedDocument(await enrich(request, { llm: null }), article);
  } catch {
    return null;
  }
}
