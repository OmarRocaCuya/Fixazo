import { z } from "zod";
import { bodyBlocks } from "../blocks.ts";
import { detectFigures } from "../layers/visuals.ts";
import { CifraSchema, VisualesSchema } from "../schemas.ts";
import type { LayoutDef } from "./types.ts";

export const DatosSchema = z.object({
  /** Big stat cards (literal figures with a unit). */
  destacadas: z.array(CifraSchema),
  /** Mini bar charts: same shape as `capas.visuales.cifras`. */
  graficos: VisualesSchema.shape.cifras,
  bloqueIds: z.array(z.string()),
});
export type DatosData = z.infer<typeof DatosSchema>;

const MAX_CARDS = 4;

export const datos: LayoutDef<DatosData> = {
  id: "datos",
  nombre: "Datos",
  descripcion: "Las cifras clave en tarjetas grandes, con barras para comparar números de la misma unidad.",
  generos: ["datos"],
  schema: DatosSchema,
  build({ blocks, visuales }) {
    const destacadas = detectFigures(blocks)
      .filter((c) => c.unidad)
      .slice(0, MAX_CARDS);
    return {
      data: { destacadas, graficos: visuales.cifras, bloqueIds: bodyBlocks(blocks).map((b) => b.id) },
      descartados: 0,
    };
  },
};
