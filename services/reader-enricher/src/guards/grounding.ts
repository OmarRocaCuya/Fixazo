import { escapeRegExp } from "../text.ts";
import type { Bloque, Cita, Fuente } from "../types.ts";

/**
 * Anti-hallucination guard. Everything shown to students (entities, glossary terms,
 * quotes, figures, 5W answers) must be a literal substring of the source blocks.
 * Callers drop any item for which `locate` returns null.
 */

const WRAPPERS = /^[\s«»"“”'‘’]+|[\s«»"“”'‘’]+$/g;

function normalizeNeedle(needle: string): string {
  return needle.replace(WRAPPERS, "").replace(/\s+/g, " ").trim();
}

function needleRegex(needle: string, flags: string, wholeWord = false): RegExp {
  const body = needle.split(" ").map(escapeRegExp).join("\\s+");
  return wholeWord ? new RegExp(`(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`, flags) : new RegExp(body, flags);
}

export interface LocateOptions {
  /** Only search in these blocks. */
  bloqueIds?: string[];
}

function candidates(blocks: Bloque[], opts?: LocateOptions): Bloque[] {
  return opts?.bloqueIds ? blocks.filter((b) => opts.bloqueIds!.includes(b.id)) : blocks;
}

/** Finds the first literal occurrence (exact casing preferred, then case-insensitive). */
export function locate(blocks: Bloque[], needle: string, opts?: LocateOptions): Cita | null {
  const n = normalizeNeedle(needle ?? "");
  if (n.length < 2) return null;
  for (const flags of ["u", "iu"]) {
    const re = needleRegex(n, flags);
    for (const b of candidates(blocks, opts)) {
      const m = re.exec(b.texto);
      if (m) return { texto: m[0], fuente: { bloqueId: b.id, inicio: m.index, fin: m.index + m[0].length } };
    }
  }
  return null;
}

/** All whole-word, case-insensitive occurrences. */
export function locateAll(blocks: Bloque[], needle: string, opts?: LocateOptions): Fuente[] {
  const n = normalizeNeedle(needle ?? "");
  if (n.length < 2) return [];
  const out: Fuente[] = [];
  for (const b of candidates(blocks, opts)) {
    for (const m of b.texto.matchAll(needleRegex(n, "giu", true))) {
      out.push({ bloqueId: b.id, inicio: m.index!, fin: m.index! + m[0].length });
    }
  }
  return out;
}

/** True when `cita.fuente` points at exactly `cita.texto` in the source. */
export function verify(blocks: Bloque[], cita: Cita): boolean {
  const b = blocks.find((x) => x.id === cita.fuente.bloqueId);
  if (!b) return false;
  const { inicio, fin } = cita.fuente;
  if (inicio < 0 || fin <= inicio || fin > b.texto.length) return false;
  return b.texto.slice(inicio, fin) === cita.texto;
}

/** Locates each candidate text; returns grounded citas and how many were dropped. */
export function groundAll(blocks: Bloque[], texts: Array<string | null | undefined>, opts?: LocateOptions) {
  let descartados = 0;
  const citas: Cita[] = [];
  for (const t of texts) {
    if (!t) continue;
    const c = locate(blocks, t, opts);
    if (c && verify(blocks, c)) citas.push(c);
    else descartados++;
  }
  return { citas, descartados };
}
