import type { Bloque, EnrichedDocument, Fuente, Span } from "@reader-enricher/types";

export function safeSourceUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function blockAnchor(id: string): string {
  return `lectura-bloque-${encodeURIComponent(id)}`;
}

export function validSource(blocks: Bloque[], source: Fuente): boolean {
  const block = blocks.find((candidate) => candidate.id === source.bloqueId);
  return !!block && source.inicio >= 0 && source.fin > source.inicio && source.fin <= block.texto.length;
}

/** Invalid/overlapping annotations never delete or replace the original characters. */
export function textSegments(text: string, spans: Span[]) {
  const sorted = spans.filter((span) => span.inicio >= 0 && span.fin > span.inicio && span.fin <= text.length)
    .sort((a, b) => a.inicio - b.inicio || b.fin - a.fin || a.tipo.localeCompare(b.tipo));
  const result: Array<{ text: string; inicio: number; span?: Span }> = [];
  let cursor = 0;
  for (const span of sorted) {
    if (span.inicio < cursor) continue;
    if (span.inicio > cursor) result.push({ text: text.slice(cursor, span.inicio), inicio: cursor });
    result.push({ text: text.slice(span.inicio, span.fin), inicio: span.inicio, span });
    cursor = span.fin;
  }
  if (cursor < text.length) result.push({ text: text.slice(cursor), inicio: cursor });
  return result;
}

/** Uses only a real boundary event's offset; no estimated reading pace. */
export function wordAt(text: string, index: number): { inicio: number; fin: number } | null {
  if (!Number.isInteger(index) || index < 0 || index >= text.length || /\s/u.test(text[index]!)) return null;
  let inicio = index;
  let fin = index;
  while (inicio > 0 && !/\s/u.test(text[inicio - 1]!)) inicio--;
  while (fin < text.length && !/\s/u.test(text[fin]!)) fin++;
  return { inicio, fin };
}

export function remainingBodyBlocks(document: EnrichedDocument, rendered: Set<string>): Bloque[] {
  return document.bloques.filter((block) => block.rol === "cuerpo" && !rendered.has(block.id));
}
