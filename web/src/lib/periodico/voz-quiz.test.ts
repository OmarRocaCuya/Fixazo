import { describe, expect, it } from "vitest";
import { elegirOpcion, Segmentador } from "./voz-quiz";

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
