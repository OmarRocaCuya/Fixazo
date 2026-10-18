import { describe, expect, it } from "vitest";
import { blocksOf } from "./helpers.ts";
import { splitSentences } from "../src/text.ts";

describe("buildBlocks", () => {
  it("creates titular, bajada and one block per paragraph with stable ids", () => {
    const blocks = blocksOf("cronica-puente");
    expect(blocks[0]).toMatchObject({ id: "h", rol: "titular", fragmento: null });
    expect(blocks[1]).toMatchObject({ id: "s", rol: "bajada" });
    const body = blocks.filter((b) => b.rol === "cuerpo");
    expect(body).toHaveLength(5);
    expect(body.map((b) => b.id)).toEqual(["f0p0", "f0p1", "f0p2", "f0p3", "f0p4"]);
    expect(body[0]!.medio).toBe("Diario Escolar (ficticio)");
  });

  it("keeps side (lado) and fragment titular for compared fragments", () => {
    const blocks = blocksOf("comparada-parque");
    const a = blocks.filter((b) => b.lado === "a");
    const b = blocks.filter((x) => x.lado === "b");
    expect(a.some((x) => x.rol === "titular" && x.id === "f0t")).toBe(true);
    expect(b.some((x) => x.rol === "cuerpo")).toBe(true);
  });

  it("splits interview lines on single newlines", () => {
    const body = blocksOf("entrevista-astronoma").filter((b) => b.rol === "cuerpo");
    expect(body).toHaveLength(6);
    expect(body[0]!.texto.startsWith("—¿Cuándo")).toBe(true);
  });
});

describe("splitSentences", () => {
  it("returns sentences with exact offsets", () => {
    const t = "Hola mundo. ¿Qué tal? Bien.";
    const s = splitSentences(t);
    expect(s.map((x) => x.texto)).toEqual(["Hola mundo.", "¿Qué tal?", "Bien."]);
    for (const x of s) expect(t.slice(x.inicio, x.fin)).toBe(x.texto);
  });

  it("does not split on decimal or thousands separators", () => {
    expect(splitSentences("Son 16.200 litros. Fin.")).toHaveLength(2);
  });
});
