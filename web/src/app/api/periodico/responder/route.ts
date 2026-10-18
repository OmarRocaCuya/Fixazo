// Revisa la respuesta de voz (ya transcrita) de una noticia. Primero reglas en código; la IA solo si hace falta.
import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { buscarPreguntaVoz } from "@/lib/periodico/ediciones";
import { agregarCorridas, guardia, PLANTILLAS, revisarTexto } from "@/lib/periodico/reglas";
import type { RespuestaVoz } from "@/lib/periodico/tipos";
import { hayClaveJuez, juzgarVoz } from "@/lib/server/juez-noticia";

const MAX_TEXTO = 800;
// Registro de uso (evidencia de tracción). En un servidor propio, REGISTRO_DIR apunta a un disco persistente.
const REGISTRO = process.env.REGISTRO_DIR ?? join(process.cwd(), "data", "registro");

async function registrar(fila: object) {
  const linea = JSON.stringify({ t: new Date().toISOString(), ...fila });
  console.log(linea);
  await mkdir(REGISTRO, { recursive: true }).catch(() => undefined);
  await appendFile(join(REGISTRO, "intentos.jsonl"), linea + "\n").catch(() => undefined);
}

export async function POST(request: Request) {
  let b: { noticiaId?: string; preguntaId?: string; texto?: string; intento?: number; alumno?: string };
  try {
    b = await request.json();
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }
  const hit = await buscarPreguntaVoz(String(b.noticiaId ?? ""), String(b.preguntaId ?? ""));
  if (!hit) return Response.json({ error: "La pregunta no existe" }, { status: 404 });
  const { noticia, pregunta } = hit;
  const k = pregunta.privado;
  const texto = String(b.texto ?? "").slice(0, MAX_TEXTO);

  const previo = revisarTexto(texto);
  if (previo) {
    const retro = previo === "pide" ? `${PLANTILLAS.pide} ${pregunta.pistas[0] ?? ""}` : PLANTILLAS.corta;
    const salida: RespuestaVoz = { criterios: [], retro, listo: false, ia: false };
    return Response.json({ ...salida, cuenta: false });
  }

  const fragmentos = noticia.pasos.flatMap((p) => (p.tipo === "fragmento" ? [`${p.medio}: ${p.texto}`] : []));
  const corridas = hayClaveJuez() ? await juzgarVoz({ fragmentos, pregunta: pregunta.titulo, criterios: k.criterios, respuestaModelo: k.respuestaModelo, texto }) : [];
  const criterios = agregarCorridas(corridas, k.criterios, texto);
  const faltan = criterios.filter((c) => !c.cumple);
  const retroIa = corridas.map((c) => c.retro).find((r) => guardia(r, k.prohibido, texto));
  const retro = faltan.length
    ? (retroIa ?? k.criterios.find((c) => c.id === faltan[0].id)?.repregunta ?? PLANTILLAS.corta)
    : (retroIa ?? PLANTILLAS.bien);
  const salida: RespuestaVoz = { criterios, retro, listo: faltan.length === 0, ia: corridas.length > 0 };

  await registrar({
    alumno: String(b.alumno ?? "").slice(0, 40),
    noticia: noticia.id,
    pregunta: pregunta.id,
    intento: b.intento ?? 1,
    corridas: corridas.length,
    criterios: criterios.map(({ id, cumple, dudoso }) => ({ id, cumple, dudoso })),
    listo: salida.listo,
    guardiaBloqueo: corridas.length > 0 && retroIa === undefined,
  });
  return Response.json({ ...salida, cuenta: true });
}
