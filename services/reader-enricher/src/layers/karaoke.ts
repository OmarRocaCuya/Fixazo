import type { Bloque, Karaoke, Timing } from "../types.ts";

/** Words, numbers with inner separators ("16.200", "3,5") and contractions stay as one token. */
const TOKEN_RE = /[\p{L}\p{N}]+(?:['’.,\-][\p{L}\p{N}]+)*/gu;

/** Pure, deterministic word tokenization of every block. Never uses the LLM. */
export function tokenize(blocks: Bloque[]): Karaoke {
  let i = 0;
  const bloques = blocks.map((b) => {
    let n = 0;
    const tokens = [...b.texto.matchAll(TOKEN_RE)].map((m) => ({
      id: `${b.id}-${n++}`,
      i: i++,
      texto: m[0],
      inicio: m.index!,
      fin: m.index! + m[0].length,
    }));
    return { bloqueId: b.id, tokens };
  });
  return { totalTokens: i, conTiempos: false, bloques };
}

/** Attaches external word timings (TTS boundaries, CTC alignment) by tokenId or global wordIndex. */
export function mergeTimings(karaoke: Karaoke, timings: Timing[] = []) {
  const copy: Karaoke = {
    ...karaoke,
    bloques: karaoke.bloques.map((b) => ({ ...b, tokens: b.tokens.map((t) => ({ ...t })) })),
  };
  const byId = new Map(copy.bloques.flatMap((b) => b.tokens.map((t) => [t.id, t] as const)));
  const byIndex = new Map(copy.bloques.flatMap((b) => b.tokens.map((t) => [t.i, t] as const)));
  let aplicados = 0;
  let ignorados = 0;
  for (const tm of timings) {
    const tok = tm.tokenId !== undefined ? byId.get(tm.tokenId) : byIndex.get(tm.wordIndex ?? -1);
    if (!tok || tm.endMs < tm.startMs) {
      ignorados++;
      continue;
    }
    tok.startMs = tm.startMs;
    tok.endMs = tm.endMs;
    aplicados++;
  }
  copy.conTiempos = aplicados > 0;
  return { karaoke: copy, aplicados, ignorados };
}
