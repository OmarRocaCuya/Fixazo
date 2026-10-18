import { describe, expect, it } from "vitest";
import { LAYOUTS, catalog, layoutForGenre } from "../src/layouts/index.ts";
import type { LayoutContext } from "../src/layouts/types.ts";
import { buildEntities } from "../src/layers/entities.ts";
import { buildFiveW } from "../src/layers/fiveW.ts";
import { detectVisuals } from "../src/layers/visuals.ts";
import { verify } from "../src/guards/grounding.ts";
import { GENEROS, LAYOUT_IDS } from "../src/schemas.ts";
import type { Cita, LlmAnalysis } from "../src/types.ts";
import { blocksOf } from "./helpers.ts";

function ctx(sampleId: string, analysis: LlmAnalysis | null = null): LayoutContext {
  const blocks = blocksOf(sampleId);
  const entidades = buildEntities(blocks, null).items;
  return { blocks, analysis, entidades, cincoW: buildFiveW(blocks, null, entidades).cincoW, visuales: detectVisuals(blocks) };
}

function emptyAnalysis(over: Partial<LlmAnalysis> = {}): LlmAnalysis {
  return {
    genero: "informativa",
    confianza: 0.9,
    tesis: null,
    argumentos: [],
    citasClave: [],
    eventos: [],
    turnos: [],
    puntos: [],
    glosario: [],
    entidades: [],
    cincoW: { que: null, quien: null, cuando: null, donde: null, porque: null },
    ...over,
  };
}

/** Recursively collects every {texto, fuente} object in a layout payload. */
function citas(x: unknown, acc: Cita[] = []): Cita[] {
  if (Array.isArray(x)) x.forEach((v) => citas(v, acc));
  else if (x && typeof x === "object") {
    const o = x as Record<string, unknown>;
    if (typeof o.texto === "string" && o.fuente && typeof o.fuente === "object") acc.push(o as unknown as Cita);
    Object.values(o).forEach((v) => citas(v, acc));
  }
  return acc;
}

describe("layout registry", () => {
  it("has one layout per id and every genre maps to a layout", () => {
    expect(LAYOUTS.map((l) => l.id).sort()).toEqual([...LAYOUT_IDS].sort());
    for (const g of GENEROS) expect(layoutForGenre(g).generos).toContain(g);
  });

  it("exposes a UI catalog", () => {
    const c = catalog();
    expect(c).toHaveLength(6);
    expect(c[0]).toEqual({ id: expect.any(String), nombre: expect.any(String), descripcion: expect.any(String), generos: expect.any(Array) });
  });
});

const cases: Array<[string, string]> = [
  ["cronica-puente", "timeline"],
  ["opinion-recreo", "pancarta"],
  ["informativa-biblioteca", "piramide"],
  ["datos-agua", "datos"],
  ["entrevista-astronoma", "dialogo"],
  ["comparada-parque", "comparada"],
];

describe.each(cases)("heuristic build for %s → %s", (sampleId, layoutId) => {
  it("builds valid, fully grounded data", () => {
    const def = LAYOUTS.find((l) => l.id === layoutId)!;
    const c = ctx(sampleId);
    const { data } = def.build(c);
    expect(() => def.schema.parse(data)).not.toThrow();
    const all = citas(data);
    expect(all.length).toBeGreaterThan(0);
    for (const ci of all) expect(verify(c.blocks, ci)).toBe(true);
  });
});

describe("layout specifics", () => {
  it("timeline: events carry time anchors and attach every body block", () => {
    const def = LAYOUTS.find((l) => l.id === "timeline")!;
    const c = ctx("cronica-puente");
    const data = def.build(c).data as { eventos: Array<{ ancla: Cita | null; bloqueIds: string[] }> };
    expect(data.eventos[0]!.ancla?.texto).toBe("A las 6:00 de la mañana");
    const attached = data.eventos.flatMap((e) => e.bloqueIds);
    expect(attached).toEqual(c.blocks.filter((b) => b.rol === "cuerpo").map((b) => b.id));
  });

  it("pancarta: uses grounded LLM thesis and drops invented arguments", () => {
    const def = LAYOUTS.find((l) => l.id === "pancarta")!;
    const r = def.build(
      ctx("opinion-recreo", emptyAnalysis({ tesis: "recortar el recreo es un error", argumentos: ["el cerebro necesita pausas", "inventado por la IA"] })),
    );
    const data = r.data as { tesis: Cita; argumentos: Array<{ cita: Cita }>; citas: Cita[] };
    expect(data.tesis.texto).toBe("recortar el recreo es un error");
    expect(data.argumentos.map((a) => a.cita.texto)).toEqual(["el cerebro necesita pausas"]);
    expect(r.descartados).toBe(1);
  });

  it("pancarta heuristic: highlights quotes in «»", () => {
    const def = LAYOUTS.find((l) => l.id === "pancarta")!;
    const data = def.build(ctx("opinion-recreo")).data as { citas: Cita[] };
    expect(data.citas[0]!.texto).toBe("Un niño que juega también está pensando");
  });

  it("dialogo: alternates interviewer and interviewee without the dash", () => {
    const def = LAYOUTS.find((l) => l.id === "dialogo")!;
    const data = def.build(ctx("entrevista-astronoma")).data as { turnos: Array<{ rol: string; cita: Cita }> };
    expect(data.turnos.map((t) => t.rol)).toEqual(["entrevistador", "entrevistado", "entrevistador", "entrevistado", "entrevistador", "entrevistado"]);
    expect(data.turnos[0]!.cita.texto.startsWith("¿Cuándo")).toBe(true);
  });

  it("comparada: two columns and matched points", () => {
    const def = LAYOUTS.find((l) => l.id === "comparada")!;
    const data = def.build(ctx("comparada-parque")).data as {
      columnas: Array<{ lado: string; medio: string | null }>;
      puntos: Array<{ relacion: string; a: Cita | null; b: Cita | null }>;
    };
    expect(data.columnas.map((c) => c.lado)).toEqual(["a", "b"]);
    expect(data.puntos.some((p) => p.relacion === "coincide")).toBe(true);
    expect(data.puntos.some((p) => p.relacion === "difiere")).toBe(true);
  });

  it("comparada: LLM quotes must live on their own side", () => {
    const def = LAYOUTS.find((l) => l.id === "comparada")!;
    const r = def.build(
      ctx(
        "comparada-parque",
        emptyAnalysis({
          puntos: [
            { tema: "Duración", citaA: "durante 3 meses", citaB: "tarde más de 6 meses", relacion: "difiere" },
            { tema: "Mal lado", citaA: "por un cartel", citaB: null, relacion: "difiere" },
          ],
        }),
      ),
    );
    const data = r.data as { puntos: Array<{ tema: string }> };
    expect(data.puntos.map((p) => p.tema)).toEqual(["Duración"]);
  });

  it("datos: highlights figures that exist in the text", () => {
    const def = LAYOUTS.find((l) => l.id === "datos")!;
    const data = def.build(ctx("datos-agua")).data as { destacadas: Array<{ texto: string }>; graficos: unknown[] };
    expect(data.destacadas.length).toBeGreaterThanOrEqual(3);
    expect(data.destacadas[0]!.texto).toBe("32 estudiantes");
    expect(data.graficos.length).toBeGreaterThanOrEqual(2);
  });

  it("piramide: lead is level 1, then decreasing importance", () => {
    const def = LAYOUTS.find((l) => l.id === "piramide")!;
    const data = def.build(ctx("informativa-biblioteca")).data as { niveles: Array<{ importancia: number; bloqueIds: string[] }> };
    expect(data.niveles.map((n) => n.importancia)).toEqual([1, 2, 3]);
    expect(data.niveles[0]!.bloqueIds).toEqual(["f0p0"]);
  });
});
