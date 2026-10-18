import { bodyBlocks, hasTwoSides } from "../blocks.ts";
import { CLOCK_RE, DATE_RE, countWords } from "../text.ts";
import type { Bloque, Genero } from "../types.ts";

export interface GenreGuess {
  genero: Genero;
  confianza: number;
}

const DIALOG_LINE = /^\s*(?:[—–-]|(?:P|R|Pregunta|Respuesta)\s*[:.])/u;
const OPINION_MARKERS =
  /\b(?:creo que|en mi opinión|a mi juicio|considero|pienso que|opino|me parece|debemos|deberían|deberíamos|es necesario|es un error|hay que|nosotros|nuestr[oa]s?)\b/giu;
const NUMBER_RE = /\b\d+(?:[.,]\d+)*\b/g;

const count = (re: RegExp, text: string) => text.match(re)?.length ?? 0;

/** Deterministic genre guess used when there is no LLM (or it fails). Order matters. */
export function classifyHeuristic(blocks: Bloque[]): GenreGuess {
  const body = bodyBlocks(blocks);
  const text = body.map((b) => b.texto).join("\n");
  const words = Math.max(1, countWords(text));

  if (hasTwoSides(blocks)) return { genero: "comparada", confianza: 0.9 };

  const dialogLines = body.filter((b) => DIALOG_LINE.test(b.texto)).length;
  const questions = body.filter((b) => DIALOG_LINE.test(b.texto) && b.texto.includes("?")).length;
  if (dialogLines >= 4 && dialogLines / body.length >= 0.5 && questions >= 2) {
    return { genero: "entrevista", confianza: 0.85 };
  }

  const anchoredParagraphs = body.filter((b) => {
    const head = b.texto.slice(0, 40);
    return new RegExp(CLOCK_RE.source, "iu").test(head) || new RegExp(DATE_RE.source, "iu").test(head);
  }).length;
  const timeMarks = count(CLOCK_RE, text) + count(DATE_RE, text);
  if (anchoredParagraphs >= 2 || (timeMarks >= 4 && (timeMarks / words) * 100 >= 2)) {
    return { genero: "cronica", confianza: Math.min(0.9, 0.6 + 0.1 * Math.min(anchoredParagraphs, 3)) };
  }

  const opinion = count(OPINION_MARKERS, text);
  if (opinion >= 3) return { genero: "opinion", confianza: Math.min(0.85, 0.55 + 0.05 * opinion) };

  const numbers = count(NUMBER_RE, text);
  const density = numbers / words;
  if (numbers >= 5 && density >= 0.05) return { genero: "datos", confianza: Math.min(0.85, 0.6 + density) };

  return { genero: "informativa", confianza: 0.5 };
}
