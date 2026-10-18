import { casos, buscarPregunta } from '../lib/casos.js';
import { evaluar } from '../lib/llm.js';
import { registrar } from '../lib/registro.js';
import { PLANTILLAS, calcularNivel, guardia, revisarCodigo, revisarTexto, validarCriterios } from '../lib/reglas.js';

const MAX_TEXTO = 800;

export async function POST(request) {
  let b;
  try {
    b = await request.json();
  } catch {
    return Response.json({ error: 'JSON inválido' }, { status: 400 });
  }
  const caso = casos[b.casoId];
  const p = caso && buscarPregunta(caso, b.preguntaId);
  if (!p) return Response.json({ error: 'La pregunta no existe' }, { status: 404 });

  const r = b.respuesta ?? {};
  const texto = String(r.texto ?? '').slice(0, MAX_TEXTO);
  const k = p.privado;
  const codigo = revisarCodigo(p, r);
  const previo = revisarTexto(texto);

  let salida;
  if (previo) {
    // Sin llamada a la IA: respuesta muy corta o pidiendo la solución.
    const retro = previo === 'pide' ? `${PLANTILLAS.pide} ${p.pistas[0]}` : PLANTILLAS.corta;
    salida = { criterios: [], retro, listo: false, nivel: null, ia: false };
  } else {
    const ia = await evaluar({
      fuentes: p.fuentes.map((f) => ({ id: f, autor: caso.fuentes[f].autor, fecha: caso.fuentes[f].fecha, texto: caso.fuentes[f].texto })),
      pregunta: [p.eleccion?.pregunta, p.orden?.instruccion, p.tocar?.instruccion, p.pregunta].filter(Boolean).join(' / '),
      criterios: k.criterios,
      respuestaModelo: k.respuesta_modelo,
      eleccion: describirEleccion(caso, p, r),
      texto,
    });
    const criterios = validarCriterios(ia?.criterios, k.criterios, texto);
    const faltan = criterios.filter((c) => !c.cumple);
    let retro;
    if (codigo.ok === false) retro = k.retro_codigo;
    else if (ia && guardia(ia.retro, k.prohibido, texto)) retro = ia.retro;
    else if (faltan.length) retro = k.criterios.find((c) => c.id === faltan[0].id).repregunta;
    else retro = PLANTILLAS.bien;
    salida = {
      criterios,
      retro,
      listo: faltan.length === 0 && codigo.ok !== false,
      nivel: calcularNivel(criterios, codigo.ok),
      ia: Boolean(ia),
      pendiente: !ia,
    };
    await registrar('intento', {
      alumno: String(b.alumno ?? '').slice(0, 40),
      casoId: caso.id,
      preguntaId: p.id,
      intento: b.intento ?? 1,
      codigoOk: codigo.ok,
      nivel: salida.nivel,
      criterios: criterios.map(({ id, cumple, dudoso }) => ({ id, cumple, dudoso })),
      guardiaBloqueo: Boolean(ia) && retro !== ia.retro,
      costo: ia?.costo ?? null,
    });
  }
  return Response.json({ codigoOk: codigo.ok, ...salida });
}

// La IA recibe lo que eligió el alumno como texto, no como índice.
function describirEleccion(caso, p, r) {
  if (p.eleccion && r.eleccion != null) return p.eleccion.opciones[r.eleccion] ?? null;
  if (p.tocar && r.toque != null) {
    const frase = caso.fuentes[p.tocar.fuente].fragmentos?.[r.toque];
    return frase ? `Tocó la frase: «${frase.trim()}»` : null;
  }
  if (p.orden && Array.isArray(r.orden)) {
    return p.orden.afirmaciones.map((a, i) => `${a} → ${p.orden.grupos[r.orden[i]] ?? 'sin elegir'}`).join('; ');
  }
  return null;
}
