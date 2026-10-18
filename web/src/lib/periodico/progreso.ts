"use client";
// Progreso del joven, guardado solo en este navegador (sin cuenta), como el resto de la app.
// ponytail: localStorage; pasar a servidor si se agregan cuentas.

import type { ProtocoloNoticia } from "./tipos";
import { acumularMetricas, type EmocionRespuesta, type MetricasVoz } from "./voz-quiz";

export interface ResultadoNoticia {
  protocolo?: ProtocoloNoticia;
  noticiaId: string;
  /** true mientras la noticia está a medio responder. */
  enCurso?: boolean;
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
  /** EXPERIMENTAL: emotion2vec+ estimates per voice answer (audio only, never graded). */
  emociones?: EmocionRespuesta[];
  /** Words, long pauses and seconds observed by timed ASR across quiz voice answers. */
  audioQuiz?: MetricasVoz;
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
    const previo = leerResultados()[r.noticiaId];
    // Voice data arrives asynchronously; a later save without it must not erase it.
    const merged: ResultadoNoticia = { ...r, emociones: r.emociones ?? previo?.emociones, audioQuiz: r.audioQuiz ?? previo?.audioQuiz };
    if (!merged.emociones) delete merged.emociones;
    if (!merged.audioQuiz) delete merged.audioQuiz;
    localStorage.setItem(CLAVE, JSON.stringify({ ...leerResultados(), [r.noticiaId]: merged }));
  } catch {
    /* sin almacenamiento la noticia funciona igual; solo no queda en Mis insights */
  }
}

/** Adds one quiz voice observation to this browser's record (export/delete-all cover it). */
export function registrarVozQuiz(noticiaId: string, titular: string, dato: { emocion?: EmocionRespuesta; metricas?: MetricasVoz }) {
  const previo: ResultadoNoticia = leerResultados()[noticiaId] ?? {
    noticiaId, titular, enCurso: true, fecha: new Date().toISOString(), habilidades: {}, postura: null, seguridad: null, decision: null, voz: null,
  };
  guardarResultado({
    ...previo,
    emociones: dato.emocion ? [...(previo.emociones ?? []), dato.emocion].slice(-24) : previo.emociones,
    audioQuiz: dato.metricas ? acumularMetricas(previo.audioQuiz, dato.metricas) : previo.audioQuiz,
  });
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

/** Avance a medio camino: dónde se quedó y qué eligió, para volver al mismo lugar. */
export interface Avance {
  inicialesDesconocidas?: string[];
  intentosOpciones?: Record<string, number[]>;
  hasta: number;
  elegidas: Record<string, number>;
}

export function leerAvance(id: string): Avance | null {
  try {
    return JSON.parse(localStorage.getItem(`fixazo:avance:${id}`) ?? "null");
  } catch {
    return null;
  }
}

export function guardarAvance(id: string, a: Avance) {
  try {
    localStorage.setItem(`fixazo:avance:${id}`, JSON.stringify(a));
  } catch {
    /* sin almacenamiento no se recuerda el lugar */
  }
}

/** Avisa a otras pestañas (Mis insights) que cambió el progreso. */
export function suscribirProgreso(cb: () => void): () => void {
  const f = (e: StorageEvent) => e.key?.startsWith("fixazo:") && cb();
  window.addEventListener("storage", f);
  return () => window.removeEventListener("storage", f);
}
