import { describe, expect, it } from "vitest";
import { buildEntities } from "../src/layers/entities.ts";
import { detectVisuals, parseSpanishNumber } from "../src/layers/visuals.ts";
import { buildFiveW } from "../src/layers/fiveW.ts";
import { buildGlossary } from "../src/layers/glossary.ts";
import { buildSpans } from "../src/layers/spans.ts";
import { verify } from "../src/guards/grounding.ts";
import { blocksOf, textAt } from "./helpers.ts";

describe("entities layer", () => {
  it("extracts dates, numbers and capitalized names heuristically, all grounded", () => {
    const blocks = blocksOf("cronica-puente");
    const { items } = buildEntities(blocks, null);
    const byText = (t: string) => items.find((e) => e.texto === t);
    expect(byText("2 de marzo de 2026")?.tipo).toBe("fecha");
    expect(byText("Rosa Quispe")?.tipo).toBe("persona");
    expect(byText("Municipalidad de San Lucas")?.tipo).toBe("organizacion");
    expect(byText("Rosa Quispe")?.etiqueta).toBe("¿Quién es?");
    expect(byText("Martín Huamán")?.tipo).toBe("persona");
    expect(byText("San Lucas")?.tipo).toBe("lugar");
    for (const e of items) {
      expect(verify(blocks, { texto: e.texto, fuente: e.fuente })).toBe(true);
      expect(e.apariciones.length).toBeGreaterThanOrEqual(1);
    }
    // sentence-initial common words are not entities
    expect(items.some((e) => e.texto === "Al" || e.texto === "Por" || e.texto === "Su")).toBe(false);
  });

  it("keeps grounded LLM entities and drops invented ones", () => {
    const blocks = blocksOf("cronica-puente");
    const { items, descartados } = buildEntities(blocks, [
      { texto: "Rosa Quispe", tipo: "persona", contexto: "Ingeniera a cargo de la obra." },
      { texto: "Juan Pérez", tipo: "persona", contexto: "Inventado." },
    ]);
    const rosa = items.find((e) => e.texto === "Rosa Quispe");
    expect(rosa?.contexto).toBe("Ingeniera a cargo de la obra.");
    expect(items.some((e) => e.texto === "Juan Pérez")).toBe(false);
    expect(descartados).toBe(1);
    // heuristic dates are still merged in
    expect(items.some((e) => e.tipo === "fecha")).toBe(true);
  });
});

describe("visuals layer", () => {
  it("parses Spanish number formats", () => {
    expect(parseSpanishNumber("16.200")).toBe(16200);
    expect(parseSpanishNumber("3,5")).toBe(3.5);
    expect(parseSpanishNumber("200 mil")).toBe(200000);
    expect(parseSpanishNumber("2 millones")).toBe(2000000);
  });

  it("groups comparable figures by unit into bar data; every value is literal", () => {
    const blocks = blocksOf("datos-agua");
    const v = detectVisuals(blocks);
    const pct = v.cifras.find((g) => g.unidad === "%");
    expect(pct?.barras.map((b) => b.valor)).toEqual([12, 15]);
    expect(pct?.max).toBe(15);
    expect(pct?.barras[1]!.proporcion).toBe(1);
    const perDay = v.cifras.find((g) => g.unidad === "litros al día");
    expect(perDay?.barras.map((b) => b.valor)).toEqual([30, 540]);
    for (const g of v.cifras) {
      for (const b of g.barras) {
        expect(verify(blocks, { texto: b.texto, fuente: b.fuente })).toBe(true);
        expect(textAt(blocks, b.fuente)).toContain(String(b.texto.match(/[\d.,]+/)![0]));
      }
    }
  });

  it("does not treat years or clock times as figures, and builds a dated timeline", () => {
    const blocks = blocksOf("cronica-puente");
    const v = detectVisuals(blocks);
    const all = v.cifras.flatMap((g) => g.barras.map((b) => b.valor));
    expect(all).not.toContain(2026);
    expect(all).not.toContain(6);
    expect(v.timeline[0]!.fecha.texto).toBe("2 de marzo de 2026");
    expect(v.timeline[0]!.evento.texto).toContain("El puente de San Lucas estaba cerrado");
  });
});

describe("5W layer", () => {
  it("grounds LLM answers and nulls the ones that are not literal", () => {
    const blocks = blocksOf("informativa-biblioteca");
    const { cincoW, descartados } = buildFiveW(
      blocks,
      {
        que: "inauguró el sábado una biblioteca comunitaria",
        quien: "La asociación de vecinos de Villa Alegre",
        cuando: "el sábado",
        donde: "en la plaza central",
        porque: null,
      },
      [],
    );
    expect(cincoW.que?.texto).toBe("inauguró el sábado una biblioteca comunitaria");
    expect(cincoW.quien).not.toBeNull();
    expect(cincoW.donde).toBeNull();
    expect(cincoW.porque).toBeNull();
    expect(descartados).toBe(1);
  });

  it("heuristic fallback only uses literal text and leaves unknowns null", () => {
    const blocks = blocksOf("informativa-biblioteca");
    const { items } = buildEntities(blocks, null);
    const { cincoW } = buildFiveW(blocks, null, items);
    expect(cincoW.que).not.toBeNull();
    expect(cincoW.porque?.texto).toContain("muchos estudiantes no tenían libros");
    for (const k of ["que", "quien", "cuando", "donde", "porque"] as const) {
      const c = cincoW[k];
      if (c) expect(verify(blocks, c)).toBe(true);
    }
  });
});

describe("glossary layer", () => {
  const blocks = blocksOf("cronica-puente");

  it("is empty without LLM", () => {
    expect(buildGlossary(blocks, null, 7).items).toEqual([]);
  });

  it("keeps terms present in the text with all occurrences and drops absent ones", () => {
    const { items, descartados } = buildGlossary(
      blocks,
      [
        { termino: "crecida", definicion: "Cuando un río sube mucho.", ejemplo: "La crecida tapó la orilla." },
        { termino: "pilares", definicion: "Columnas que sostienen.", ejemplo: "El puente tiene pilares." },
        { termino: "viaducto", definicion: "No aparece.", ejemplo: "-" },
      ],
      7,
    );
    expect(items.map((i) => i.termino)).toEqual(["crecida", "pilares"]);
    expect(descartados).toBe(1);
    expect(textAt(blocks, items[0]!.fuente)).toBe("crecida");
  });

  it("shortens long definitions for younger grades", () => {
    const long = "Primera frase corta. " + "Segunda frase muy larga ".repeat(20);
    const { items } = buildGlossary(blocks, [{ termino: "crecida", definicion: long, ejemplo: "x" }], 3);
    expect(items[0]!.definicion).toBe("Primera frase corta.");
  });
});

describe("spans", () => {
  it("returns sorted, non-overlapping spans preferring glossary terms", () => {
    const spans = buildSpans(
      [{ id: "g0", termino: "x", definicion: "", ejemplo: "", fuente: { bloqueId: "b", inicio: 0, fin: 5 }, apariciones: [{ bloqueId: "b", inicio: 0, fin: 5 }] }],
      [
        { id: "e0", texto: "x", tipo: "otro", etiqueta: "", contexto: null, fuente: { bloqueId: "b", inicio: 2, fin: 8 }, apariciones: [{ bloqueId: "b", inicio: 2, fin: 8 }, { bloqueId: "b", inicio: 10, fin: 12 }] },
      ],
    );
    expect(spans).toEqual([
      { bloqueId: "b", inicio: 0, fin: 5, tipo: "glosario", refId: "g0" },
      { bloqueId: "b", inicio: 10, fin: 12, tipo: "entidad", refId: "e0" },
    ]);
  });
});
