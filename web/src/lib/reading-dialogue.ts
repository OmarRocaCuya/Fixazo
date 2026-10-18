/** A deterministic reading guide, not a general conversational model or judge. */
export const READING_LANGUAGES = ["spa_Latn", "quy_Latn", "ayr_Latn"] as const;
export type ReadingLanguage = typeof READING_LANGUAGES[number];
export const GUIDED_READING_OPENING = "Escucha y lee el texto a tu ritmo. Puedes pedir que repita o una pista. ¿Qué ocurre al comienzo?";

function literalFragment(passage: string): string {
  const first = passage.trim().split(/(?<=[.!?])\s+/u)[0] ?? "";
  if (first.length <= 64) return first;
  const prefix = first.slice(0, 64);
  const lastSpace = prefix.lastIndexOf(" ");
  return (lastSpace > 24 ? prefix.slice(0, lastSpace) : prefix).trim();
}

export function guidedReadingReply(passage: string, heardSpanish: string, turn: number): { replySpanish: string; kind: "repeat" | "hint" | "question" | "reflect" | "close" } {
  if (!passage.trim() || passage.length > 1500 || !heardSpanish.trim() || heardSpanish.length > 1500
    || !Number.isInteger(turn) || turn < 0 || turn > 8) throw new Error("invalid-reading-turn");
  const normalized = heardSpanish.normalize("NFD").replace(/[\u0300-\u036f]/gu, "").toLowerCase();
  const quote = `«${literalFragment(passage)}»`;
  if (/\b(repite|repitelo|repetir|otra vez|no escuche|no oi)\b/u.test(normalized)) {
    return { kind: "repeat", replySpanish: `Vuelve a leer ${quote}. ¿Qué ocurre en ese fragmento?` };
  }
  if (/\b(ayuda|pista|no se|no entiendo|dime la respuesta|dame la respuesta|responde tu)\b/u.test(normalized)) {
    return { kind: "hint", replySpanish: `Busca una pista en ${quote}. ¿Qué idea propones a partir de esas palabras?` };
  }
  if (/[?¿]/u.test(heardSpanish) || /^(?:y\s+)?(?:por que|como|que significa|que quiere decir)\b/u.test(normalized.trim())) {
    return { kind: "question", replySpanish: `Para explorar tu pregunta, relee ${quote}. ¿Qué relación encuentras?` };
  }
  if (turn === 8) return { kind: "close", replySpanish: `Podemos cerrar la práctica. Relee ${quote} y cuenta la idea principal con tus palabras.` };
  const prompts = [
    "¿Qué palabra del texto apoya tu idea?",
    "¿Qué cambia entre el comienzo y el final?",
    "¿Cómo explicarías esa relación con tus palabras?",
    "¿Qué otra pista del texto quieres revisar?",
  ];
  return { kind: "reflect", replySpanish: `Volvamos a ${quote}. ${prompts[turn % prompts.length]}` };
}
