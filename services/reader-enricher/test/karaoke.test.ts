import { describe, expect, it } from "vitest";
import { mergeTimings, tokenize } from "../src/layers/karaoke.ts";
import { blocksOf } from "./helpers.ts";

describe("karaoke tokenizer", () => {
  const blocks = blocksOf("datos-agua");
  const k = tokenize(blocks);

  it("tokenizes every block with exact char offsets", () => {
    expect(k.bloques.map((b) => b.bloqueId)).toEqual(blocks.map((b) => b.id));
    for (const kb of k.bloques) {
      const texto = blocks.find((b) => b.id === kb.bloqueId)!.texto;
      for (const t of kb.tokens) expect(texto.slice(t.inicio, t.fin)).toBe(t.texto);
    }
  });

  it("assigns stable ids and a global word index", () => {
    const all = k.bloques.flatMap((b) => b.tokens);
    expect(all.map((t) => t.i)).toEqual(all.map((_, i) => i));
    expect(k.totalTokens).toBe(all.length);
    expect(all[0]!.id).toBe("h-0");
    expect(tokenize(blocks)).toEqual(k);
  });

  it("keeps numbers with separators and accented words as single tokens", () => {
    const words = k.bloques.flatMap((b) => b.tokens.map((t) => t.texto));
    expect(words).toContain("16.200");
    expect(words).toContain("cuánta");
    expect(words).not.toContain(",");
  });

  it("merges timings by tokenId or wordIndex and ignores invalid ones", () => {
    const r = mergeTimings(k, [
      { tokenId: "h-0", startMs: 0, endMs: 200 },
      { wordIndex: 1, startMs: 200, endMs: 400 },
      { wordIndex: 99999, startMs: 0, endMs: 10 },
      { tokenId: "h-2", startMs: 500, endMs: 100 },
    ]);
    const toks = r.karaoke.bloques[0]!.tokens;
    expect(toks[0]).toMatchObject({ startMs: 0, endMs: 200 });
    expect(toks[1]).toMatchObject({ startMs: 200, endMs: 400 });
    expect(toks[2]!.startMs).toBeUndefined();
    expect(r.aplicados).toBe(2);
    expect(r.ignorados).toBe(2);
    expect(r.karaoke.conTiempos).toBe(true);
    expect(k.conTiempos).toBe(false);
  });
});
