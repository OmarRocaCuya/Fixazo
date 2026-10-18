"use client";
// Progreso del joven, guardado solo en este navegador (sin cuenta), como el resto de la app.
// ponytail: localStorage; pasar a servidor si se agregan cuentas.

export interface ResultadoNoticia {
  noticiaId: string;
  titular: string;
  fecha: string;
  /** Habilidad → acertó o no (preguntas con respuesta esperada). */
  habilidades: Record<string, boolean>;
  postura: string | null;
  seguridad: string | null;
  decision: string | null;
  voz: {
    listo: boolean;
    intentos: number;
    criterios: Array<{ nombre: string; cumple: boolean }>;
    /** Señales de proceso de la capa de voz de Daniel: describen cómo lo dijo, nunca son nota. */
    dudas: string[];
    muletillas: string[];
    pausasLargas: number | null;
    segundosHablando: number | null;
    porVoz: boolean;
  } | null;
}

const CLAVE = "fixazo:resultados";

export function leerResultados(): Record<string, ResultadoNoticia> {
  try {
    return JSON.parse(localStorage.getItem(CLAVE) ?? "{}");
  } catch {
    return {};
  }
}

export function guardarResultado(r: ResultadoNoticia) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify({ ...leerResultados(), [r.noticiaId]: r }));
  } catch {
    /* sin almacenamiento la noticia funciona igual; solo no queda en Mis insights */
  }
}

export function idAlumno(): string {
  try {
    let id = localStorage.getItem("fixazo:alumno");
    if (!id) {
      id = Math.random().toString(36).slice(2, 10);
      localStorage.setItem("fixazo:alumno", id);
    }
    return id;
  } catch {
    return "sin-id";
  }
}
