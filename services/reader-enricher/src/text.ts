/** Small pure text helpers shared by layers and layouts. */

export interface Segment {
  texto: string;
  inicio: number;
  fin: number;
}

const END = new Set([".", "!", "?", "…"]);
const CLOSERS = new Set(["»", '"', "”", "’", "'", ")"]);

/** Splits text into sentences, keeping exact char offsets. Decimal/thousand separators do not split. */
export function splitSentences(text: string): Segment[] {
  const out: Segment[] = [];
  let start = 0;
  const push = (end: number) => {
    const raw = text.slice(start, end);
    const lead = raw.length - raw.trimStart().length;
    const trimmed = raw.trim();
    if (trimmed) out.push({ texto: trimmed, inicio: start + lead, fin: start + lead + trimmed.length });
  };
  for (let i = 0; i < text.length; i++) {
    if (!END.has(text[i]!)) continue;
    let j = i + 1;
    while (j < text.length && (END.has(text[j]!) || CLOSERS.has(text[j]!))) j++;
    if (j >= text.length || /\s/.test(text[j]!)) {
      push(j);
      start = j;
      i = j - 1;
    }
  }
  if (start < text.length) push(text.length);
  return out;
}

export function countWords(text: string): number {
  return text.match(/[\p{L}\p{N}]+/gu)?.length ?? 0;
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const MONTHS = "enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre";

/** Calendar dates: "2 de marzo de 2026", "marzo de 2026", "2 de marzo", "en 2026". */
export const DATE_RE = new RegExp(
  `\\b(?:\\d{1,2} de (?:${MONTHS})(?: de(?:l)? \\d{4})?|(?:${MONTHS}) de(?:l)? \\d{4}|(?<=\\b(?:en|desde|hasta|el año) )(?:19|20)\\d{2})\\b`,
  "giu",
);

/** Time-of-day anchors typical of chronicles. */
export const CLOCK_RE = /\b(?:a las \d{1,2}(?::\d{2})?(?: (?:de la (?:mañana|tarde|noche)|horas|h))?|al mediodía|a medianoche|al amanecer|al anochecer|por la (?:mañana|tarde|noche)|en la madrugada)\b/giu;
