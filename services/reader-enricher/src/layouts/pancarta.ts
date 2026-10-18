import { z } from "zod";
import { bodyBlocks } from "../blocks.ts";
import { groundAll, locate } from "../guards/grounding.ts";
import { CitaSchema } from "../schemas.ts";
import { splitSentences } from "../text.ts";
import type { Bloque, Cita } from "../types.ts";
import type { LayoutDef } from "./types.ts";

export const PancartaSchema = z.object({
  /** Big banner statement. */
  tesis: CitaSchema,
  argumentos: z.array(z.object({ id: z.string(), cita: CitaSchema })),
  /** Highlighted literal quotes. */
  citas: z.array(CitaSchema),
  bloqueIds: z.array(z.string()),
});
export type PancartaData = z.infer<typeof PancartaSchema>;

const OPINION = /\b(?:creo que|en mi opinión|a mi juicio|considero|pienso que|opino|debemos|es necesario|es un error|hay que)\b/iu;
const QUOTE_RE = /[«“"]([^«»“”"]{6,300})[»”"]/gu;

function sentenceCita(b: Bloque, s: { texto: string; inicio: number; fin: number }): Cita {
  return { texto: s.texto, fuente: { bloqueId: b.id, inicio: s.inicio, fin: s.fin } };
}

function heuristicThesis(blocks: Bloque[]): Cita {
  for (const b of bodyBlocks(blocks)) {
    const s = splitSentences(b.texto).find((x) => OPINION.test(x.texto));
    if (s) return sentenceCita(b, s);
  }
  const h = blocks[0]!;
  return { texto: h.texto, fuente: { bloqueId: h.id, inicio: 0, fin: h.texto.length } };
}

function quotesIn(blocks: Bloque[]): Cita[] {
  return bodyBlocks(blocks).flatMap((b) =>
    [...b.texto.matchAll(QUOTE_RE)].map((m) => {
      const inicio = m.index! + 1;
      return { texto: m[1]!, fuente: { bloqueId: b.id, inicio, fin: inicio + m[1]!.length } };
    }),
  );
}

export const pancarta: LayoutDef<PancartaData> = {
  id: "pancarta",
  nombre: "Pancarta",
  descripcion: "La idea principal en grande, los argumentos en tarjetas y las frases clave destacadas.",
  generos: ["opinion"],
  schema: PancartaSchema,
  build({ blocks, analysis }) {
    let descartados = 0;
    const body = bodyBlocks(blocks);
    let tesis: Cita | null = null;
    if (analysis?.tesis) {
      tesis = locate(blocks, analysis.tesis);
      if (!tesis) descartados++;
    }
    tesis ??= heuristicThesis(blocks);

    const llmArgs = groundAll(body, analysis?.argumentos ?? []);
    const llmQuotes = groundAll(body, analysis?.citasClave ?? []);
    descartados += llmArgs.descartados + llmQuotes.descartados;

    let args = llmArgs.citas;
    if (!args.length) {
      args = body
        .map((b) => {
          const s = splitSentences(b.texto).find((x) => !(b.id === tesis!.fuente.bloqueId && x.inicio <= tesis!.fuente.inicio && x.fin >= tesis!.fuente.fin));
          return s ? sentenceCita(b, s) : null;
        })
        .filter((c): c is Cita => c !== null)
        .slice(0, 5);
    }
    const citas = llmQuotes.citas.length ? llmQuotes.citas : quotesIn(blocks);
    return {
      data: {
        tesis,
        argumentos: args.map((cita, i) => ({ id: `arg${i}`, cita })),
        citas,
        bloqueIds: body.map((b) => b.id),
      },
      descartados,
    };
  },
};
