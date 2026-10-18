import { z } from "zod";
import { bodyBlocks } from "../blocks.ts";
import { locate } from "../guards/grounding.ts";
import { CitaSchema } from "../schemas.ts";
import type { Cita } from "../types.ts";
import type { LayoutDef } from "./types.ts";

const RolSchema = z.enum(["entrevistador", "entrevistado"]);

export const DialogoSchema = z.object({
  turnos: z.array(z.object({ id: z.string(), rol: RolSchema, hablante: z.string(), cita: CitaSchema })),
});
export type DialogoData = z.infer<typeof DialogoSchema>;

const MARKER = /^\s*(?:[—–-]\s*|(P|R|Pregunta|Respuesta)\s*[:.]\s*)/u;
const DEFAULT_SPEAKER = { entrevistador: "Periodista", entrevistado: "Entrevistado/a" } as const;

export const dialogo: LayoutDef<DialogoData> = {
  id: "dialogo",
  nombre: "Diálogo",
  descripcion: "Preguntas y respuestas como una conversación de chat, con el nombre de quien habla.",
  generos: ["entrevista"],
  schema: DialogoSchema,
  build({ blocks, analysis }) {
    const body = bodyBlocks(blocks);
    let descartados = 0;
    const llmTurns: DialogoData["turnos"] = [];
    for (const t of analysis?.turnos ?? []) {
      const cita = locate(body, t.cita);
      if (!cita) {
        descartados++;
        continue;
      }
      llmTurns.push({ id: `tu${llmTurns.length}`, rol: t.rol, hablante: t.hablante.trim() || DEFAULT_SPEAKER[t.rol], cita });
    }
    if (llmTurns.length) return { data: { turnos: llmTurns }, descartados };

    // Heuristic: each paragraph is a turn; strip the dash / "P:" marker from the quote.
    const turnos = body.map((b, i) => {
      const m = MARKER.exec(b.texto);
      const inicio = m ? m[0].length : 0;
      const label = m?.[1]?.toUpperCase();
      const rol: "entrevistador" | "entrevistado" =
        label === "P" || label === "PREGUNTA"
          ? "entrevistador"
          : label === "R" || label === "RESPUESTA"
            ? "entrevistado"
            : b.texto.trimEnd().endsWith("?")
              ? "entrevistador"
              : "entrevistado";
      const cita: Cita = { texto: b.texto.slice(inicio), fuente: { bloqueId: b.id, inicio, fin: b.texto.length } };
      return { id: `tu${i}`, rol, hablante: DEFAULT_SPEAKER[rol], cita };
    });
    return { data: { turnos }, descartados };
  },
};
