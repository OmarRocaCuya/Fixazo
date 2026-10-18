import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { guardarResultado, leerResultados, registrarVozQuiz, type ResultadoNoticia } from "./progreso";
import { deletePeriodicoData, exportPeriodicoData } from "./privacidad";

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() { return this.data.size; }
  clear() { this.data.clear(); }
  getItem(key: string) { return this.data.get(key) ?? null; }
  key(index: number) { return [...this.data.keys()][index] ?? null; }
  removeItem(key: string) { this.data.delete(key); }
  setItem(key: string, value: string) { this.data.set(key, String(value)); }
}

const base: ResultadoNoticia = { noticiaId: "n1", titular: "Titular", fecha: "2026-10-18T00:00:00.000Z", habilidades: {}, postura: null, seguridad: null, decision: null, voz: null, enCurso: true };
let storage: MemoryStorage;
beforeEach(() => { storage = new MemoryStorage(); vi.stubGlobal("localStorage", storage); vi.stubGlobal("window", { localStorage: storage }); });
afterEach(() => { vi.unstubAllGlobals(); });

describe("local quiz voice data", () => {
  it("records emotion estimates and voice metrics locally, creating an in-progress entry if needed", () => {
    registrarVozQuiz("n1", "Titular", { emocion: { pasoId: "p1", etiqueta: "neutral", confianza: "baja", fuente: "voz-emotion2vec", score: 0.42 } });
    registrarVozQuiz("n1", "Titular", { metricas: { respuestas: 1, palabras: 5, pausasLargas: 1, segundosHablando: 8 } });
    registrarVozQuiz("n1", "Titular", { metricas: { respuestas: 1, palabras: 3, pausasLargas: 0, segundosHablando: 8 } });
    const r = leerResultados().n1;
    expect(r.enCurso).toBe(true);
    expect(r.emociones).toEqual([{ pasoId: "p1", etiqueta: "neutral", confianza: "baja", fuente: "voz-emotion2vec", score: 0.42 }]);
    expect(r.audioQuiz).toEqual({ respuestas: 2, palabras: 8, pausasLargas: 1, segundosHablando: 16 });
  });
  it("keeps voice data when a later partial or final result is saved without it", () => {
    registrarVozQuiz("n1", "Titular", { emocion: { pasoId: "p1", etiqueta: "triste", confianza: "baja", fuente: "voz-emotion2vec", score: 0.3 } });
    guardarResultado({ ...base, enCurso: false });
    expect(leerResultados().n1.emociones).toHaveLength(1);
    expect(leerResultados().n1.enCurso).toBe(false);
  });
  it("is included in the export and removed by delete-all", () => {
    registrarVozQuiz("n1", "Titular", { emocion: { pasoId: "p1", etiqueta: "contento/a", confianza: "media", fuente: "voz-emotion2vec", score: 0.8 } });
    const exported = exportPeriodicoData(storage).records["fixazo:resultados"] as Record<string, ResultadoNoticia>;
    expect(exported.n1.emociones?.[0].etiqueta).toBe("contento/a");
    deletePeriodicoData(storage);
    expect(leerResultados()).toEqual({});
  });
});
