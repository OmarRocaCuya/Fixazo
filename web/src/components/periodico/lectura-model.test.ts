import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { EnrichedDocument, Span } from "@reader-enricher/types";
import LecturaInteractiva, { citaBreve, citaContextual } from "./LecturaInteractiva";
import { TextoOriginal } from "./LecturaNoticia";
import { blockAnchor, remainingBodyBlocks, safeSourceUrl, textSegments, validSource, wordAt } from "./lectura-model";

const source = { bloqueId: "body", inicio: 0, fin: 6 };
function documentFixture(): EnrichedDocument {
  return {
    version: "1.0.0", articulo: { id: "n", titular: "Título", bajada: null, seccion: "Cultura" }, genero: "informativa",
    layout: { id: "piramide", nombre: "Pirámide invertida", data: { encabezado: "cincoW", lead: null, niveles: [] } },
    bloques: [{ id: "body", rol: "cuerpo", fragmento: 0, lado: "a", medio: "Medio A", fecha: "18 de octubre", url: "https://example.com/a", texto: "Texto íntegro que nunca debe desaparecer." }, { id: "other", rol: "cuerpo", fragmento: 1, lado: "b", medio: "Medio B", fecha: null, url: "javascript:alert(1)", texto: "Segundo párrafo conservado sin recortes." }],
    capas: { glosario: [], entidades: [], cincoW: { que: null, quien: null, cuando: null, donde: null, porque: null }, karaoke: { totalTokens: 0, conTiempos: false, bloques: [] }, visuales: { cifras: [], timeline: [] } },
    spans: [], meta: { ia: false, modelo: null, generoConfianza: 0.5, generoFuente: "heuristica", grado: null, version: "1.0.0", descartados: 0, avisos: [] },
  };
}

describe("faithful reading helpers", () => {
  it("permits only absolute http(s) source links without embedded credentials", () => {
    expect(safeSourceUrl("https://example.com/news")).toBe("https://example.com/news");
    for (const url of ["javascript:alert(1)", "data:text/html,bad", "/relative", "//example.com", "https://user:password@example.com"]) expect(safeSourceUrl(url)).toBeNull();
  });
  it("preserves every character around invalid, overlapping, and Unicode spans", () => {
    const text = "Ángela  llegó.\nLa noticia sigue.";
    const spans: Span[] = [
      { bloqueId: "b", inicio: 0, fin: 6, tipo: "entidad", refId: "e" },
      { bloqueId: "b", inicio: 0, fin: 2, tipo: "glosario", refId: "g" },
      { bloqueId: "b", inicio: -1, fin: 100, tipo: "glosario", refId: "invalid" },
      { bloqueId: "b", inicio: 8, fin: 13, tipo: "glosario", refId: "g2" },
    ];
    const segments = textSegments(text, spans);
    expect(segments.map((segment) => segment.text).join("")).toBe(text);
    expect(segments.filter((segment) => segment.span)).toHaveLength(2);
    expect(textSegments("", [])).toEqual([]);
  });
  it("highlights only a word found at a supplied real boundary offset", () => {
    expect(wordAt("Hola  Perú.", 6)).toEqual({ inicio: 6, fin: 11 });
    expect(wordAt("Hola  Perú.", 8)).toEqual({ inicio: 6, fin: 11 });
    for (const index of [-1, 4, 5, 11, 1.5, NaN]) expect(wordAt("Hola  Perú.", index)).toBeNull();
  });
  it("appends every unrendered body block and validates source offsets", () => {
    const document = documentFixture();
    expect(remainingBodyBlocks(document, new Set(["body"])).map((block) => block.id)).toEqual(["other"]);
    expect(validSource(document.bloques, source)).toBe(true);
    expect(validSource(document.bloques, { ...source, fin: 9999 })).toBe(false);
    expect(validSource(document.bloques, { ...source, fin: 0 })).toBe(false);
    expect(blockAnchor("body / 1")).toBe("lectura-bloque-body%20%2F%201");
  });
});

describe("genre-aware reading server rendering", () => {
  const quote = { texto: "Texto ", fuente: source };
  const layouts: Array<EnrichedDocument["layout"]> = [
    { id: "timeline", nombre: "Línea de tiempo", data: { eventos: [{ id: "e", ancla: null, resumen: quote, bloqueIds: ["body", "body"] }] } },
    { id: "pancarta", nombre: "Pancarta", data: { tesis: quote, argumentos: [], citas: [], bloqueIds: ["body"] } },
    { id: "piramide", nombre: "Pirámide invertida", data: { encabezado: "cincoW", lead: null, niveles: [{ importancia: 1, etiqueta: "Lo esencial", bloqueIds: ["body"] }] } },
    { id: "datos", nombre: "Datos", data: { destacadas: [], graficos: [], bloqueIds: ["body"] } },
    { id: "dialogo", nombre: "Diálogo", data: { turnos: [{ id: "t", rol: "entrevistado", hablante: "Una voz", cita: quote }] } },
    { id: "comparada", nombre: "Comparada", data: { columnas: [{ lado: "a", medio: "Medio A", titular: null, bloqueIds: ["body"] }], puntos: [] } },
  ];
  it.each(layouts)("renders only genre supports for $id without reprinting the article", (layout) => {
    const document = { ...documentFixture(), layout };
    const html = renderToStaticMarkup(createElement(LecturaInteractiva, { documento: document }));
    expect(html).not.toContain("Texto íntegro que nunca debe desaparecer.");
    expect(html).not.toContain("Segundo párrafo conservado sin recortes.");
    expect(html).not.toContain('id="lectura-bloque-');
    expect(html).not.toContain("Escuchar lectura");
    expect(html).not.toContain("<aside");
    expect(html).not.toContain("La lectura completa");
    expect(html).not.toContain("Texto completo de la entrevista");
    expect(html).toContain("No se generaron definiciones");
    expect(html).toContain('aria-label="Claves y ayudas de lectura"');
    expect(html).toContain("Consulta el pasaje completo en el artículo.");
  });
  it.each(layouts)("links evidence to unique original anchors for $id", (layout) => {
    const document = { ...documentFixture(), layout };
    document.capas.cincoW.que = { texto: "Texto ", fuente: source };
    document.capas.glosario = [{ id: "g", termino: "Texto", definicion: "Palabras escritas.", ejemplo: "", fuente: { ...source, fin: 5 }, apariciones: [] }];
    const article = {
      id: "n", titular: "Título", bajada: "Bajada", seccion: "Cultura", minutos: 2,
      pasos: document.bloques.map((block) => ({ tipo: "fragmento" as const, lado: block.lado!, medio: block.medio!, fecha: "hoy", titular: `Fuente ${block.id}`, texto: block.texto, url: block.url! })),
    };
    const original = renderToStaticMarkup(createElement(TextoOriginal, { noticia: article, documento: document }));
    const support = renderToStaticMarkup(createElement(LecturaInteractiva, { documento: document }));
    expect(support).toContain('href="#lectura-bloque-body"');
    expect(support).not.toContain('id="lectura-bloque-body"');
    expect(original.match(/id="lectura-bloque-body"/g)).toHaveLength(1);
    expect(support).toContain("Palabras escritas.");
    expect(original).toContain("Texto íntegro que nunca debe desaparecer.");
    expect(support).not.toContain("Texto íntegro que nunca debe desaparecer.");
    expect(original + support).not.toContain("javascript:");
  });
  it("bounds exact source excerpts and ignores a mismatching display quote", () => {
    const document = documentFixture();
    const text = "Una cita exacta de la fuente con detalles y contexto. ".repeat(20);
    document.bloques[0].texto = text;
    document.capas.cincoW.que = { texto: "Resumen inventado que nunca debe mostrarse", fuente: { bloqueId: "body", inicio: 0, fin: text.length } };
    const html = renderToStaticMarkup(createElement(LecturaInteractiva, { documento: document }));
    expect(html).toContain(citaBreve(text));
    expect(citaBreve(text).length).toBeLessThanOrEqual(220);
    expect(citaBreve(text)).toMatch(/…$/u);
    expect(text.startsWith(citaBreve(text).slice(0, -1))).toBe(true);
    expect(html).not.toContain(text);
    expect(html).not.toContain("Resumen inventado");
    expect(citaBreve("Árbol corto")).toBe("Árbol corto");
  });
  it("limits chronology insights instead of disguising the full story as an event list", () => {
    const document = documentFixture();
    document.layout = { id: "timeline", nombre: "Línea de tiempo", data: { eventos: Array.from({ length: 20 }, (_, index) => ({ id: `e${index}`, ancla: null, resumen: quote, bloqueIds: ["body"] })) } };
    const html = renderToStaticMarkup(createElement(LecturaInteractiva, { documento: document }));
    expect(html.match(/<blockquote>/g)).toHaveLength(3);
    expect(html).not.toContain(document.bloques[0].texto);
  });
  it("shows an explicit fallback when no genre evidence is available", () => {
    const html = renderToStaticMarkup(createElement(LecturaInteractiva, { documento: documentFixture() }));
    expect(html).toContain("No hay citas suficientes para este apoyo.");
    expect(html).toContain("No se indica de forma explícita.");
  });
  it("highlights a supplied real word boundary within the one unmodified original fragment", () => {
    const document = documentFixture();
    const text = `  ${document.bloques[0].texto}\n\nOtro párrafo.  `;
    const noticia = { id: "n", titular: "Título", bajada: "Bajada", seccion: "Cultura", minutos: 2, pasos: [{ tipo: "fragmento" as const, lado: "a" as const, medio: "Fuente", fecha: "hoy", titular: "Fuente", texto: text, url: "https://example.com/a" }] };
    const html = renderToStaticMarkup(createElement(TextoOriginal, { noticia, documento: document, activeWord: { bloqueId: "body", inicio: 0, fin: 5 } }));
    expect(html).toContain(">Texto</mark> íntegro que nunca debe desaparecer.");
    expect(html).toContain("\n\nOtro párrafo.  ");
    expect(html.match(/<mark/g)).toHaveLength(1);
  });
  it("uses contextual source sentences instead of repeating a short shared entity as insights", () => {
    const document = documentFixture();
    const a = "Las universidades de Estados Unidos incorporan exámenes orales para conocer el razonamiento de sus alumnos.";
    const b = "En Estados Unidos, otros docentes prefieren tareas presenciales y proyectos grupales para evaluar el aprendizaje.";
    document.bloques[0].texto = a;
    document.bloques[1].texto = b;
    const quoteFor = (text: string, bloqueId: string) => ({ texto: "Estados Unidos", fuente: { bloqueId, inicio: text.indexOf("Estados Unidos"), fin: text.indexOf("Estados Unidos") + "Estados Unidos".length } });
    document.layout = { id: "comparada", nombre: "Comparada", data: { columnas: [], puntos: [{ id: "p", tema: "Estados Unidos", relacion: "coincide", a: quoteFor(a, "body"), b: quoteFor(b, "other") }] } };
    const html = renderToStaticMarkup(createElement(LecturaInteractiva, { documento: document }));
    expect(html).toContain(a);
    expect(html).toContain(b);
    expect(html).not.toContain("<blockquote>Estados Unidos</blockquote>");
    expect(html).toContain('href="#lectura-bloque-body"');
    expect(html).toContain('href="#lectura-bloque-other"');
  });
  it.each(["Estados Unidos", "Estados Unidos es un país citado."])("does not present uninformative or identical passages as a comparison: %s", (text) => {
    const document = documentFixture();
    document.bloques[0].texto = text;
    document.bloques[1].texto = text;
    const sourceFor = (bloqueId: string) => ({ texto: "Estados Unidos", fuente: { bloqueId, inicio: 0, fin: "Estados Unidos".length } });
    document.layout = { id: "comparada", nombre: "Comparada", data: { columnas: [], puntos: [{ id: "p", tema: "Estados Unidos", relacion: "coincide", a: sourceFor("body"), b: sourceFor("other") }] } };
    const html = renderToStaticMarkup(createElement(LecturaInteractiva, { documento: document }));
    expect(html).toContain("No hay citas suficientes para este apoyo.");
    expect(html).not.toContain("<blockquote>");
    expect(html).not.toContain("<h4>Estados Unidos</h4>");
  });
  it("bounds contextual evidence around a late entity without returning the full paragraph", () => {
    const document = documentFixture();
    const text = `${"El informe presenta detalles del cambio educativo sin cerrar todavía sus conclusiones, ".repeat(8)}en Estados Unidos se están ensayando evaluaciones presenciales, ${"con proyectos y entrevistas para comprender el proceso de cada alumno, ".repeat(8)}según la fuente.`;
    document.bloques[0].texto = text;
    const inicio = text.indexOf("Estados Unidos");
    const contextual = citaContextual({ texto: "Estados Unidos", fuente: { bloqueId: "body", inicio, fin: inicio + 14 } }, document.bloques)!;
    expect(contextual.texto).toContain("Estados Unidos se están ensayando evaluaciones presenciales");
    expect(contextual.texto.length).toBeLessThanOrEqual(218);
    expect(contextual.texto).toBe(text.slice(contextual.fuente.inicio, contextual.fuente.fin));
    expect(validSource(document.bloques, contextual.fuente)).toBe(true);
    expect(contextual.recorteInicio).toBe(true);
    expect(contextual.recorteFin).toBe(true);
  });
  it("shows original fragments faithfully without carrying comprehension questions into reading", () => {
    const html = renderToStaticMarkup(createElement(TextoOriginal, { noticia: {
      id: "n", titular: "Título", bajada: "Bajada", seccion: "Cultura", minutos: 2,
      pasos: [{ tipo: "fragmento", lado: "a", medio: "Fuente A", fecha: "hoy", titular: "Una fuente", texto: "  Espacios originales.\n\nOtro párrafo.  ", url: "javascript:alert(1)" }, { tipo: "opciones", id: "q", etiqueta: "Pregunta", titulo: "Pregunta no incluida", opciones: [], correcta: null, bien: "", otra: "", habilidad: null }],
    } }));
    expect(html).toContain("  Espacios originales.\n\nOtro párrafo.  ");
    expect(html).not.toContain("Pregunta no incluida");
    expect(html).not.toContain("javascript:");
  });
});
