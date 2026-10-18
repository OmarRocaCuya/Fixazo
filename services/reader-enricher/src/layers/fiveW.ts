import { bodyBlocks } from "../blocks.ts";
import { locate } from "../guards/grounding.ts";
import { splitSentences } from "../text.ts";
import type { Bloque, CincoW, Cita, Entidad, LlmAnalysis } from "../types.ts";

const KEYS = ["que", "quien", "cuando", "donde", "porque"] as const;
const CAUSE_MARKERS = ["porque", "ya que", "debido a", "a causa de", "para que"];

function cita(blocks: Bloque[], text: string | null | undefined): Cita | null {
  return text ? locate(blocks, text) : null;
}

/** Literal clause after a causal marker, up to the end of its sentence. */
function causeClause(blocks: Bloque[]): Cita | null {
  for (const marker of CAUSE_MARKERS) {
    for (const b of bodyBlocks(blocks)) {
      const m = new RegExp(`\\b${marker}\\s+`, "iu").exec(b.texto);
      if (!m) continue;
      const start = m.index + m[0].length;
      const s = splitSentences(b.texto).find((x) => start >= x.inicio && start < x.fin);
      const end = s ? s.fin - (/[.!?…]$/.test(s.texto) ? 1 : 0) : b.texto.length;
      if (end > start) return { texto: b.texto.slice(start, end), fuente: { bloqueId: b.id, inicio: start, fin: end } };
    }
  }
  return null;
}

function fromEntity(entidades: Entidad[], tipos: string[]): Cita | null {
  const e = entidades.find((x) => tipos.includes(x.tipo));
  return e ? { texto: e.texto, fuente: e.fuente } : null;
}

/**
 * 5W layer. LLM answers must be literal quotes or they become null.
 * Without LLM: lead sentence, first person/org, first date, first place, causal clause.
 */
export function buildFiveW(blocks: Bloque[], llm: LlmAnalysis["cincoW"] | null, entidades: Entidad[]) {
  let descartados = 0;
  if (llm) {
    const out = {} as CincoW;
    for (const k of KEYS) {
      out[k] = cita(blocks, llm[k]);
      if (llm[k] && !out[k]) descartados++;
    }
    return { cincoW: out, descartados };
  }
  const lead = bodyBlocks(blocks)[0];
  const first = lead ? splitSentences(lead.texto)[0] : undefined;
  const cincoW: CincoW = {
    que: lead && first ? { texto: first.texto, fuente: { bloqueId: lead.id, inicio: first.inicio, fin: first.fin } } : null,
    quien: fromEntity(entidades, ["persona", "organizacion"]),
    cuando: fromEntity(entidades, ["fecha"]),
    donde: fromEntity(entidades, ["lugar"]),
    porque: causeClause(blocks),
  };
  return { cincoW, descartados };
}
