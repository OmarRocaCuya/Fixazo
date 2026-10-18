// Reglas deterministas del periódico: todo lo que se puede decidir sin IA se decide aquí.
import type { Criterio, RespuestaVoz } from "./tipos";

export function normalizar(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const contar = (s: string) => (s ? s.split(" ").length : 0);

/** La IA debe citar la frase del alumno que prueba cada criterio; si no aparece literal, no cuenta. */
export function citaValida(cita: string, texto: string): boolean {
  const c = normalizar(cita);
  return c.length >= 3 && normalizar(texto).includes(c);
}

const PIDE = /\b(no se|no lo se|dime|dimelo|cual es la respuesta|dame la respuesta|no entiendo|ni idea)\b/;

/** Antes de gastar una llamada: respuesta muy corta o pidiendo la solución. */
export function revisarTexto(texto: string): "pide" | "corta" | null {
  const n = normalizar(texto);
  if (PIDE.test(n) && contar(n) < 8) return "pide";
  if (contar(n) < 4) return "corta";
  return null;
}

export const PLANTILLAS = {
  corta: "Cuéntame un poco más: ¿por qué lo piensas así?",
  pide: "No te voy a dar la respuesta, pero te ayudo a encontrarla.",
  bien: "Bien visto: apoyaste tu idea en lo que dice la noticia.",
} as const;

/** Une lo que dijo la IA con los criterios; lo desconocido o sin cita literal se descarta. */
export function validarCriterios(
  ia: Array<{ id: string; cumple: boolean; cita: string }> | undefined,
  criterios: Criterio[],
  texto: string,
): RespuestaVoz["criterios"] {
  return criterios.map((c) => {
    const e = ia?.find((x) => x.id === c.id);
    const cumple = Boolean(e?.cumple) && citaValida(e?.cita ?? "", texto);
    return { id: c.id, nombre: c.nombre, cumple, cita: cumple ? (e?.cita ?? "") : "", dudoso: Boolean(e?.cumple) && !cumple };
  });
}

/** Guardia: bloquea retroalimentación que revela la respuesta (frases que el alumno no dijo) o se alarga. */
export function guardia(retro: string, prohibido: string[], texto: string): boolean {
  const r = normalizar(retro);
  const t = normalizar(texto);
  if (!r || contar(r) > 60) return false;
  return !prohibido.some((f) => {
    const n = normalizar(f);
    return r.includes(n) && !t.includes(n);
  });
}

/**
 * Combina las corridas del juez (3, como el juez de Daniel): un criterio cumple si la mayoría
 * de las corridas que respondieron lo marca con una cita literal; es "dudoso" si no coinciden.
 */
export function agregarCorridas(
  corridas: Array<{ criterios: Array<{ id: string; cumple: boolean; cita: string }>; retro: string }>,
  criterios: Criterio[],
  texto: string,
): RespuestaVoz["criterios"] {
  return criterios.map((c) => {
    const votos = corridas.map((k) => {
      const e = k.criterios.find((x) => x.id === c.id);
      return e?.cumple && citaValida(e.cita, texto) ? e.cita : null;
    });
    const si = votos.filter(Boolean) as string[];
    const cumple = corridas.length > 0 && si.length * 2 > corridas.length;
    const unanime = si.length === 0 || si.length === corridas.length;
    return { id: c.id, nombre: c.nombre, cumple, cita: cumple ? si[0] : "", dudoso: !unanime };
  });
}
