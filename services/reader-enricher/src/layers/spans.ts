import type { Entidad, GlosarioItem, Span } from "../types.ts";

/**
 * Flat list of highlightable ranges for the renderer: sorted by block and offset,
 * never overlapping. Glossary terms win over entities; then longer ranges win.
 */
export function buildSpans(glosario: GlosarioItem[], entidades: Entidad[]): Span[] {
  const candidates: Span[] = [
    ...glosario.flatMap((g) => g.apariciones.map((f) => ({ ...f, tipo: "glosario" as const, refId: g.id }))),
    ...entidades.flatMap((e) => e.apariciones.map((f) => ({ ...f, tipo: "entidad" as const, refId: e.id }))),
  ];
  const priority = (s: Span) => (s.tipo === "glosario" ? 0 : 1);
  candidates.sort((a, b) => priority(a) - priority(b) || b.fin - b.inicio - (a.fin - a.inicio));
  const kept: Span[] = [];
  for (const s of candidates) {
    if (kept.some((k) => k.bloqueId === s.bloqueId && k.inicio < s.fin && s.inicio < k.fin)) continue;
    kept.push(s);
  }
  return kept.sort((a, b) => (a.bloqueId === b.bloqueId ? a.inicio - b.inicio : a.bloqueId < b.bloqueId ? -1 : 1));
}
