import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { EnrichedDocument, Span } from "@reader-enricher/types";
import LecturaInteractiva from "./LecturaInteractiva";
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
  it.each(layouts)("preserves all full paragraphs for $id even when layout quotes cover only a substring", (layout) => {
    const document = { ...documentFixture(), layout };
    const html = renderToStaticMarkup(createElement(LecturaInteractiva, { documento: document }));
    expect(html).toContain("Texto íntegro que nunca debe desaparecer.");
    expect(html).toContain("Segundo párrafo conservado sin recortes.");
    expect(html.match(/id="lectura-bloque-body"/g)).toHaveLength(1);
    expect(html.match(/id="lectura-bloque-other"/g)).toHaveLength(1);
    expect(html).not.toContain("javascript:");
    expect(html).toContain("No se generaron definiciones");
    expect(html).toContain("Voz no disponible en este navegador");
  });
  it("renders source-offset annotations as keyboard accessible buttons without replacing source text", () => {
    const document = documentFixture();
    document.capas.glosario = [{ id: "g", termino: "Texto", definicion: "Palabras escritas.", ejemplo: "", fuente: { ...source, fin: 5 }, apariciones: [] }];
    document.spans = [{ ...source, fin: 5, tipo: "glosario", refId: "g" }];
    const html = renderToStaticMarkup(createElement(LecturaInteractiva, { documento: document }));
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('role="note" hidden=""');
    expect(html).toContain("Palabras escritas.");
    expect(html).toContain("Texto</button>");
    expect(html).toContain(" íntegro que nunca debe desaparecer.");
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
