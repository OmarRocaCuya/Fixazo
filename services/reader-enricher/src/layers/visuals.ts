import { bodyBlocks } from "../blocks.ts";
import { verify } from "../guards/grounding.ts";
import { CLOCK_RE, DATE_RE, splitSentences } from "../text.ts";
import type { Bloque, Cifra, Cita, Visuales } from "../types.ts";

/**
 * Inline mini-visuals detected deterministically from the text. No LLM is involved, so
 * every value is, by construction, a literal match; we still re-verify before returning.
 */

const FIGURE_RE =
  /(?<![\p{L}\p{N}:.,])(\d{1,3}(?:\.\d{3})+|\d+(?:,\d+)?)(?![\p{N}:])(?:\s+(millones|mil))?(?:\s*(%|por ciento)|\s+(\p{L}+)(?:\s+((?:al|por|cada) (?:día|mes|año|semana|hora)))?)?/gu;

const UNIT_STOPWORDS = new Set(
  "de del en y a al la el los las que o con por para se es son mientras durante veces entre hasta desde cuando como más menos".split(" "),
);

export function parseSpanishNumber(text: string): number {
  const m = text.trim().match(/^(\d{1,3}(?:\.\d{3})+|\d+(?:,\d+)?)(?:\s+(millones|mil))?/u);
  if (!m) return Number.NaN;
  const base = Number(m[1]!.replace(/\./g, "").replace(",", "."));
  const mult = m[2] === "mil" ? 1_000 : m[2] === "millones" ? 1_000_000 : 1;
  return base * mult;
}

function protectedRanges(text: string): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const re of [DATE_RE, CLOCK_RE]) {
    for (const m of text.matchAll(new RegExp(re.source, "giu"))) out.push([m.index!, m.index! + m[0].length]);
  }
  return out;
}

function sentenceAt(text: string, pos: number) {
  return splitSentences(text).find((s) => pos >= s.inicio && pos < s.fin) ?? null;
}

/** All literal figures (number + optional multiplier + unit) in body blocks, excluding dates, times and bare years. */
export function detectFigures(blocks: Bloque[]): Cifra[] {
  const out: Cifra[] = [];
  for (const b of bodyBlocks(blocks)) {
    const ranges = protectedRanges(b.texto);
    for (const m of b.texto.matchAll(FIGURE_RE)) {
      const inicio = m.index!;
      if (ranges.some(([s, e]) => inicio >= s && inicio < e)) continue;
      const [, num, mult, pct, word, per] = m;
      let unidad = "";
      let fin = inicio + num!.length;
      if (mult) fin = inicio + m[0].indexOf(mult, num!.length) + mult.length;
      if (pct) {
        unidad = "%";
        fin = inicio + m[0].length;
      } else if (word && !UNIT_STOPWORDS.has(word.toLowerCase())) {
        unidad = per ? `${word.toLowerCase()} ${per}` : word.toLowerCase();
        fin = inicio + m[0].length;
      }
      const valor = parseSpanishNumber(b.texto.slice(inicio, fin));
      if (!Number.isFinite(valor)) continue;
      if (!unidad && !mult && /^(19|20)\d{2}$/.test(num!)) continue;
      const texto = b.texto.slice(inicio, fin);
      const s = sentenceAt(b.texto, inicio);
      out.push({
        id: `c${out.length}`,
        valor,
        texto,
        unidad,
        etiqueta: s ? truncate(s.texto, 120) : texto,
        fuente: { bloqueId: b.id, inicio, fin },
      });
    }
  }
  return out.filter((c) => verify(blocks, c) && parseSpanishNumber(c.texto) === c.valor);
}

function truncate(s: string, n: number) {
  return s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`;
}

function unitKey(u: string) {
  return u === "%" ? u : u.replace(/(\p{L})s\b/u, "$1");
}

export function detectVisuals(blocks: Bloque[]): Visuales {
  // Comparable figures: same unit, at least two distinct values.
  const groups = new Map<string, Cifra[]>();
  for (const c of detectFigures(blocks)) {
    if (!c.unidad) continue;
    const k = unitKey(c.unidad);
    groups.set(k, [...(groups.get(k) ?? []), c]);
  }
  const cifras: Visuales["cifras"] = [];
  for (const list of groups.values()) {
    if (new Set(list.map((c) => c.valor)).size < 2) continue;
    const max = Math.max(...list.map((c) => c.valor));
    cifras.push({
      id: `v${cifras.length}`,
      unidad: list[0]!.unidad,
      max,
      barras: list.map((c) => ({ ...c, proporcion: max > 0 ? Math.round((c.valor / max) * 1000) / 1000 : 0 })),
    });
  }

  // Dated events: calendar dates and the sentence they belong to, in reading order.
  const timeline: Visuales["timeline"] = [];
  const seen = new Set<string>();
  for (const b of bodyBlocks(blocks)) {
    for (const m of b.texto.matchAll(new RegExp(DATE_RE.source, "giu"))) {
      const s = sentenceAt(b.texto, m.index!);
      if (!s) continue;
      const key = `${b.id}:${s.inicio}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const fecha: Cita = { texto: m[0], fuente: { bloqueId: b.id, inicio: m.index!, fin: m.index! + m[0].length } };
      const evento: Cita = { texto: s.texto, fuente: { bloqueId: b.id, inicio: s.inicio, fin: s.fin } };
      if (verify(blocks, fecha) && verify(blocks, evento)) timeline.push({ id: `t${timeline.length}`, fecha, evento });
    }
  }
  return { timeline, cifras };
}
