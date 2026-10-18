import { describe, expect, it } from "vitest";
import { classifyHeuristic } from "../src/genre/heuristics.ts";
import { resolveGenre } from "../src/genre/classify.ts";
import { SAMPLES } from "../src/demo/samples.ts";
import { blocksOf } from "./helpers.ts";

describe("heuristic genre classifier", () => {
  for (const s of SAMPLES) {
    it(`classifies ${s.id} as ${s.generoEsperado}`, () => {
      const r = classifyHeuristic(blocksOf(s.article));
      expect(r.genero).toBe(s.generoEsperado);
      expect(r.confianza).toBeGreaterThan(0);
      expect(r.confianza).toBeLessThanOrEqual(1);
    });
  }

  it("does not call a single-side article comparada", () => {
    const r = classifyHeuristic(
      blocksOf({ titular: "Algo", fragmentos: [{ lado: "a", texto: "La municipalidad abrió un parque nuevo en el distrito." }] }),
    );
    expect(r.genero).toBe("informativa");
  });
});

describe("resolveGenre", () => {
  const blocks = blocksOf("informativa-biblioteca");
  const heur = { genero: "informativa" as const, confianza: 0.5 };

  it("forced genre wins", () => {
    expect(resolveGenre({ blocks, forced: "opinion", llm: null, heuristic: heur })).toEqual({
      genero: "opinion",
      confianza: 1,
      fuente: "forzado",
    });
  });

  it("uses a confident LLM answer", () => {
    expect(resolveGenre({ blocks, llm: { genero: "cronica", confianza: 0.8 }, heuristic: heur })).toMatchObject({
      genero: "cronica",
      fuente: "ia",
    });
  });

  it("falls back to heuristics when the LLM is unsure or picks comparada without two sides", () => {
    expect(resolveGenre({ blocks, llm: { genero: "datos", confianza: 0.3 }, heuristic: heur }).fuente).toBe("heuristica");
    expect(resolveGenre({ blocks, llm: { genero: "comparada", confianza: 0.9 }, heuristic: heur }).genero).toBe("informativa");
  });

  it("refuses a forced comparada when there are not two sides", () => {
    expect(resolveGenre({ blocks, forced: "comparada", llm: null, heuristic: heur }).genero).toBe("informativa");
  });
});
