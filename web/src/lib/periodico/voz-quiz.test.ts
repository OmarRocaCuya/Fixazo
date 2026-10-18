import { describe, expect, it } from "vitest";
import { acumularMetricas, emocionDesdeEstimacion, metricasDeVoz, resumenEmociones, elegirOpcion, Segmentador, type EmocionRespuesta } from "./voz-quiz";

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

const opciones = ["Integran la IA en la evaluación como parte del examen.", "Esquivan la IA con exámenes orales, manuscritos o prácticos.", "Compran detectores de radiofrecuencia para todas las pruebas."];

describe("elegirOpcion", () => {
  it("entiende 'la primera', 'la segunda', 'la c'", () => {
    expect(elegirOpcion("la segunda", opciones).indice).toBe(1);
    expect(elegirOpcion("creo que la primera", opciones).indice).toBe(0);
    expect(elegirOpcion("la c", opciones).indice).toBe(2);
  });

  it("elige por parecido aunque el ASR se equivoque en algunas palabras", () => {
    expect(elegirOpcion("esquiban la ia con examenes orales", opciones).indice).toBe(1);
    expect(elegirOpcion("compran detectore de radiofrecuensia", opciones).indice).toBe(2);
  });

  it("si no está claro, no adivina", () => {
    expect(elegirOpcion("no sé", opciones).indice).toBeNull();
    expect(elegirOpcion("", opciones).indice).toBeNull();
    expect(elegirOpcion("a la IA", opciones).indice).toBeNull(); // "a" suelta no es la opción A
  });
});

describe("Segmentador", () => {
  const cuadros = (desde: number, hasta: number, voiced: boolean) => Array.from({ length: (hasta - desde) / 50 }, (_, k) => ({ t: desde + k * 50, voiced }));

  it("corta tras una pausa después de hablar, no antes", () => {
    const s = new Segmentador(700, 8000);
    const r = [...cuadros(0, 1000, false), ...cuadros(1000, 2500, true), ...cuadros(2500, 3400, false)].map((f) => s.push(f));
    const k = r.indexOf("cortar");
    expect(k).toBeGreaterThan(0);
    expect(k * 50).toBeGreaterThanOrEqual(2500 + 700 - 50);
  });

  it("corta a los 8 segundos aunque no haya pausa", () => {
    const s = new Segmentador(700, 8000);
    const r = cuadros(0, 9000, true).map((f) => s.push(f));
    expect(r.indexOf("cortar") * 50).toBe(8000);
  });

  it("el ruido corto no cuenta como haber hablado", () => {
    const s = new Segmentador(700, 8000, 250);
    const r = [...cuadros(0, 100, true), ...cuadros(100, 1200, false)].map((f) => s.push(f));
    expect(r).not.toContain("cortar");
  });
});
