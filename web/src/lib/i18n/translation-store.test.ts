import { afterEach, describe, expect, it, vi } from "vitest";
import { isLanguage, translationBatches, validateTranslationResponse } from "./language";
import { PublicTranslationStore, SPANISH_SNAPSHOT } from "./translation-store";
import { collectNoticiaTexts } from "./noticia";
import type { NoticiaPublica } from "@/lib/periodico/tipos";

afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

describe("global public language", () => {
  it("tracks only active blocks and reference-counts shared labels with idempotent cleanup", async () => {
    vi.useFakeTimers();
    const store = new PublicTranslationStore(async () => { throw new Error("offline"); }, { quy: { Current: "Kunan" } });
    const releaseOld = store.register(["Old"]);
    const releaseShared = store.register(["Old", "Old"]);
    store.setLanguage("quy"); await store.flush();
    expect(store.getSnapshot().translationStatus).toBe("error");
    releaseOld(); releaseOld();
    expect(store.getSnapshot().translationStatus).toBe("error");
    releaseShared(); store.register(["Current"]);
    expect(store.getSnapshot().translationStatus).toBe("ready");
    expect(store.t("Current")).toBe("Kunan");
  });
  it("does not start queued calls for unmounted blocks", async () => {
    vi.useFakeTimers();
    let complete!: (response: unknown) => void;
    const translate = vi.fn(() => new Promise((resolve) => { complete = resolve; }));
    const store = new PublicTranslationStore(translate);
    const release = store.register(Array.from({ length: 9 }, (_, index) => `Old ${index}`));
    store.setLanguage("ayr"); const pending = store.flush();
    release(); complete({ language: "ayr", texts: Array(4).fill("Qillqa") }); await pending;
    expect(translate).toHaveBeenCalledOnce();
    expect(store.getSnapshot().translationStatus).toBe("ready");
  });
  it("invalidates old queues even after switching away and back rapidly", async () => {
    vi.useFakeTimers();
    const resolvers: Array<(response: unknown) => void> = [];
    const translate = vi.fn().mockImplementationOnce(() => new Promise((resolve) => resolvers.push(resolve)))
      .mockImplementationOnce(() => new Promise((resolve) => resolvers.push(resolve)))
      .mockImplementation(async (language, texts: string[]) => ({ language, texts: texts.map(() => "Qillqa") }));
    const store = new PublicTranslationStore(translate);
    store.register(Array.from({ length: 9 }, (_, index) => `Public ${index}`));
    store.setLanguage("quy"); const pending = store.flush();
    store.setLanguage("ayr"); store.setLanguage("quy");
    resolvers.forEach((resolve) => resolve({ language: "quy", texts: Array(4).fill("Qillqa") }));
    await pending;
    expect(translate).toHaveBeenCalledTimes(2);
    await store.flush();
    expect(translate).toHaveBeenCalledTimes(3);
    expect(store.getSnapshot().translationStatus).toBe("ready");
  });
  it("uses exactly the indigenous ASR codes and rejects unknown persisted values", () => {
    expect(["es", "quy", "ayr"].every(isLanguage)).toBe(true);
    expect(isLanguage("qu" )).toBe(false);
    expect(isLanguage(null)).toBe(false);
  });

  it("switches the full registered content immediately from public seed without requests", async () => {
    vi.useFakeTimers();
    const translate = vi.fn();
    const store = new PublicTranslationStore(translate, { quy: { Titular: "Uma", Pregunta: "Tapuy" }, ayr: { Titular: "P'iqi" } });
    store.register(["Titular", "Pregunta"]);
    store.setLanguage("quy");
    expect(store.t("Titular")).toBe("Uma");
    expect(store.t("Pregunta")).toBe("Tapuy");
    expect(store.getSnapshot().translationStatus).toBe("ready");
    await store.flush();
    expect(translate).not.toHaveBeenCalled();
    store.setLanguage("es");
    expect(store.t("Titular")).toBe("Titular");
    expect(store.getServerSnapshot()).toBe(SPANISH_SNAPSHOT);
    expect(store.getSnapshot()).toBe(store.getSnapshot());
  });

  it("batches, deduplicates and caches public article and UI strings", async () => {
    vi.useFakeTimers();
    const translate = vi.fn(async (language, texts: string[]) => ({ language, texts: texts.map((text) => `Q:${text}`) }));
    const store = new PublicTranslationStore(translate);
    const sources = Array.from({ length: 35 }, (_, index) => `Publicado ${index}`);
    store.register([...sources, ...sources]);
    store.setLanguage("quy");
    expect(store.getSnapshot().translationStatus).toBe("loading");
    await store.flush();
    expect(translate).toHaveBeenCalledTimes(9);
    expect(translate.mock.calls.every(([, batch]) => batch.length <= 4)).toBe(true);
    expect(store.t(sources[34])).toBe(`Q:${sources[34]}`);
    store.setLanguage("es"); store.setLanguage("quy"); await store.flush();
    expect(translate).toHaveBeenCalledTimes(9);
  });

  it.each([["ayr", 4, 1, 9], ["quy", 4, 2, 9]] as const)("bounds %s batches to %i strings with %i workers", async (language, batchSize, workers, requests) => {
    vi.useFakeTimers();
    let active = 0; let peak = 0;
    const translate = vi.fn(async (selected, texts: string[]) => {
      active++; peak = Math.max(peak, active);
      await Promise.resolve(); active--;
      return { language: selected, texts: texts.map((text) => `Translated:${text}`) };
    });
    const store = new PublicTranslationStore(translate);
    store.register(Array.from({ length: 35 }, (_, index) => `Publicado ${index}`));
    store.setLanguage(language); await store.flush();
    expect(translate).toHaveBeenCalledTimes(requests);
    expect(translate.mock.calls.every(([, batch]) => batch.length <= batchSize)).toBe(true);
    expect(peak).toBe(workers);
    expect(store.getSnapshot().translationStatus).toBe("ready");
  });

  it.each(["quy", "ayr"] as const)("bounds %s batches to 2000 characters while preserving a single long public source", async (language) => {
    vi.useFakeTimers();
    const translate = vi.fn(async (selected, texts: string[]) => ({ language: selected, texts: texts.map((text) => `T:${text}`) }));
    const store = new PublicTranslationStore(translate);
    const sources = ["a".repeat(1100), "b".repeat(1100), "c".repeat(2100), "d".repeat(500)];
    store.register(sources); store.setLanguage(language); await store.flush();
    const batches = translate.mock.calls.map(([, batch]) => batch);
    expect(batches.flat()).toEqual(sources);
    expect(batches.every((batch) => batch.length === 1 || batch.reduce((sum, text) => sum + text.length, 0) <= 2000)).toBe(true);
    expect(batches).toContainEqual([sources[2]]);
    expect(store.t(sources[2])).toBe(`T:${sources[2]}`);
    expect(store.getSnapshot().translationStatus).toBe("ready");
  });

  it("keeps the Spanish original and explicit error on failures until intentional retry", async () => {
    vi.useFakeTimers();
    const translate = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ language: "ayr", texts: ["Arsuña"] });
    const store = new PublicTranslationStore(translate);
    store.register(["Hablar"]); store.setLanguage("ayr");
    await store.flush();
    expect(store.t("Hablar")).toBe("Hablar");
    expect(store.getSnapshot().translationStatus).toBe("error");
    await store.flush();
    expect(translate).toHaveBeenCalledTimes(1);
    store.retry(); await store.flush();
    expect(store.t("Hablar")).toBe("Arsuña");
    expect(store.getSnapshot().translationStatus).toBe("ready");
  });

  it("does not replace the chosen language with a stale translation response", async () => {
    vi.useFakeTimers();
    let resolve!: (data: unknown) => void;
    const store = new PublicTranslationStore(() => new Promise((done) => { resolve = done; }), { ayr: { Hola: "Kamisaki" } });
    store.register(["Hola"]); store.setLanguage("quy");
    const pending = store.flush();
    store.setLanguage("ayr");
    resolve({ language: "quy", texts: ["Rimaykullayki"] });
    await pending;
    expect(store.getSnapshot().language).toBe("ayr");
    expect(store.t("Hola")).toBe("Kamisaki");
    store.setLanguage("quy"); expect(store.t("Hola")).toBe("Rimaykullayki");
  });

  it("picks up new published blocks registered during a request", async () => {
    vi.useFakeTimers();
    let resolve!: (data: unknown) => void;
    const translate = vi.fn().mockImplementationOnce(() => new Promise((done) => { resolve = done; })).mockImplementation(async (language, texts: string[]) => ({ language, texts: texts.map((text) => `Q:${text}`) }));
    const store = new PublicTranslationStore(translate);
    store.register(["Primero"]); store.setLanguage("quy");
    const pending = store.flush();
    store.register(["Segundo"]);
    resolve({ language: "quy", texts: ["Q:Primero"] });
    await pending;
    expect(store.getSnapshot().translationStatus).toBe("loading");
    await vi.advanceTimersByTimeAsync(30);
    expect(store.t("Segundo")).toBe("Q:Segundo");
    expect(store.getSnapshot().translationStatus).toBe("ready");
  });

  it("rejects a mismatched service language while keeping the original visible", async () => {
    vi.useFakeTimers();
    const store = new PublicTranslationStore(async () => ({ language: "es", texts: ["Incorrecto"] }));
    store.register(["Original"]); store.setLanguage("quy"); await store.flush();
    expect(store.t("Original")).toBe("Original");
    expect(store.getSnapshot().translationStatus).toBe("error");
  });

  it("keeps oversized content in Spanish without blocking smaller published text", async () => {
    vi.useFakeTimers();
    const translate = vi.fn(async (language, texts: string[]) => ({ language, texts: texts.map((text) => `Q:${text}`) }));
    const store = new PublicTranslationStore(translate);
    const oversized = "a".repeat(8001);
    store.register([oversized, "Pregunta"]); store.setLanguage("quy"); await store.flush();
    expect(translate).toHaveBeenCalledWith("quy", ["Pregunta"]);
    expect(store.t("Pregunta")).toBe("Q:Pregunta");
    expect(store.t(oversized)).toBe(oversized);
    expect(store.getSnapshot().translationStatus).toBe("error");
  });

  it("rejects wrong language, count or empty strings instead of inventing translation", () => {
    expect(() => validateTranslationResponse({ language: "es", texts: ["Hola"] }, "quy", 1)).toThrow();
    expect(() => validateTranslationResponse({ language: "quy", texts: [] }, "quy", 1)).toThrow();
    expect(() => validateTranslationResponse({ language: "quy", texts: [" "] }, "quy", 1)).toThrow();
    expect(translationBatches(["a".repeat(5000), "b".repeat(4000)])).toHaveLength(2);
    expect(() => translationBatches(["a".repeat(8001)])).toThrow("public-text-too-long");
  });

  it("collects all public article text and questions without ids, links, publisher names or private rubrics", () => {
    const noticia: NoticiaPublica = {
      id: "noticia-secret-id", seccion: "País", titular: "Titular", bajada: "Resumen", minutos: 2,
      miradas: [{ medio: "Medio", texto: "Cita" }],
      pasos: [
        { tipo: "fragmento", lado: "a", medio: "Medio", fecha: "2026-10-18", titular: "Fuente", texto: "Artículo", url: "https://example.com" },
        { tipo: "opciones", id: "p1", etiqueta: "Compara", titulo: "Pregunta", opciones: ["Uno", "Dos"], correcta: 1, bien: "Bien", otra: "Revisa", habilidad: "Comparar" },
        { tipo: "voz", id: "p2", etiqueta: "Explica", titulo: "Tu opinión", habilidad: "Argumentar", pistas: ["Pista"] },
      ],
    };
    const texts = collectNoticiaTexts(noticia);
    expect(texts).toEqual(expect.arrayContaining(["Titular", "Resumen", "Cita", "Artículo", "Pregunta", "Uno", "Dos", "Bien", "Revisa", "Comparar", "Tu opinión", "Pista"]));
    expect(texts).not.toContain("noticia-secret-id");
    expect(texts).not.toContain("https://example.com");
    expect(texts).not.toContain("Medio");
  });
});
