import type { Genero, LayoutId } from "../types.ts";
import { comparada } from "./comparada.ts";
import { datos } from "./datos.ts";
import { dialogo } from "./dialogo.ts";
import { pancarta } from "./pancarta.ts";
import { piramide } from "./piramide.ts";
import { timeline } from "./timeline.ts";
import type { LayoutDef } from "./types.ts";

/**
 * Layout registry. To add a genre/layout: create one file exporting a LayoutDef
 * (zod schema + builder), add its id to LAYOUT_IDS / GENEROS in schemas.ts, and list it here.
 */
export const LAYOUTS: ReadonlyArray<LayoutDef<any>> = [timeline, pancarta, piramide, datos, dialogo, comparada];

const FALLBACK: LayoutId = "piramide";

export function layoutForGenre(genero: Genero): LayoutDef<unknown> {
  return LAYOUTS.find((l) => l.generos.includes(genero)) ?? LAYOUTS.find((l) => l.id === FALLBACK)!;
}

export function catalog() {
  return LAYOUTS.map(({ id, nombre, descripcion, generos }) => ({ id, nombre, descripcion, generos }));
}
