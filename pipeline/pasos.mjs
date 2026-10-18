// Pasos deterministas del pipeline de noticias: filtrar, verificar citas y armar la estructura fija.
// Todo lo que decide la calidad sin IA vive aquí y tiene pruebas en pasos.test.mjs.

export const normalizar = (s) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[«»"“”'‘’]/g, '')
    .replace(/[^\p{L}\p{N}%\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const palabras = (s) => (normalizar(s) ? normalizar(s).split(' ').length : 0);

// Texto extraído en Markdown → solo párrafos de contenido.
export function limpiarTexto(md) {
  return String(md ?? '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_#>|`]/g, ' ')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.split(' ').length >= 12)
    .join('\n');
}

const BLOQUEADOS = /(facebook|x\.com|twitter|instagram|tiktok|youtube|linkedin|reddit|pinterest|telegram|whatsapp|medium\.com|substack|blogspot|\.pdf)/i;
// Temas que no mostramos a menores de 12 a 16 años.
const SENSIBLES = /(suicid|autolesi|se quit\w* la vida|abuso sexual|violaci|pornogra|desnud|intim\w* falsa|fotos intimas|asesin|decapit|masacre|tortur)/i;

export const esSensible = (texto) => SENSIBLES.test(normalizar(texto));

export function filtrarCandidatas(resultados, usadas = new Set()) {
  const vistos = new Set();
  return resultados.filter((r) => {
    const url = r.url ?? '';
    if (!url.startsWith('https://') || BLOQUEADOS.test(url) || usadas.has(url) || vistos.has(url)) return false;
    vistos.add(url);
    if (esSensible(`${r.title} ${r.content}`)) return false;
    return palabras(r.title) >= 5;
  });
}

const PALABRAS_VACIAS = new Set('el la los las un una de del al y o en que por para con sin se su sus es son lo como mas pero ya a ante sobre tras'.split(' '));
const claves = (t) => new Set(normalizar(t).split(' ').filter((w) => w.length > 3 && !PALABRAS_VACIAS.has(w)));

/** ¿Dos titulares hablan del mismo hecho? Comparten al menos `min` palabras clave. */
export function mismoHecho(a, b, min = 3) {
  const ka = claves(a);
  let n = 0;
  for (const w of claves(b)) if (ka.has(w)) n++;
  return n >= min;
}

export const dominio = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

/** Cada segmento de una cita tiene que estar literal (normalizado) en el texto fuente. */
export function citaLiteral(cita, fuente) {
  const f = normalizar(fuente);
  const segmentos = String(cita).split(/\(…\)|\(\.\.\.\)|…/).map(normalizar).filter(Boolean);
  return segmentos.length > 0 && segmentos.every((s) => s.length >= 8 && f.includes(s));
}

const SEGURIDAD = ['Poco', 'Más o menos', 'Muy seguro'];

/** Valida lo que generó la IA. Devuelve la lista de problemas (vacía = válida). */
export function validarGeneracion(g, textoA, textoB) {
  const e = [];
  if (!g || typeof g !== 'object') return ['Salida vacía'];
  if (!g.apta) return [`No apta: ${g.motivo_no_apta || 'sin motivo'}`];
  if (palabras(g.titular) < 3 || palabras(g.titular) > 12) e.push('El titular debe tener entre 3 y 12 palabras');
  for (const [k, fr, src] of [['fragmento_a', g.fragmento_a, textoA], ['fragmento_b', g.fragmento_b, textoB || textoA]]) {
    const citas = fr?.citas ?? [];
    if (!citas.length) e.push(`${k}: sin citas`);
    citas.forEach((c, i) => !citaLiteral(c, src) && e.push(`${k}.citas[${i}] no está literal en la nota`));
    const total = citas.reduce((n, c) => n + palabras(c), 0);
    if (total > 90) e.push(`${k}: más de 90 palabras (${total})`);
  }
  if (g.mirada_a && !citaLiteral(g.mirada_a, textoA)) e.push('mirada_a no es textual');
  if (g.mirada_b && !citaLiteral(g.mirada_b, textoB || textoA)) e.push('mirada_b no es textual');
  for (const k of ['comprension', 'procedencia', 'variable']) {
    const q = g[k];
    if (!q?.titulo || !Array.isArray(q.opciones) || q.opciones.length < 2) e.push(`${k}: faltan título u opciones`);
    else if (!Number.isInteger(q.correcta) || !q.opciones[q.correcta]) e.push(`${k}: la opción correcta no existe`);
  }
  // Las respuestas correctas no pueden depender de datos que el joven no leyó.
  const visibleFragmentos = normalizar([...(g.fragmento_a?.citas ?? []), ...(g.fragmento_b?.citas ?? [])].join(' '));
  for (const k of ['comprension', 'procedencia', 'variable']) {
    const correcta = g[k]?.opciones?.[g[k]?.correcta];
    for (const num of String(correcta ?? '').match(/\d+(?:[.,]\d+)?/g) ?? []) {
      if (!visibleFragmentos.includes(normalizar(num))) e.push(`${k}: la respuesta usa «${num}», que no está en los fragmentos`);
    }
  }
  if (!['dato_o_afirmacion', 'palabra_que_convence', 'hecho_u_opinion', 'como_comprobarlo'].includes(g.variable?.tipo)) e.push('variable: tipo desconocido');
  if (!g.prediccion?.opciones?.length || !g.postura?.opciones?.length) e.push('Faltan predicción o postura');
  const v = g.voz;
  if (!v?.titulo || (v.criterios ?? []).length < 2) e.push('voz: necesita título y 2 criterios');
  (v?.criterios ?? []).forEach((c, i) => ['id', 'nombre', 'descripcion', 'repregunta'].forEach((f) => !c?.[f] && e.push(`voz.criterios[${i}].${f} vacío`)));
  if (!(v?.pistas ?? []).length) e.push('voz: sin pistas');
  const visible = JSON.stringify([g.titular, g.bajada, g.fragmento_a, g.fragmento_b, g.comprension, g.procedencia, g.variable, v?.titulo]);
  if (esSensible(visible)) e.push('Contenido sensible para menores');
  return e;
}

const fragmento = (lado, fuente, fr) => ({
  tipo: 'fragmento',
  lado,
  medio: fuente.medio,
  fecha: fuente.fecha,
  titular: fuente.titular,
  texto: fr.citas.join(' (…) '),
  url: fuente.url,
});
const opciones = (id, etiqueta, q, habilidad) => ({
  tipo: 'opciones',
  id,
  etiqueta,
  titulo: q.titulo,
  opciones: q.opciones,
  correcta: q.correcta ?? null,
  bien: q.bien ?? 'Bien visto.',
  otra: q.otra ?? 'Fíjate otra vez en el texto.',
  habilidad,
});

const HABILIDAD_VARIABLE = {
  dato_o_afirmacion: 'Separar un dato de una afirmación',
  palabra_que_convence: 'Ver qué palabras buscan convencer',
  hecho_u_opinion: 'Separar hechos de opiniones',
  como_comprobarlo: 'Pensar cómo comprobarlo',
};

/**
 * Estructura fija (siempre igual; solo el paso 5 varía según la noticia):
 * 1 predicción · 2 fragmento A · 3 comprensión · 4 quién habla · 5 variable ·
 * 6 postura y seguridad · 7 contraprueba (fragmento B) y mantengo/cambio · 8 por qué con voz.
 */
export function armarNoticia(id, g, fuenteA, fuenteB) {
  const p = (n) => `Paso ${n} de 8`;
  return {
    id,
    seccion: g.seccion || 'Tecnología',
    titular: g.titular,
    bajada: g.bajada,
    minutos: 4,
    miradas: [
      { medio: fuenteA.medio, texto: g.mirada_a || null },
      { medio: (fuenteB ?? fuenteA).medio, texto: g.mirada_b || null },
    ],
    pasos: [
      { ...opciones(`${id}-prediccion`, `${p(1)} · antes de leer`, { ...g.prediccion, correcta: null, bien: 'Veamos si aciertas…', otra: 'Veamos si aciertas…' }, null) },
      fragmento('a', fuenteA, g.fragmento_a),
      opciones(`${id}-comprension`, `${p(3)} · toca una opción`, g.comprension, 'Entender qué dice'),
      opciones(`${id}-procedencia`, `${p(4)} · toca una opción`, g.procedencia, 'Ver quién habla y qué gana'),
      opciones(`${id}-variable`, `${p(5)} · toca una opción`, g.variable, HABILIDAD_VARIABLE[g.variable.tipo]),
      opciones(`${id}-postura`, `${p(6)} · tu opinión`, { ...g.postura, correcta: null, bien: 'Anotado.', otra: 'Anotado.' }, null),
      opciones(`${id}-seguridad`, `${p(6)} · qué tan seguro estás`, { titulo: '¿Qué tan seguro estás de tu opinión?', opciones: SEGURIDAD, correcta: null, bien: 'Ahora mira esto…', otra: 'Ahora mira esto…' }, null),
      fragmento('b', fuenteB ?? fuenteA, g.fragmento_b),
      opciones(`${id}-contraprueba`, `${p(7)} · contraprueba`, { titulo: 'Con esto nuevo, ¿mantienes o cambias tu idea?', opciones: ['Mantengo mi idea', 'Cambio mi idea'], correcta: null, bien: 'Las dos valen si hay una buena razón.', otra: 'Las dos valen si hay una buena razón.' }, null),
      {
        tipo: 'voz',
        id: `${id}-voz`,
        etiqueta: `${p(8)} · responde con tu voz`,
        titulo: g.voz.titulo,
        habilidad: 'Explicar con razones',
        pistas: g.voz.pistas,
        privado: {
          criterios: g.voz.criterios.map((c) => ({
            id: c.id,
            nombre: c.nombre,
            descripcion: c.descripcion,
            ejemploCumple: c.ejemplo_cumple ?? '',
            ejemploNoCumple: c.ejemplo_no_cumple ?? '',
            repregunta: c.repregunta,
          })),
          respuestaModelo: g.voz.respuesta_modelo ?? '',
          prohibido: g.voz.prohibido ?? [],
        },
      },
    ],
  };
}
