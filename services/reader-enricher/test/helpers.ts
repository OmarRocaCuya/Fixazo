import { buildBlocks } from "../src/blocks.ts";
import { ArticleInputSchema } from "../src/schemas.ts";
import { SAMPLES } from "../src/demo/samples.ts";
import type { ArticleInput, Bloque } from "../src/types.ts";

export function sample(id: string): ArticleInput {
  const s = SAMPLES.find((x) => x.id === id);
  if (!s) throw new Error(`unknown sample ${id}`);
  return s.article;
}

export function blocksOf(article: ArticleInput | string): Bloque[] {
  const a = typeof article === "string" ? sample(article) : article;
  return buildBlocks(ArticleInputSchema.parse(a));
}

export function textAt(blocks: Bloque[], f: { bloqueId: string; inicio: number; fin: number }): string {
  const b = blocks.find((x) => x.id === f.bloqueId);
  if (!b) throw new Error(`no block ${f.bloqueId}`);
  return b.texto.slice(f.inicio, f.fin);
}
