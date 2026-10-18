import { z } from "zod";
import { bodyBlocks } from "../blocks.ts";
import { CitaSchema } from "../schemas.ts";
import { splitSentences } from "../text.ts";
import type { LayoutDef } from "./types.ts";

export const PiramideSchema = z.object({
  /** The renderer shows `capas.cincoW` as a prominent header. */
  encabezado: z.literal("cincoW"),
  lead: CitaSchema.nullable(),
  niveles: z.array(
    z.object({
      importancia: z.union([z.literal(1), z.literal(2), z.literal(3)]),
      etiqueta: z.string(),
      bloqueIds: z.array(z.string()),
    }),
  ),
});
export type PiramideData = z.infer<typeof PiramideSchema>;

const ETIQUETAS = { 1: "Lo esencial", 2: "Detalles importantes", 3: "Contexto y más datos" } as const;

/** Inverted pyramid: the first paragraph is the core, the next two add detail, the rest is context. */
export const piramide: LayoutDef<PiramideData> = {
  id: "piramide",
  nombre: "Pirámide invertida",
  descripcion: "Primero las 5 preguntas clave (qué, quién, cuándo, dónde, por qué) y luego los bloques de más a menos importantes.",
  generos: ["informativa"],
  schema: PiramideSchema,
  build({ blocks }) {
    const body = bodyBlocks(blocks);
    const levels = [
      { importancia: 1 as const, ids: body.slice(0, 1) },
      { importancia: 2 as const, ids: body.slice(1, 3) },
      { importancia: 3 as const, ids: body.slice(3) },
    ];
    const first = body[0];
    const s = first ? splitSentences(first.texto)[0] : undefined;
    return {
      data: {
        encabezado: "cincoW",
        lead: first && s ? { texto: s.texto, fuente: { bloqueId: first.id, inicio: s.inicio, fin: s.fin } } : null,
        niveles: levels
          .filter((l) => l.ids.length > 0)
          .map((l) => ({ importancia: l.importancia, etiqueta: ETIQUETAS[l.importancia], bloqueIds: l.ids.map((b) => b.id) })),
      },
      descartados: 0,
    };
  },
};
