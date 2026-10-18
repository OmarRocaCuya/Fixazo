import { describe, expect, it } from "vitest";
import { locate, locateAll, verify } from "../src/guards/grounding.ts";
import { blocksOf, textAt } from "./helpers.ts";

const blocks = blocksOf("cronica-puente");

describe("grounding guard", () => {
  it("locates a literal substring and returns exact offsets", () => {
    const c = locate(blocks, "Rosa Quispe");
    expect(c).not.toBeNull();
    expect(textAt(blocks, c!.fuente)).toBe("Rosa Quispe");
    expect(c!.texto).toBe("Rosa Quispe");
  });

  it("matches case-insensitively and strips wrapping quotes, returning source casing", () => {
    const c = locate(blocks, "«rosa quispe»");
    expect(c?.texto).toBe("Rosa Quispe");
  });

  it("tolerates collapsed whitespace in the needle", () => {
    const c = locate(blocks, "los  primeros\nvecinos");
    expect(c?.texto).toBe("los primeros vecinos");
  });

  it("returns null when text is not in the source (hallucination)", () => {
    expect(locate(blocks, "Pedro Castillo")).toBeNull();
    expect(locate(blocks, "")).toBeNull();
    expect(locate(blocks, "a")).toBeNull();
  });

  it("restricts the search to given block ids", () => {
    expect(locate(blocks, "Rosa Quispe", { bloqueIds: ["f0p0"] })).toBeNull();
    expect(locate(blocks, "Rosa Quispe", { bloqueIds: ["f0p1"] })).not.toBeNull();
  });

  it("finds all whole-word occurrences", () => {
    const all = locateAll(blocks, "puente");
    expect(all.length).toBeGreaterThanOrEqual(3);
    for (const f of all) expect(textAt(blocks, f).toLowerCase()).toBe("puente");
  });

  it("verify accepts real fuentes and rejects forged ones", () => {
    const c = locate(blocks, "Martín Huamán")!;
    expect(verify(blocks, c)).toBe(true);
    expect(verify(blocks, { texto: "Martín Huamán", fuente: { ...c.fuente, inicio: 0, fin: 13 } })).toBe(false);
    expect(verify(blocks, { texto: "x", fuente: { bloqueId: "nope", inicio: 0, fin: 1 } })).toBe(false);
    expect(verify(blocks, { texto: "Martín Huamán", fuente: { ...c.fuente, fin: 9999 } })).toBe(false);
  });
});
