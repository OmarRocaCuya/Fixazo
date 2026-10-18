// Private, opt-in research judge. No student identifiers, answers or
// educational outcomes are written to disk or logs by this route.
import { connection } from "next/server";
import { buscarPreguntaVoz } from "@/lib/periodico/ediciones";
import { agregarCorridas, guardia, PLANTILLAS, revisarTexto } from "@/lib/periodico/reglas";
import type { RespuestaVoz } from "@/lib/periodico/tipos";
import { corridaValida, juzgarVoz, type ContextoEleccion } from "@/lib/server/juez-noticia";
import { getPeriodicoPolicy, preflightPeriodicoRequest, reservePeriodicoJudge } from "@/lib/server/periodico-policy";

export const maxDuration = 30;
const MAX_BODY_BYTES = 8 * 1024;
const MAX_TEXTO = 800;
const HEADERS = { "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" };
const UNAVAILABLE = "La revisión automática no está disponible. Tu respuesta no se ha evaluado ni consume un intento. Puedes continuar sin evaluación.";

function noEvaluable(retro = UNAVAILABLE, status = 200, error?: string) {
  const result: RespuestaVoz = { evaluacion: "no_evaluable", cuenta: false, criterios: [], retro, listo: false, ia: false };
  return Response.json(error ? { ...result, error } : result, { status, headers: HEADERS });
}

async function boundedJson(request: Request): Promise<unknown> {
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > MAX_BODY_BYTES)) throw new Error("body-too-large");
  if (!request.body) throw new Error("invalid-json");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) { await reader.cancel(); throw new Error("body-too-large"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}

type Eleccion = { preguntaId: string; opcion: number };
type Input = { noticiaId: string; preguntaId: string; texto: string; intento: number; elecciones?: Eleccion[] };
const validId = (s: unknown): s is string => typeof s === "string" && s.length > 0 && s.length <= 128 && !/[\u0000-\u001f]/.test(s);
function isElecciones(value: unknown): value is Eleccion[] | undefined {
  if (value === undefined) return true;
  if (!Array.isArray(value) || value.length > 12) return false;
  const seen = new Set<string>();
  return value.every((raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
    const choice = raw as Record<string, unknown>;
    if (Object.keys(choice).length !== 2 || Object.keys(choice).some((key) => key !== "preguntaId" && key !== "opcion")
      || !validId(choice.preguntaId) || seen.has(choice.preguntaId) || !Number.isInteger(choice.opcion) || (choice.opcion as number) < 0) return false;
    seen.add(choice.preguntaId);
    return true;
  });
}
function isInput(value: unknown): value is Input {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const b = value as Record<string, unknown>;
  const allowed = new Set(["noticiaId", "preguntaId", "texto", "intento", "elecciones"]);
  if (Object.keys(b).some((key) => !allowed.has(key))) return false;
  return validId(b.noticiaId) && validId(b.preguntaId) && typeof b.texto === "string" && b.texto.length <= MAX_TEXTO
    && !/[\u0000\u202a-\u202e\u2066-\u2069]/.test(b.texto)
    && Number.isInteger(b.intento) && (b.intento as number) >= 1 && (b.intento as number) <= 2
    && isElecciones(b.elecciones);
}

export async function GET() {
  await connection();
  return Response.json(getPeriodicoPolicy(), { headers: HEADERS });
}

export async function POST(request: Request) {
  if (!getPeriodicoPolicy().enabled) return noEvaluable();
  const denial = preflightPeriodicoRequest(request);
  if (denial) return noEvaluable(UNAVAILABLE, denial.status, denial.error);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return noEvaluable(UNAVAILABLE, 415, "json-required");
  let value: unknown;
  try { value = await boundedJson(request); }
  catch (error) { return noEvaluable(UNAVAILABLE, error instanceof Error && error.message === "body-too-large" ? 413 : 400, "invalid-request"); }
  if (!isInput(value)) return noEvaluable(UNAVAILABLE, 422, "invalid-request");
  let hit: Awaited<ReturnType<typeof buscarPreguntaVoz>>;
  try { hit = await buscarPreguntaVoz(value.noticiaId, value.preguntaId); }
  catch { return noEvaluable(); }
  if (!hit) return noEvaluable("La pregunta no existe. No se ha evaluado tu respuesta.", 404, "question-not-found");
  const { noticia, pregunta } = hit;
  const elecciones: ContextoEleccion[] = [];
  for (const choice of value.elecciones ?? []) {
    const authored = noticia.pasos.find((step) => step.tipo === "opciones" && step.id === choice.preguntaId);
    if (!authored || authored.tipo !== "opciones" || choice.opcion >= authored.opciones.length) return noEvaluable(UNAVAILABLE, 422, "invalid-request");
    // Only trusted article content reaches the prompt; no caller-authored questions,
    // option text, expected answer, rubric or model selection are accepted.
    elecciones.push({ preguntaId: authored.id, pregunta: authored.titulo, opcionElegida: authored.opciones[choice.opcion], habilidad: authored.habilidad });
  }
  const k = pregunta.privado;
  const texto = value.texto;
  const previo = revisarTexto(texto);
  if (previo) {
    const retro = previo === "pide" ? `${PLANTILLAS.pide} ${pregunta.pistas[0] ?? ""}` : PLANTILLAS.corta;
    return noEvaluable(retro);
  }
  const reservation = reservePeriodicoJudge(request);
  if (!reservation.ok) return noEvaluable(UNAVAILABLE, 429, reservation.error);
  try {
    const fragmentos = noticia.pasos.flatMap((p) => (p.tipo === "fragmento" ? [`${p.medio}: ${p.texto}`] : []));
    const received = await juzgarVoz({ fragmentos, pregunta: pregunta.titulo, criterios: k.criterios, respuestaModelo: k.respuestaModelo, texto, elecciones });
    const corridas = Array.isArray(received) ? received.filter((run) => corridaValida(run, k.criterios)).slice(0, 3) : [];
    // Infrastructure/model-contract failures are NOT evidence of a failed skill.
    // Require two complete independent runs before considering any criteria.
    if (corridas.length < 2) return noEvaluable();
    const criterios = agregarCorridas(corridas, k.criterios, texto);
    const faltan = criterios.filter((c) => !c.cumple);
    const retroIa = corridas.map((c) => c.retro).find((r) => guardia(r, k.prohibido, texto));
    const retro = faltan.length
      ? (retroIa ?? k.criterios.find((c) => c.id === faltan[0].id)?.repregunta ?? PLANTILLAS.corta)
      : (retroIa ?? PLANTILLAS.bien);
    const result: RespuestaVoz = { evaluacion: "evaluada", cuenta: true, criterios, retro, listo: faltan.length === 0, ia: true };
    return Response.json(result, { headers: HEADERS });
  } catch { return noEvaluable(); }
  finally { reservation.release(); }
}
