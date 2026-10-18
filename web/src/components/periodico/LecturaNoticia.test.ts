import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { EnrichedDocument } from "@reader-enricher/types";
import type { NoticiaPublica } from "@/lib/periodico/tipos";
import LecturaNoticia, { cambiarVista, vistaInicial, type VistaLectura } from "./LecturaNoticia";

const noticia: NoticiaPublica = {
  id: "lectura-simple", titular: "Una noticia para leer", bajada: "El contexto editorial.", seccion: "Educación", minutos: 3,
  pasos: [
    { tipo: "fragmento", lado: "a", medio: "Fuente A", fecha: "18 de octubre", titular: "Titular de la fuente", texto: "  Texto original sin recortes.\n\nSegundo párrafo.  ", url: "https://example.com/a" },
    { tipo: "opciones", id: "q", etiqueta: "Pregunta", titulo: "¿Qué dice?", opciones: ["A", "B"], correcta: 1, bien: "Bien", otra: "Revisa", habilidad: "Comprender" },
  ],
};

const documento: EnrichedDocument = {
  version: "1.0.0", articulo: { id: noticia.id, titular: noticia.titular, bajada: noticia.bajada, seccion: noticia.seccion }, genero: "informativa",
  layout: { id: "piramide", nombre: "Pirámide invertida", data: { encabezado: "cincoW", lead: null, niveles: [] } },
  bloques: [{ id: "cuerpo", rol: "cuerpo", fragmento: 0, lado: "a", medio: "Fuente A", fecha: "18 de octubre", url: "https://example.com/a", texto: "Texto original sin recortes." }],
  capas: { glosario: [], entidades: [], cincoW: { que: null, quien: null, cuando: null, donde: null, porque: null }, karaoke: { totalTokens: 0, conTiempos: false, bloques: [] }, visuales: { cifras: [], timeline: [] } },
  spans: [], meta: { ia: false, modelo: null, generoConfianza: 0.5, generoFuente: "heuristica", grado: null, version: "1.0.0", descartados: 0, avisos: [] },
};

describe("simple-first newspaper reading", () => {
  it.each(["cronica", "opinion", "informativa", "datos", "entrevista", "comparada"] as const)("keeps the first %s reading faithful with methodology below and optional insights", (genero) => {
    const html = renderToStaticMarkup(createElement(LecturaNoticia, { noticia, documento: { ...documento, genero } }));
    expect(html).toContain(noticia.titular);
    expect(html).toContain("  Texto original sin recortes.\n\nSegundo párrafo.  ");
    expect(html).toContain("Fuente A");
    expect(html).toContain('href="https://example.com/a"');
    const methodology = html.indexOf('aria-label="Metodología de lectura"');
    expect(methodology).toBeGreaterThan(html.indexOf("Segundo párrafo."));
    expect(methodology).toBeGreaterThan(html.indexOf('href="https://example.com/a"'));
    expect(html).toContain("Insights de esta lectura");
    expect(html).not.toContain('aria-label="Modo de la noticia"');
    expect(html).not.toContain("<aside");
    for (const extra of ["Claves y ayudas", "Glosario", "Pirámide invertida", "Cómo se preparó", "Mostrar apoyos", "Texto original</button>", "¿Qué dice?"]) expect(html).not.toContain(extra);
  });
  it("does not warn about unavailable insights before the reader asks for them", () => {
    const html = renderToStaticMarkup(createElement(LecturaNoticia, { noticia, documento: null }));
    expect(html).toContain("Texto original sin recortes.");
    expect(html).not.toContain("No hay apoyos");
    expect(html).not.toContain("<dialog");
  });
  it("does not inspect saved quiz progress to unlock first-reading insights", () => {
    const getItem = vi.fn(() => JSON.stringify({ hasta: 1, elegidas: { q: 0 }, intentosOpciones: { q: [0] } }));
    vi.stubGlobal("localStorage", { getItem });
    try {
      const html = renderToStaticMarkup(createElement(LecturaNoticia, { noticia, documento }));
      expect(getItem).not.toHaveBeenCalled();
      expect(html).not.toContain("Claves y ayudas");
    } finally { vi.unstubAllGlobals(); }
  });
  it("keeps an empty hidden in-flow support section until explicitly requested", () => {
    const html = renderToStaticMarkup(createElement(LecturaNoticia, { noticia, documento }));
    expect(html).not.toContain("<dialog");
    expect(html).not.toContain("aria-haspopup");
    expect(html).toContain('aria-expanded="false"');
    const controlledId = html.match(/aria-controls="([^"]+)"/)?.[1];
    expect(controlledId).toBeTruthy();
    const panel = html.match(new RegExp(`<section id="${controlledId}"[^>]*hidden=""[^>]*>([\\s\\S]*?)<\\/section>`));
    expect(panel).not.toBeNull();
    expect(panel![1]).toBe("");
    expect(html.indexOf(`id="${controlledId}"`)).toBeGreaterThan(html.indexOf("Segundo párrafo."));
    expect(html.indexOf(`id="${controlledId}"`)).toBeLessThan(html.indexOf('aria-label="Metodología de lectura"'));
    expect(html.split(noticia.pasos[0].tipo === "fragmento" ? noticia.pasos[0].texto : "unused")).toHaveLength(2);
  });
  it("places optional listening with the original, never inside support", () => {
    const html = renderToStaticMarkup(createElement(LecturaNoticia, { noticia, documento }));
    expect(html).toContain("Escuchar lectura");
    expect(html.indexOf("Escuchar lectura")).toBeLessThan(html.indexOf("Texto original sin recortes."));
    expect(html).toContain("Voz no disponible en este navegador");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>/);
  });
  it("keeps source anchors on the original header and fragments exactly once", () => {
    const blocks: EnrichedDocument["bloques"] = [
      { ...documento.bloques[0], id: "h", rol: "titular", fragmento: null, texto: noticia.titular },
      { ...documento.bloques[0], id: "s", rol: "bajada", fragmento: null, texto: noticia.bajada },
      { ...documento.bloques[0], id: "f0t", rol: "titular", texto: "Titular de la fuente" },
      { ...documento.bloques[0], id: "f0p0" },
      { ...documento.bloques[0], id: "f0p1", texto: "Segundo párrafo." },
    ];
    const html = renderToStaticMarkup(createElement(LecturaNoticia, { noticia, documento: { ...documento, bloques: blocks } }));
    for (const block of blocks) expect(html.split(`id="lectura-bloque-${block.id}"`)).toHaveLength(2);
  });
  it("has no modal, scroll-lock, fixed support, or second article path", () => {
    const source = readFileSync(fileURLToPath(new URL("./LecturaNoticia.tsx", import.meta.url)), "utf8");
    const css = readFileSync(fileURLToPath(new URL("./lectura-interactiva.module.css", import.meta.url)), "utf8");
    expect(source).not.toMatch(/showModal|HTMLDialogElement|document\.body|aria-modal|<dialog/);
    expect(css).not.toMatch(/::backdrop|position:\s*(fixed|sticky)/);
    expect(source).toContain('event.key === "Escape"');
    expect(source).toContain('pestañaApoyos.current?.focus({ preventScroll: true })');
    expect(source).toContain('revisionVoz={revisionVoz} onRevisionVozChange={setRevisionVoz}');
    expect(source).toContain('dispatch("releer")');
    expect(source).toContain('document.getElementById(blockAnchor(blockId))');
    expect(source).toContain('activeWord={language === "es" ? voice.activeWord : null}');
    expect(source).toContain('else { if (voice.playing) voice.stop(); dispatch("abrir-apoyos"); }');
  });
});

describe("reader and optional insights state", () => {
  it("starts with methodology active and insights closed, without mutating initial state", () => {
    expect(vistaInicial).toEqual({ apoyosAbiertos: false, metodologiaActiva: true });
    const snapshot = { ...vistaInicial };
    cambiarVista(vistaInicial, "abrir-apoyos");
    cambiarVista(vistaInicial, "releer");
    expect(vistaInicial).toEqual(snapshot);
  });
  it.each([false, true])("opens and closes insights without changing methodology activity (%s)", (metodologiaActiva) => {
    const original: VistaLectura = { apoyosAbiertos: false, metodologiaActiva };
    const opened = cambiarVista(original, "abrir-apoyos");
    expect(opened).toEqual({ apoyosAbiertos: true, metodologiaActiva });
    expect(original).toEqual({ apoyosAbiertos: false, metodologiaActiva });
    expect(cambiarVista(opened, "cerrar-apoyos")).toEqual(original);
    expect(cambiarVista(opened, "abrir-apoyos")).toEqual(opened);
    expect(cambiarVista(original, "cerrar-apoyos")).toEqual(original);
  });
  it.each([false, true])("rereading closes insights and pauses the methodology (%s)", (apoyosAbiertos) => {
    const state = { apoyosAbiertos, metodologiaActiva: true };
    const reading = cambiarVista(state, "releer");
    expect(reading).toEqual({ apoyosAbiertos: false, metodologiaActiva: false });
    expect(state).toEqual({ apoyosAbiertos, metodologiaActiva: true });
    expect(cambiarVista(reading, "releer")).toEqual(reading);
  });
  it("does not restart the methodology when insights are opened during a reread", () => {
    const reading = cambiarVista(vistaInicial, "releer");
    const opened = cambiarVista(reading, "abrir-apoyos");
    expect(opened).toEqual({ apoyosAbiertos: true, metodologiaActiva: false });
    const closed = cambiarVista(opened, "cerrar-apoyos");
    expect(closed).toEqual(reading);
    expect(cambiarVista(closed, "retomar-metodologia")).toEqual(vistaInicial);
  });
  it("can resume methodology activity without implicitly opening or closing insights", () => {
    for (const apoyosAbiertos of [false, true]) {
      expect(cambiarVista({ apoyosAbiertos, metodologiaActiva: false }, "retomar-metodologia"))
        .toEqual({ apoyosAbiertos, metodologiaActiva: true });
    }
  });
});
