// Ayudas para responder las opciones con la voz usando el ASR de Meta (sin reconocedor del navegador).
// 1. Segmentador: corta el audio en las pausas en vez de cada 8 s fijos (menos espera y no parte palabras).
// 2. elegirOpcion: no exige transcripción perfecta; elige la opción que más se parece a lo dicho.

/** Lo mínimo de un FrameFeature del AudioAnalyzer: tiempo en ms y si hay voz. */
export interface CuadroVoz { t: number; voiced: boolean }

/**
 * Decide cuándo mandar el pedazo de audio al ASR: tras una pausa de `silencioMs` después de haber hablado,
 * o al llegar a `maxMs`. Uso: por cada cuadro del analizador, `if (seg.push(f) === "cortar") enviarPedazo()`.
 */
export class Segmentador {
  private inicio: number | null = null;
  private ultimaVoz: number | null = null;
  constructor(private readonly silencioMs = 700, private readonly maxMs = 8000, private readonly minVozMs = 250) {}

  push(f: CuadroVoz): "cortar" | null {
    if (f.voiced) {
      this.inicio ??= f.t;
      this.ultimaVoz = f.t;
    }
    if (this.inicio === null || this.ultimaVoz === null) return null; // todavía no habló
    const huboVoz = this.ultimaVoz - this.inicio >= this.minVozMs;
    const pausa = !f.voiced && f.t - this.ultimaVoz >= this.silencioMs;
    if ((huboVoz && pausa) || f.t - this.inicio >= this.maxMs) {
      this.inicio = this.ultimaVoz = null;
      return "cortar";
    }
    return null;
  }
}

const VACIAS = new Set("el la los las un una unos unas de del al y o u e en que por para con sin se su sus es son lo le les como mas pero ya a ante sobre tras porque creo pienso que mi me yo eso esto esta este".split(" "));
const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9ñ\s]/g, " ").replace(/\s+/g, " ").trim();
const claves = (s: string) => norm(s).split(" ").filter((w) => w.length > 2 && !VACIAS.has(w));

/** Distancia de edición, para tolerar errores del ASR ("cimientata" ~ "sementata"). */
function distancia(a: string, b: string): number {
  const d = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0];
    d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return d[b.length];
}
const parecida = (w: string, x: string) => w === x || (Math.min(w.length, x.length) >= 5 && distancia(w, x) <= Math.floor(Math.max(w.length, x.length) / 4));

const ORDINALES: Array<[RegExp, number]> = [
  [/\b(primera|primero|uno|1)\b|\b(opcion|letra|la)\s+a\b|^a$/, 0],
  [/\b(segunda|segundo|dos|2)\b|\b(opcion|letra|la)\s+b\b|^b$/, 1],
  [/\b(tercera|tercero|tres|3)\b|\b(opcion|letra|la)\s+c\b|^c$/, 2],
  [/\b(cuarta|cuarto|cuatro|4)\b|\b(opcion|letra|la)\s+d\b|^d$/, 3],
];

/** Elige la opción que corresponde a lo dicho, o null si no está claro (entonces se pide repetir o tocar). */
export function elegirOpcion(dicho: string, opciones: string[]): { indice: number | null; puntaje: number } {
  const t = norm(dicho);
  if (!t) return { indice: null, puntaje: 0 };
  for (const [re, k] of ORDINALES) if (k < opciones.length && re.test(t)) return { indice: k, puntaje: 1 };

  const palabras = claves(dicho);
  const puntajes = opciones.map((o) => {
    const c = [...new Set(claves(o))];
    if (!c.length) return 0;
    return c.filter((x) => palabras.some((w) => parecida(w, x))).length / c.length;
  });
  const orden = puntajes.map((p, k) => [p, k] as const).sort((a, b) => b[0] - a[0]);
  const [mejor, segundo = [0, -1] as const] = orden;
  // ponytail: umbrales fijos; ajustar con grabaciones reales si se equivoca mucho.
  return mejor[0] >= 0.34 && mejor[0] - segundo[0] >= 0.15 ? { indice: mejor[1], puntaje: mejor[0] } : { indice: null, puntaje: mejor[0] };
}
