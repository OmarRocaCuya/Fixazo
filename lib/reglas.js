// Reglas deterministas: todo lo que se puede decidir sin IA se decide aquí.

export const normalizar = (s) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const contar = (s) => (s ? s.split(' ').length : 0);

// La IA debe citar la frase del alumno que prueba cada criterio; si no está literal, no cuenta.
export function citaValida(cita, texto) {
  const c = normalizar(cita);
  return c.length >= 3 && normalizar(texto).includes(c);
}

const PIDE = /\b(no se|no lo se|dime|dimelo|cual es la respuesta|dame la respuesta|no entiendo|ni idea)\b/;

// Antes de gastar una llamada: respuesta vacía, muy corta o pidiendo la solución.
export function revisarTexto(texto) {
  const n = normalizar(texto);
  if (PIDE.test(n) && contar(n) < 8) return 'pide';
  if (contar(n) < 4) return 'corta';
  return null;
}

export const PLANTILLAS = {
  corta: 'Cuéntame un poco más: ¿por qué lo piensas así?',
  pide: 'No te voy a dar la respuesta, pero te ayudo a encontrarla.',
  error: 'Sigamos pensando juntos.',
  bien: 'Bien visto. Pasemos a lo siguiente.',
};

// Parte cerrada de cada pregunta: elegir, ordenar o tocar.
export function revisarCodigo(p, r = {}) {
  const k = p.privado ?? {};
  if (p.eleccion) return { ok: r.eleccion === k.eleccion_correcta };
  if (p.orden) return { ok: p.orden.afirmaciones.every((_, i) => r.orden?.[i] === k.orden_correcto[i]) };
  if (p.tocar) return { ok: (k.toques_correctos ?? []).includes(r.toque) };
  return { ok: null };
}

// Une lo que dijo la IA con los criterios del caso; lo desconocido o sin cita se descarta.
export function validarCriterios(llm = [], criterios = [], texto = '') {
  return criterios.map((c) => {
    const e = llm.find((x) => x.id === c.id);
    const cumple = Boolean(e?.cumple) && citaValida(e.cita, texto);
    return { id: c.id, nombre: c.nombre, cumple, cita: cumple ? e.cita : '', dudoso: Boolean(e?.cumple) && !cumple };
  });
}

// Guardia: bloquea retroalimentación que revela la respuesta o se alarga.
export function guardia(retro, prohibido = [], texto = '') {
  const r = normalizar(retro);
  const t = normalizar(texto);
  if (!r || contar(r) > 60) return false;
  return !prohibido.some((f) => {
    const n = normalizar(f);
    return r.includes(n) && !t.includes(n);
  });
}

// 0 = básico, 1 = emergente, 2 = competente.
export function calcularNivel(criterios, codigoOk) {
  const n = criterios.filter((c) => c.cumple).length;
  if (n === criterios.length && codigoOk !== false) return 2;
  return n > 0 || codigoOk ? 1 : 0;
}
