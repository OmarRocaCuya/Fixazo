import { z } from "zod";
import { bodyBlocks } from "../blocks.ts";
import { locate } from "../guards/grounding.ts";
import { CitaSchema } from "../schemas.ts";
import { CLOCK_RE, DATE_RE, splitSentences } from "../text.ts";
import type { Bloque, Cita } from "../types.ts";
import type { LayoutDef } from "./types.ts";

export const TimelineSchema = z.object({
  eventos: z.array(
    z.object({
      id: z.string(),
      /** Literal time expression ("A las 8:30", "2 de marzo de 2026") or null. */
      ancla: CitaSchema.nullable(),
      resumen: CitaSchema,
      /** Body blocks narrated under this event, in reading order. */
      bloqueIds: z.array(z.string()),
    }),
  ),
});
export type TimelineData = z.infer<typeof TimelineSchema>;

function anchorIn(b: Bloque): Cita | null {
  const first = splitSentences(b.texto)[0];
  const limit = first ? first.fin : b.texto.length;
  let best: RegExpExecArray | null = null;
  for (const re of [CLOCK_RE, DATE_RE]) {
    const m = new RegExp(re.source, "iu").exec(b.texto);
    if (m && m.index < limit && (!best || m.index < best.index)) best = m;
  }
  return best ? { texto: best[0], fuente: { bloqueId: b.id, inicio: best.index, fin: best.index + best[0].length } } : null;
}

function firstSentence(b: Bloque): Cita {
  const s = splitSentences(b.texto)[0] ?? { texto: b.texto, inicio: 0, fin: b.texto.length };
  return { texto: s.texto, fuente: { bloqueId: b.id, inicio: s.inicio, fin: s.fin } };
}

export const timeline: LayoutDef<TimelineData> = {
  id: "timeline",
  nombre: "Línea de tiempo",
  descripcion: "Los hechos en orden, cada uno con su momento y el texto que lo cuenta.",
  generos: ["cronica"],
  schema: TimelineSchema,
  build({ blocks, analysis }) {
    const body = bodyBlocks(blocks);
    let descartados = 0;

    // LLM events: ground the quote, attach following blocks until the next event.
    const llmEvents: Array<{ ancla: Cita | null; resumen: Cita }> = [];
    for (const ev of analysis?.eventos ?? []) {
      const resumen = locate(body, ev.cita);
      if (!resumen) {
        descartados++;
        continue;
      }
      const ancla = ev.ancla ? locate(body, ev.ancla, { bloqueIds: [resumen.fuente.bloqueId] }) : null;
      if (ev.ancla && !ancla) descartados++;
      llmEvents.push({ ancla, resumen });
    }

    const starts =
      llmEvents.length > 0
        ? llmEvents
        : body.map((b) => ({ ancla: anchorIn(b), resumen: firstSentence(b) }));
    const order = new Map(body.map((b, i) => [b.id, i]));
    starts.sort((a, b) => order.get(a.resumen.fuente.bloqueId)! - order.get(b.resumen.fuente.bloqueId)!);

    const eventos = starts.map((s, i) => ({ id: `ev${i}`, ...s, bloqueIds: [] as string[] }));
    for (const b of body) {
      const idx = order.get(b.id)!;
      let owner = eventos[0]!;
      for (const e of eventos) if (order.get(e.resumen.fuente.bloqueId)! <= idx) owner = e;
      owner.bloqueIds.push(b.id);
    }
    return { data: { eventos }, descartados };
  },
};
