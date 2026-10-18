import { bodyBlocks } from "../blocks.ts";
import { locate, locateAll, verify } from "../guards/grounding.ts";
import { DATE_RE, splitSentences } from "../text.ts";
import type { Bloque, Entidad, EntidadTipo, Fuente, LlmAnalysis } from "../types.ts";
import { detectFigures } from "./visuals.ts";

export const ETIQUETAS: Record<EntidadTipo, string> = {
  persona: "¿Quién es?",
  organizacion: "¿Qué es?",
  lugar: "¿Dónde queda?",
  fecha: "¿Cuándo?",
  numero: "¿Cuánto?",
  otro: "¿Qué es?",
};

const MAX_ENTITIES = 40;
const CAP_WORD = "\\p{Lu}[\\p{Ll}\\p{Lu}]+";
const CAP_SEQ = new RegExp(`${CAP_WORD}(?:\\s+(?:(?:de|del|de la|de los|y)\\s+)?${CAP_WORD})*`, "gu");
const LEADING_STOP = /^(?:El|La|Los|Las|Un|Una|Unos|Unas|Según|En|De|Del|Al|Por|Para|Con|Su|Sus|Este|Esta|Ese|Esa)\s+/u;
const ORG_PREFIX = /^(?:Municipalidad|Asociación|Ministerio|Universidad|Gobierno|Instituto|Hospital|Banco|Empresa|Colegio|Escuela|Congreso|Policía|Fundación|Organización|Comité|Federación|Club)\b/u;
const ORG_BEFORE = /(?:colegio|escuela|universidad|empresa|club|instituto)\s+$/iu;
const PLACE_BEFORE =
  /(?:^|[^\p{L}])(?:en|desde|hacia|hasta|parque|plaza|avenida|calle|jirón|río|distrito|provincia|región|ciudad|pueblo|barrio|de)\s+$/iu;

type LlmEntity = LlmAnalysis["entidades"][number];

function guessType(texto: string, before: string): EntidadTipo {
  if (ORG_PREFIX.test(texto) || ORG_BEFORE.test(before)) return "organizacion";
  if (/^(?:San|Santa|Santo)\s/u.test(texto) || PLACE_BEFORE.test(before)) return "lugar";
  if (texto.split(/\s+/).length >= 2) return "persona";
  return "otro";
}

function sentenceContext(blocks: Bloque[], f: Fuente): string | null {
  const b = blocks.find((x) => x.id === f.bloqueId);
  const s = b && splitSentences(b.texto).find((x) => f.inicio >= x.inicio && f.inicio < x.fin);
  return s ? s.texto : null;
}

function make(blocks: Bloque[], texto: string, tipo: EntidadTipo, fuente: Fuente, contexto: string | null): Omit<Entidad, "id"> {
  const apariciones = locateAll(blocks, texto);
  return { texto, tipo, etiqueta: ETIQUETAS[tipo], contexto, fuente, apariciones: apariciones.length ? apariciones : [fuente] };
}

/** Regex-based entities: calendar dates, figures with units and capitalized sequences. */
function heuristicEntities(blocks: Bloque[]): Array<Omit<Entidad, "id">> {
  const out: Array<Omit<Entidad, "id">> = [];
  for (const b of bodyBlocks(blocks)) {
    for (const m of b.texto.matchAll(new RegExp(DATE_RE.source, "giu"))) {
      const f = { bloqueId: b.id, inicio: m.index!, fin: m.index! + m[0].length };
      out.push(make(blocks, m[0], "fecha", f, sentenceContext(blocks, f)));
    }
    const sentenceStarts = new Set(splitSentences(b.texto).map((s) => s.inicio));
    for (const m of b.texto.matchAll(CAP_SEQ)) {
      let texto = m[0];
      let inicio = m.index!;
      const atStart = sentenceStarts.has(inicio) || /[—–\-¿¡«"“(]\s*$/u.test(b.texto.slice(0, inicio));
      if (atStart) {
        const stripped = texto.replace(LEADING_STOP, "");
        inicio += texto.length - stripped.length;
        texto = stripped;
        // A lone capitalized word at the start of a sentence is usually just grammar.
        if (stripped === m[0] && !/\s/.test(texto)) continue;
      }
      if (texto.length < 3 || LEADING_STOP.test(`${texto} `) ) continue;
      const before = b.texto.slice(Math.max(0, inicio - 25), inicio);
      const f = { bloqueId: b.id, inicio, fin: inicio + texto.length };
      out.push(make(blocks, texto, guessType(texto, before), f, sentenceContext(blocks, f)));
    }
  }
  for (const c of detectFigures(blocks)) {
    if (c.unidad) out.push(make(blocks, c.texto, "numero", c.fuente, c.etiqueta));
  }
  return out;
}

function overlaps(a: Fuente, b: Fuente) {
  return a.bloqueId === b.bloqueId && a.inicio < b.fin && b.inicio < a.fin;
}

/**
 * Entities layer. LLM entities (if any) are grounded first; anything not found literally
 * is dropped. Heuristic dates/figures/names fill in where they do not overlap.
 */
export function buildEntities(blocks: Bloque[], llm: LlmEntity[] | null) {
  let descartados = 0;
  const chosen: Array<Omit<Entidad, "id">> = [];
  const seen = new Set<string>();
  const add = (e: Omit<Entidad, "id">) => {
    const key = e.texto.toLowerCase();
    if (seen.has(key) || chosen.some((c) => overlaps(c.fuente, e.fuente))) return;
    if (!verify(blocks, { texto: e.texto, fuente: e.fuente })) return;
    seen.add(key);
    chosen.push(e);
  };

  for (const item of llm ?? []) {
    const c = locate(blocks, item.texto);
    if (!c) {
      descartados++;
      continue;
    }
    add(make(blocks, c.texto, item.tipo, c.fuente, item.contexto.trim() || sentenceContext(blocks, c.fuente)));
  }
  for (const e of heuristicEntities(blocks)) {
    // With an LLM, only add the unambiguous regex types (dates and figures).
    if (llm && e.tipo !== "fecha" && e.tipo !== "numero") continue;
    add(e);
  }
  const items: Entidad[] = chosen.slice(0, MAX_ENTITIES).map((e, i) => ({ id: `e${i}`, ...e }));
  return { items, descartados };
}
