import { describe, expect, it } from "vitest";
import { acumularMetricas, emocionDesdeEstimacion, metricasDeVoz, resumenEmociones, type EmocionRespuesta } from "./voz-quiz";

describe("quiz voice metrics from timed ASR words", () => {
  it("counts words, pauses longer than 2 s and observed seconds", () => {
    const words = [
      { word: "creo", start: 0.2, end: 0.5 }, { word: "que", start: 0.6, end: 0.8 },
      { word: "eh", start: 3.2, end: 3.4 }, { word: "sí", start: 3.6, end: 3.9 },
    ];
    expect(metricasDeVoz(words, 8)).toEqual({ respuestas: 1, palabras: 4, pausasLargas: 1, segundosHablando: 8 });
  });
  it("returns null without observable words, never inventing metrics", () => {
    expect(metricasDeVoz([], 8)).toBeNull();
    expect(metricasDeVoz(undefined, 8)).toBeNull();
  });
  it("adds metrics across answers", () => {
    const a = { respuestas: 1, palabras: 4, pausasLargas: 1, segundosHablando: 8 };
    expect(acumularMetricas(null, a)).toEqual(a);
    expect(acumularMetricas(a, a)).toEqual({ respuestas: 2, palabras: 8, pausasLargas: 2, segundosHablando: 16 });
  });
});

describe("experimental emotion entries", () => {
  it("keeps only the model label, confidence and source", () => {
    expect(emocionDesdeEstimacion("p1", { label: "contento/a", confidence: "media", source: "voz-emotion2vec", score: 0.71, activation: null, experimental: true }))
      .toEqual({ pasoId: "p1", etiqueta: "contento/a", confianza: "media", fuente: "voz-emotion2vec", score: 0.71 });
  });
  it("summarizes model estimates only and ignores unavailable ones", () => {
    const lista: EmocionRespuesta[] = [
      { pasoId: "a", etiqueta: "neutral", confianza: "baja", fuente: "voz-emotion2vec", score: 0.4 },
      { pasoId: "b", etiqueta: "neutral", confianza: "media", fuente: "voz-emotion2vec", score: 0.7 },
      { pasoId: "c", etiqueta: "triste", confianza: "baja", fuente: "voz-emotion2vec", score: 0.3 },
      { pasoId: "d", etiqueta: "sin datos suficientes", confianza: "baja", fuente: "sin-modelo", score: null },
    ];
    expect(resumenEmociones(lista)).toEqual({ estimadas: 3, sinModelo: 1, etiquetas: [["neutral", 2], ["triste", 1]] });
    expect(resumenEmociones(undefined)).toEqual({ estimadas: 0, sinModelo: 0, etiquetas: [] });
  });
});
