import { registrar } from '../lib/registro.js';

const TIPOS = new Set(['paso', 'prediccion', 'ver_fuente', 'pista', 'pestana_oculta', 'pegar', 'cambio_opcion', 'voz', 'respuesta', 'fin']);

// Interacciones del alumno. Cada tipo existe porque alimenta una decisión o el reporte (ver REGLAS en el repo).
export async function POST(request) {
  let b;
  try {
    b = await request.json();
  } catch {
    return Response.json({ error: 'JSON inválido' }, { status: 400 });
  }
  const eventos = (Array.isArray(b.eventos) ? b.eventos : []).slice(0, 50).filter((e) => TIPOS.has(e?.tipo));
  for (const e of eventos) {
    await registrar('evento', { alumno: String(b.alumno ?? '').slice(0, 40), casoId: String(b.casoId ?? '').slice(0, 40), ev: e.tipo, datos: e.datos ?? null, tc: e.t ?? null });
  }
  return Response.json({ ok: true, guardados: eventos.length });
}
