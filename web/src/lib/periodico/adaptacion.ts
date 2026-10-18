import type { Fragmento, PasoPublico, PreguntaOpciones, ProtocoloNoticia } from "./tipos";
import { normalizar } from "./reglas";
export type IntentosOpciones = Record<string, number[]>;
export const MAX_INTENTOS_OPCIONES = 2;

/** Only authored IDs and in-range indices survive a restored draft. */
export function restaurarIntentos(pasos: PasoPublico[], elegidas: Record<string, number>, previos?: IntentosOpciones): IntentosOpciones {
  return Object.fromEntries(pasos.flatMap((p) => {
    if (p.tipo !== "opciones") return [];
    const valid = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) < p.opciones.length;
    const anteriores = Array.isArray(previos?.[p.id]) ? previos[p.id].filter(valid).slice(0, p.correcta === null ? 1 : MAX_INTENTOS_OPCIONES) : [];
    const candidatos = anteriores.length ? anteriores : valid(elegidas[p.id]) ? [elegidas[p.id]] : [];
    const lograda = p.correcta === null ? -1 : candidatos.indexOf(p.correcta);
    const intentos = lograda >= 0 ? candidatos.slice(0, lograda + 1) : candidatos;
    return intentos.length ? [[p.id, intentos]] : [];
  }));
}
export function registrarIntento(p: PreguntaOpciones, historial: IntentosOpciones, opcion: number): IntentosOpciones {
  const anteriores = historial[p.id] ?? [];
  if (!Number.isInteger(opcion) || opcion < 0 || opcion >= p.opciones.length || anteriores.length >= MAX_INTENTOS_OPCIONES
    || (anteriores.length > 0 && (p.correcta === null || anteriores.at(-1) === p.correcta))) return historial;
  return { ...historial, [p.id]: [...anteriores, opcion] };
}
/** A timer, transcript or draft is never an answer or permission to advance. */
export function puedeContinuar(p: PreguntaOpciones, historial: IntentosOpciones): boolean {
  return (historial[p.id]?.length ?? 0) > 0;
}
export function fuenteAnterior(pasos: PasoPublico[], preguntaId: string): Fragmento | null {
  const index = pasos.findIndex((p) => "id" in p && p.id === preguntaId);
  for (let k = index - 1; k >= 0; k--) if (pasos[k].tipo === "fragmento") return pasos[k] as Fragmento;
  return null;
}
function eleccionAnterior(pasos: PasoPublico[], elegidas: Record<string, number>, sufijo: string) {
  const p = pasos.find((x): x is PreguntaOpciones => x.tipo === "opciones" && x.id.endsWith(sufijo));
  const opcion = p && elegidas[p.id];
  return p && Number.isInteger(opcion) && opcion! >= 0 && opcion! < p.opciones.length ? p.opciones[opcion!] : null;
}
/** Bounded support from this article, never a diagnosis or a generated answer. */
export function apoyoAdaptativo(pasos: PasoPublico[], p: PreguntaOpciones, historial: IntentosOpciones, elegidas: Record<string, number>) {
  const intentos = historial[p.id] ?? [];
  const ultima = intentos.at(-1);
  const fuente = fuenteAnterior(pasos, p.id);
  const postura = eleccionAnterior(pasos, elegidas, "-postura");
  if (p.id.endsWith("-contraprueba")) return {
    fase: "contraprueba" as const, fuente, postura,
    mensaje: postura
      ? `Antes elegiste: «${postura}». Compara esa idea con el nuevo fragmento de ${fuente?.medio ?? "la segunda fuente"}. Mantener o cambiar no tiene nota: después explicarás qué evidencia te hizo decidir.`
      : "Compara el nuevo fragmento con lo que pensabas. Mantener o cambiar no tiene nota: después explicarás qué evidencia te hizo decidir.",
  };
  if (p.correcta === null) return {
    fase: p.id.endsWith("-prediccion") ? "prediccion" as const : "postura" as const, fuente: null, postura: null,
    mensaje: p.id.endsWith("-prediccion")
      ? "Es una predicción, no una respuesta correcta o incorrecta. Después la contrastarás con el texto."
      : "Esta elección describe tu opinión o seguridad declarada; no se usa como nota ni como emoción inferida.",
  };
  if (ultima === p.correcta) return { fase: "evidencia" as const, fuente, postura: null, mensaje: `${p.bien} ¿Qué frase del fragmento respalda tu elección?` };
  if (ultima !== undefined && intentos.length < MAX_INTENTOS_OPCIONES) return {
    fase: "releer" as const, fuente, postura: null,
    mensaje: `Elegiste «${p.opciones[ultima]}». Relee el fragmento de ${fuente?.medio ?? "esta noticia"} y comprueba si sostiene esa afirmación. Puedes revisar tu elección una vez o continuar; esto no identifica la causa de un error.`,
  };
  if (intentos.length >= MAX_INTENTOS_OPCIONES) return { fase: "cerrar" as const, fuente, postura: null, mensaje: `${p.otra} Continúa y lleva esta duda a la explicación final; dos elecciones no demuestran tu capacidad general.` };
  const indiceActual = pasos.findIndex((x) => "id" in x && x.id === p.id);
  const previaConApoyo = pasos.slice(0, Math.max(0, indiceActual)).some((x) => x.tipo === "opciones" && x.habilidad === p.habilidad && x.correcta !== null
    && historial[x.id]?.[0] !== undefined && historial[x.id][0] !== x.correcta);
  return {
    fase: "comprender" as const, fuente, postura: null,
    mensaje: previaConApoyo
      ? `En la pregunta anterior de esta habilidad revisaste una elección. Usa ahora el fragmento de ${fuente?.medio ?? "esta noticia"} para comprobar esta nueva pregunta, sin asumir que el motivo del error fue el mismo.`
      : `Antes de elegir, busca en el fragmento de ${fuente?.medio ?? "esta noticia"} la información que responde: «${p.titulo}».`,
  };
}
export function eleccionesParaJuez(pasos: PasoPublico[], elegidas: Record<string, number>) {
  return pasos.flatMap((p) => p.tipo === "opciones" && Number.isInteger(elegidas[p.id]) && elegidas[p.id] >= 0 && elegidas[p.id] < p.opciones.length
    ? [{ preguntaId: p.id, opcion: elegidas[p.id] }] : []).slice(0, 12);
}
/** Literal option text or a single spoken number becomes only a draft. */
export function opcionDesdeVoz(texto: string, opciones: string[]): number | null {
  const n = normalizar(texto);
  const exactas = opciones.flatMap((o, i) => [normalizar(o), `elijo ${normalizar(o)}`, `escojo ${normalizar(o)}`].includes(n) ? [i] : []);
  if (exactas.length === 1) return exactas[0];
  const numeros = ["uno|una|primera|primero|1", "dos|segunda|segundo|2", "tres|tercera|tercero|3", "cuatro|cuarta|cuarto|4", "cinco|quinta|quinto|5", "seis|sexta|sexto|6"];
  const coincidencias = numeros.flatMap((patron, i) => new RegExp(`^(?:(?:elijo|escojo|quiero) )?(?:(?:la )?opcion |la |el )?(?:${patron})$`).test(n) && i < opciones.length ? [i] : []);
  return coincidencias.length === 1 ? coincidencias[0] : null;
}
export function resumenProtocolo(pasos: PasoPublico[], historial: IntentosOpciones, inicialesDesconocidas: string[] = []): ProtocoloNoticia {
  const preguntas = pasos.flatMap((p) => {
    const intentos = "id" in p ? historial[p.id] : undefined;
    if (p.tipo !== "opciones" || !intentos?.length) return [];
    return [{ preguntaId: p.id, habilidad: p.habilidad,
      aciertoInicial: p.correcta === null || inicialesDesconocidas.includes(p.id) ? null : intentos[0] === p.correcta,
      aciertoFinal: p.correcta === null ? null : intentos.at(-1) === p.correcta,
      conApoyo: p.correcta !== null && intentos[0] !== p.correcta && (!inicialesDesconocidas.includes(p.id) || intentos.length > 1), intentos: intentos.length }];
  });
  return { version: "contraprueba-v1", preguntas, apoyos: preguntas.filter((p) => p.conApoyo).length, transferencia: "no_observada" };
}


/** Public readiness is configuration, not proof that a paid inference succeeded. */
export function capacidadEvaluador(value: unknown): { enabled: boolean; reason: string } {
  const data = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const enabled = data.enabled === true;
  return {
    enabled,
    reason: enabled
      ? "La evaluación por Haiku está habilitada para la demo privada. Puede fallar; revisa el texto antes de enviarlo."
      : "La evaluación automática no está disponible. Puedes seguir leyendo y terminar sin evaluación.",
  };
}
