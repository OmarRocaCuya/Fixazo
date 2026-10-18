// Voice-derived data from quiz answers: pure helpers, no browser APIs.
// Emotion entries are EXPERIMENTAL emotion2vec+ estimates from the audio only;
// a "sin-modelo" entry records that no inference happened, never a guess.
import type { AffectConfidence, AffectEstimate, AffectLabel, AffectSource } from "@/lib/signals/affect";

/** Same threshold as the /chat reading analysis ("Pausas largas (> 2 s)"). */
export const PAUSA_LARGA_S = 2;

export interface MetricasVoz {
  respuestas: number;
  palabras: number;
  pausasLargas: number;
  segundosHablando: number;
}

export interface EmocionRespuesta {
  pasoId: string;
  etiqueta: AffectLabel;
  confianza: AffectConfidence;
  fuente: AffectSource;
  score: number | null;
}

export function metricasDeVoz(words: ReadonlyArray<{ start: number; end: number }> | undefined, durationSeconds: number): MetricasVoz | null {
  if (!words?.length) return null;
  let pausasLargas = 0;
  for (let i = 1; i < words.length; i++) if (words[i].start - words[i - 1].end > PAUSA_LARGA_S) pausasLargas++;
  const segundos = Number.isFinite(durationSeconds) && durationSeconds > 0 ? Math.round(durationSeconds * 10) / 10 : 0;
  return { respuestas: 1, palabras: words.length, pausasLargas, segundosHablando: segundos };
}

export function acumularMetricas(previas: MetricasVoz | null | undefined, nuevas: MetricasVoz): MetricasVoz {
  if (!previas) return { ...nuevas };
  return {
    respuestas: previas.respuestas + nuevas.respuestas,
    palabras: previas.palabras + nuevas.palabras,
    pausasLargas: previas.pausasLargas + nuevas.pausasLargas,
    segundosHablando: Math.round((previas.segundosHablando + nuevas.segundosHablando) * 10) / 10,
  };
}

export function emocionDesdeEstimacion(pasoId: string, e: AffectEstimate): EmocionRespuesta {
  return { pasoId, etiqueta: e.label, confianza: e.confidence, fuente: e.source, score: e.score };
}

export function resumenEmociones(lista: EmocionRespuesta[] | undefined): { estimadas: number; sinModelo: number; etiquetas: Array<[AffectLabel, number]> } {
  const modelo = (lista ?? []).filter((e) => e.fuente === "voz-emotion2vec");
  const cuenta = new Map<AffectLabel, number>();
  for (const e of modelo) cuenta.set(e.etiqueta, (cuenta.get(e.etiqueta) ?? 0) + 1);
  return {
    estimadas: modelo.length,
    sinModelo: (lista ?? []).length - modelo.length,
    etiquetas: [...cuenta].sort((a, b) => b[1] - a[1]),
  };
}
