// Lee las noticias que deja el pipeline (pipeline/correr.mjs) en data/ediciones/<día>/<hora>-<slug>.json.
// Solo para el servidor: contiene los criterios privados. Al navegador va noticiaPublica().
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Noticia, NoticiaPublica, PasoPublico, PreguntaVoz } from "./tipos";

/** En un servidor propio (por ejemplo Hetzner) se puede apuntar a otra carpeta con EDICIONES_DIR. */
const DIR = process.env.EDICIONES_DIR ?? join(process.cwd(), "data", "ediciones");

export interface NoticiaGuardada extends Noticia {
  creada: string;
  orden?: number;
  fuentes: Array<{ medio: string; fecha: string; titular: string; url: string }>;
}

interface Registro {
  id: string;
  creada: string;
  orden?: number;
  /** "reservada": generada de antemano por el mismo pipeline para la demo; no sale en la portada hasta que se revela. */
  estado: "publicada" | "reservada" | "rechazada" | "retirada";
  fuentes: NoticiaGuardada["fuentes"];
  noticia: Noticia | null;
}

// Dynamic operator paths opt out of automatic broad tracing; next.config.ts
// explicitly includes only data/ediciones/**/*.json for deployed functions.
/** Noticias publicadas, de la más nueva a la más antigua. */
export const noticiasPublicadas = () => leer(["publicada"]);
/** Noticias reservadas para el botón de demo, en el orden en que se revelan (campo "orden" del JSON). */
export const noticiasReservadas = async () => (await leer(["reservada"])).sort((a, b) => (a.orden ?? 99) - (b.orden ?? 99));

async function leer(estados: Registro["estado"][]): Promise<NoticiaGuardada[]> {
  let dias: string[] = [];
  try {
    dias = (await readdir(/* turbopackIgnore: true */ DIR, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name);
  } catch {
    return [];
  }
  const registros: Registro[] = [];
  for (const dia of dias) {
    for (const f of await readdir(/* turbopackIgnore: true */ join(/* turbopackIgnore: true */ DIR, dia))) {
      if (!f.endsWith(".json")) continue;
      try {
        registros.push(JSON.parse(await readFile(/* turbopackIgnore: true */ join(/* turbopackIgnore: true */ DIR, dia, f), "utf8")));
      } catch {
        /* un archivo a medio escribir no tumba la portada */
      }
    }
  }
  return registros
    .filter((r): r is Registro & { noticia: Noticia } => estados.includes(r.estado) && r.noticia !== null)
    .map((r) => ({ ...r.noticia, creada: r.creada, orden: r.orden, fuentes: r.fuentes }))
    .sort((a, b) => b.creada.localeCompare(a.creada));
}

export async function buscarNoticia(id: string): Promise<NoticiaGuardada | null> {
  return (await leer(["publicada", "reservada"])).find((n) => n.id === id) ?? null;
}

export async function buscarPreguntaVoz(noticiaId: string, preguntaId: string): Promise<{ noticia: NoticiaGuardada; pregunta: PreguntaVoz } | null> {
  const noticia = await buscarNoticia(noticiaId);
  const pregunta = noticia?.pasos.find((p): p is PreguntaVoz => p.tipo === "voz" && p.id === preguntaId);
  return noticia && pregunta ? { noticia, pregunta } : null;
}

const sinPrivado = (p: Noticia["pasos"][number]): PasoPublico => {
  if (p.tipo !== "voz") return p;
  const { privado, ...publica } = p;
  void privado; // se descarta a propósito: no viaja al navegador
  return publica;
};

/** Lo que viaja al navegador: sin criterios, respuesta modelo ni frases prohibidas. */
export function noticiaPublica<T extends Noticia>(n: T): Omit<T, "pasos"> & NoticiaPublica {
  return { ...n, pasos: n.pasos.map(sinPrivado) };
}
