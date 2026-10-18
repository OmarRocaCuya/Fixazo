import type { z } from "zod";
import type { ArticleInputSchema } from "./schemas.ts";
import type { Bloque } from "./types.ts";

export type ParsedArticle = z.output<typeof ArticleInputSchema>;

/**
 * Turns the article into addressable text blocks. Every offset in the response
 * (fuente, karaoke tokens, spans) is relative to one of these blocks' `texto`.
 * Ids: "h" titular, "s" bajada, "f{n}t" fragment titular, "f{n}p{m}" paragraph.
 */
export function buildBlocks(article: ParsedArticle): Bloque[] {
  const blocks: Bloque[] = [];
  const base = { fragmento: null, lado: null, medio: null, fecha: null, url: null } as const;
  blocks.push({ ...base, id: "h", rol: "titular", texto: article.titular.trim() });
  if (article.bajada?.trim()) blocks.push({ ...base, id: "s", rol: "bajada", texto: article.bajada.trim() });

  article.fragmentos.forEach((f, n) => {
    const meta = {
      fragmento: n,
      lado: f.lado ?? null,
      medio: f.medio ?? null,
      fecha: f.fecha ?? null,
      url: f.url ?? null,
    };
    const ft = f.titular?.trim();
    if (ft && ft !== article.titular.trim()) blocks.push({ ...meta, id: `f${n}t`, rol: "titular", texto: ft });
    f.texto
      .split(/\r?\n+/)
      .map((p) => p.trim())
      .filter(Boolean)
      .forEach((p, m) => blocks.push({ ...meta, id: `f${n}p${m}`, rol: "cuerpo", texto: p }));
  });
  return blocks;
}

export function bodyBlocks(blocks: Bloque[]): Bloque[] {
  return blocks.filter((b) => b.rol === "cuerpo");
}

export function hasTwoSides(blocks: Bloque[]): boolean {
  const sides = new Set(bodyBlocks(blocks).map((b) => b.lado));
  return sides.has("a") && sides.has("b");
}
