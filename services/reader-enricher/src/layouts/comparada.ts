import { z } from "zod";
import { locate } from "../guards/grounding.ts";
import { detectFigures } from "../layers/visuals.ts";
import { CitaSchema } from "../schemas.ts";
import type { Bloque, Cita } from "../types.ts";
import type { LayoutDef } from "./types.ts";

export const ComparadaSchema = z.object({
  columnas: z.array(
    z.object({
      lado: z.enum(["a", "b"]),
      medio: z.string().nullable(),
      titular: CitaSchema.nullable(),
      bloqueIds: z.array(z.string()),
    }),
  ),
  puntos: z.array(
    z.object({
      id: z.string(),
      tema: z.string(),
      a: CitaSchema.nullable(),
      b: CitaSchema.nullable(),
      relacion: z.enum(["coincide", "difiere"]),
    }),
  ),
});
export type ComparadaData = z.infer<typeof ComparadaSchema>;
type Punto = Omit<ComparadaData["puntos"][number], "id">;

function side(blocks: Bloque[], lado: "a" | "b") {
  return blocks.filter((b) => b.lado === lado);
}

/** Heuristic matching: same figures/unit across sides, and capitalized names mentioned by both. */
function heuristicPoints(blocks: Bloque[], a: Bloque[], b: Bloque[]): Punto[] {
  const puntos: Punto[] = [];
  const figs = detectFigures(blocks).filter((c) => c.unidad);
  const inSide = (ids: Bloque[]) => new Set(ids.map((x) => x.id));
  const aIds = inSide(a);
  const bIds = inSide(b);
  const fa = figs.filter((c) => aIds.has(c.fuente.bloqueId));
  const fb = figs.filter((c) => bIds.has(c.fuente.bloqueId));
  const units = new Set(fa.map((c) => c.unidad).filter((u) => fb.some((c) => c.unidad === u)));
  for (const u of units) {
    const ua = fa.filter((c) => c.unidad === u);
    const ub = fb.filter((c) => c.unidad === u);
    const shared = ua.find((x) => ub.some((y) => y.valor === x.valor));
    if (shared) {
      const other = ub.find((y) => y.valor === shared.valor)!;
      puntos.push({ tema: shared.texto, a: cut(shared), b: cut(other), relacion: "coincide" });
    }
    const diffB = ub.find((y) => !ua.some((x) => x.valor === y.valor));
    if (diffB) puntos.push({ tema: `Cifra en ${u}`, a: cut(ua[0]!), b: cut(diffB), relacion: "difiere" });
  }

  const names = (bs: Bloque[]) =>
    new Set(bs.flatMap((x) => x.texto.match(/\p{Lu}\p{Ll}+(?:\s+\p{Lu}\p{Ll}+)+/gu) ?? []));
  const nb = names(b.filter((x) => x.rol === "cuerpo"));
  for (const n of names(a.filter((x) => x.rol === "cuerpo"))) {
    if (!nb.has(n)) continue;
    const ca = locate(a, n);
    const cb = locate(b, n);
    if (ca && cb) puntos.push({ tema: n, a: ca, b: cb, relacion: "coincide" });
  }
  return puntos;
}

function cut(c: { texto: string; fuente: Cita["fuente"] }): Cita {
  return { texto: c.texto, fuente: c.fuente };
}

export const comparada: LayoutDef<ComparadaData> = {
  id: "comparada",
  nombre: "Comparada",
  descripcion: "Dos medios o voces lado a lado, con los puntos en que coinciden y en que difieren.",
  generos: ["comparada"],
  schema: ComparadaSchema,
  build({ blocks, analysis }) {
    const a = side(blocks, "a");
    const b = side(blocks, "b");
    const columna = (lado: "a" | "b", bs: Bloque[]) => {
      const t = bs.find((x) => x.rol === "titular");
      return {
        lado,
        medio: bs[0]?.medio ?? null,
        titular: t ? { texto: t.texto, fuente: { bloqueId: t.id, inicio: 0, fin: t.texto.length } } : null,
        bloqueIds: bs.filter((x) => x.rol === "cuerpo").map((x) => x.id),
      };
    };

    let descartados = 0;
    const llmPoints: Punto[] = [];
    for (const p of analysis?.puntos ?? []) {
      const ca = p.citaA ? locate(a, p.citaA) : null;
      const cb = p.citaB ? locate(b, p.citaB) : null;
      const failed = (p.citaA && !ca) || (p.citaB && !cb) || (!ca && !cb);
      if (failed) {
        descartados++;
        continue;
      }
      llmPoints.push({ tema: p.tema, a: ca, b: cb, relacion: p.relacion });
    }
    const puntos = (llmPoints.length ? llmPoints : heuristicPoints(blocks, a, b)).map((p, i) => ({ id: `pt${i}`, ...p }));
    return { data: { columnas: [columna("a", a), columna("b", b)], puntos }, descartados };
  },
};
