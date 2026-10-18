import { describe, expect, it } from "vitest";
import { enrich } from "../src/enrich.ts";
import type { LlmPort } from "../src/llm/port.ts";
import { verify } from "../src/guards/grounding.ts";
import { EnrichRequestSchema, EnrichedDocumentSchema } from "../src/schemas.ts";
import { layoutForGenre } from "../src/layouts/index.ts";
import { SAMPLES } from "../src/demo/samples.ts";
import type { EnrichRequest, LlmAnalysis } from "../src/types.ts";
import { sample } from "./helpers.ts";

const req = (r: EnrichRequest) => EnrichRequestSchema.parse(r);

class FakeLlm implements LlmPort {
  readonly modelo = "fake-model";
  calls = 0;
  constructor(private readonly out: LlmAnalysis | null | Error) {}
  async analyze() {
    this.calls++;
    if (this.out instanceof Error) throw this.out;
    return this.out;
  }
}

const ANALYSIS: LlmAnalysis = {
  genero: "cronica",
  confianza: 0.9,
  tesis: null,
  argumentos: [],
  citasClave: [],
  eventos: [
    { ancla: "A las 6:00 de la mañana", cita: "los primeros vecinos ya esperaban junto al río" },
    { ancla: "Al mediodía", cita: "la Municipalidad de San Lucas anunció que la prueba de carga había salido bien" },
    { ancla: "ayer", cita: "un dragón cruzó el puente" },
  ],
  turnos: [],
  puntos: [],
  glosario: [
    { termino: "crecida", definicion: "Subida fuerte del agua de un río.", ejemplo: "La crecida mojó la chacra." },
    { termino: "teleférico", definicion: "No está en el texto.", ejemplo: "-" },
  ],
  entidades: [
    { texto: "Rosa Quispe", tipo: "persona", contexto: "Ingeniera que dirigió la reparación." },
    { texto: "Presidente de la República", tipo: "persona", contexto: "Inventado." },
  ],
  cincoW: {
    que: "El puente de San Lucas estaba cerrado",
    quien: "la ingeniera Rosa Quispe",
    cuando: "el 2 de marzo de 2026",
    donde: "en Lima",
    porque: "una crecida dañó uno de sus pilares",
  },
};

describe("enrich (deterministic fallback)", () => {
  for (const s of SAMPLES) {
    it(`builds a valid document for ${s.id} without LLM`, async () => {
      const doc = await enrich(req({ article: s.article }), { llm: null });
      expect(() => EnrichedDocumentSchema.parse(doc)).not.toThrow();
      expect(doc.genero).toBe(s.generoEsperado);
      expect(doc.layout.id).toBe(layoutForGenre(s.generoEsperado).id);
      expect(() => layoutForGenre(doc.genero).schema.parse(doc.layout.data)).not.toThrow();
      expect(doc.meta).toMatchObject({ ia: false, modelo: null, generoFuente: "heuristica" });
      expect(doc.capas.glosario).toEqual([]);
      expect(doc.capas.karaoke.totalTokens).toBeGreaterThan(20);
      for (const e of doc.capas.entidades) expect(verify(doc.bloques, { texto: e.texto, fuente: e.fuente })).toBe(true);
    });
  }

  it("falls back when the LLM throws or returns null", async () => {
    for (const out of [new Error("boom"), null]) {
      const doc = await enrich(req({ article: sample("cronica-puente") }), { llm: new FakeLlm(out) });
      expect(doc.meta.ia).toBe(false);
      expect(doc.meta.avisos).toContain("llm_failed");
    }
  });

  it("respects generoForzado and default grade", async () => {
    const doc = await enrich(req({ article: sample("cronica-puente"), options: { generoForzado: "informativa" } }), { llm: null });
    expect(doc.genero).toBe("informativa");
    expect(doc.layout.id).toBe("piramide");
    expect(doc.meta.generoFuente).toBe("forzado");
    expect(doc.meta.grado).toBe(8);
  });

  it("merges timings into karaoke tokens", async () => {
    const doc = await enrich(
      req({ article: sample("cronica-puente"), options: { timings: [{ wordIndex: 0, startMs: 0, endMs: 250 }, { tokenId: "zz", startMs: 0, endMs: 1 }] } }),
      { llm: null },
    );
    expect(doc.capas.karaoke.conTiempos).toBe(true);
    expect(doc.capas.karaoke.bloques[0]!.tokens[0]).toMatchObject({ startMs: 0, endMs: 250 });
    expect(doc.meta.avisos).toContain("timings_ignored:1");
  });
});

describe("enrich (with LLM)", () => {
  it("uses grounded LLM content and drops hallucinations", async () => {
    const llm = new FakeLlm(ANALYSIS);
    const doc = await enrich(req({ article: sample("cronica-puente"), options: { grado: 9 } }), { llm });
    expect(EnrichedDocumentSchema.parse(doc)).toBeTruthy();
    expect(doc.meta).toMatchObject({ ia: true, modelo: "fake-model", generoFuente: "ia", grado: 9 });
    expect(doc.capas.glosario.map((g) => g.termino)).toEqual(["crecida"]);
    expect(doc.capas.entidades.some((e) => e.texto === "Presidente de la República")).toBe(false);
    expect(doc.capas.entidades.find((e) => e.texto === "Rosa Quispe")?.contexto).toBe("Ingeniera que dirigió la reparación.");
    expect(doc.capas.cincoW.donde).toBeNull();
    expect(doc.capas.cincoW.porque?.texto).toBe("una crecida dañó uno de sus pilares");
    const data = doc.layout.data as { eventos: Array<{ resumen: { texto: string } }> };
    expect(data.eventos).toHaveLength(2);
    // 1 glossary + 1 entity + 1 five-W + 1 event (+ its anchor)
    expect(doc.meta.descartados).toBeGreaterThanOrEqual(4);
    // glossary spans exist for every occurrence
    expect(doc.spans.some((s) => s.tipo === "glosario")).toBe(true);
    for (const s of doc.spans) {
      const b = doc.bloques.find((x) => x.id === s.bloqueId)!;
      expect(s.fin).toBeLessThanOrEqual(b.texto.length);
    }
  });
});
