"use client";
// Authored passages/options remain fixed. The protocol adapts support, not truth or learner traits.
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { guardarAvance, guardarResultado, leerAvance, leerResultados, registrarVozQuiz, type Avance, type ResultadoNoticia } from "@/lib/periodico/progreso";
import { acumularMetricas, emocionDesdeEstimacion, type MetricasVoz } from "@/lib/periodico/voz-quiz";
import { estimarEmocionRespuesta } from "@/lib/browser/quiz-emotion";
import type { Fragmento, NoticiaPublica, PreguntaOpciones, PreguntaVozPublica, RespuestaVoz } from "@/lib/periodico/tipos";
import { apoyoAdaptativo, capacidadEvaluador, eleccionesParaJuez, MAX_INTENTOS_OPCIONES, opcionDesdeVoz, puedeContinuar, registrarIntento, restaurarIntentos, resumenProtocolo, type IntentosOpciones } from "@/lib/periodico/adaptacion";
import { countFillers } from "@/lib/signals/prosody";
import type { QuizAnswerAudio, QuizAudioTranscript } from "@/lib/browser/quiz-microphone";
import { EmocionRespuestaCard, type EstadoEmocion } from "./EmocionRespuesta";
import { applyVoiceEvaluation } from "./voz-state";
import { QuizAudioPanel, type QuizAudioHandle } from "./QuizAudioPanel";
import { InformeFinal } from "./InformeFinal";

interface BorradorOpcion { preguntaId: string; opcion: number | null }

function bajar(el: HTMLElement | null) {
  const reducir = typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  el?.scrollIntoView({ block: "start", behavior: reducir ? "auto" : "smooth" });
}

function BloqueFragmento({ f }: { f: Fragmento }) {
  return (
    <div className={`pd-bloque pd-frag ${f.lado}`}>
      <div className="pd-frag-medio">{f.medio} · {f.fecha}</div>
      <blockquote>{f.texto}</blockquote>
      <p className="pd-frag-ref">{f.titular} · <a href={f.url} target="_blank" rel="noopener noreferrer">Leer la nota completa</a></p>
    </div>
  );
}

export function BloqueOpciones({ p, intentos, activa, apoyo, borrador, onElegir, onContinuar }: {
  p: PreguntaOpciones; intentos: number[]; activa: boolean;
  apoyo: ReturnType<typeof apoyoAdaptativo>; borrador: BorradorOpcion | null;
  onElegir: (k: number) => void; onContinuar: () => void;
}) {
  const elegida = intentos.at(-1);
  const respondida = elegida !== undefined;
  const acerto = p.correcta !== null && elegida === p.correcta;
  const agotada = p.correcta === null ? respondida : acerto || intentos.length >= MAX_INTENTOS_OPCIONES;
  const revelar = p.correcta !== null && (acerto || intentos.length >= MAX_INTENTOS_OPCIONES);
  const draft = activa && !agotada && borrador?.preguntaId === p.id ? borrador : null;
  return (
    <div className="pd-bloque pd-pregunta">
      <div className="pd-tipo">{p.etiqueta}</div>
      <h2>{p.titulo}</h2>
      <div className="pd-ops">
        {p.opciones.map((o, k) => (
          <button key={o} type="button"
            className={`pd-op${revelar && k === p.correcta ? " correcta" : ""}${k === elegida ? " elegida" : ""}`}
            disabled={!activa || agotada} aria-pressed={k === elegida}
            onClick={() => onElegir(k)}>
            <span className="muted">{k + 1}. </span>{o}
          </button>
        ))}
      </div>
      <p className={`pd-retro${acerto ? " bien" : ""}`} role="status">{apoyo.mensaje}</p>
      {activa && apoyo.fuente && (apoyo.fase === "releer" || apoyo.fase === "contraprueba") && (
        <details open>
          <summary>Volver a la evidencia de {apoyo.fuente.medio}</summary>
          <blockquote>{apoyo.fuente.texto}</blockquote>
        </details>
      )}
      {draft && (
        <div className="pd-aviso" role="status">
          {draft.opcion === null
            ? <p>No pude identificar una sola opción. Di su número o elige con los botones; no se ha enviado una respuesta.</p>
            : <><p>Por voz se preseleccionó: «{p.opciones[draft.opcion]}». Revisa antes de confirmar.</p>
              <button type="button" className="btn ghost" onClick={() => onElegir(draft.opcion!)}>Confirmar esta opción de voz</button></>}
        </div>
      )}
      {activa && (
        <div className="pd-acciones">
          {p.correcta !== null && <p className="muted small">{intentos.length} de {MAX_INTENTOS_OPCIONES} elecciones · una revisión con apoyo como máximo</p>}
          <button type="button" className="btn primary" disabled={!respondida} onClick={onContinuar}>
            {respondida && !agotada ? "Continuar con mi elección actual" : "Continuar"}
          </button>
        </div>
      )}
    </div>
  );
}

interface FinVoz {
  evaluada: boolean; listo: boolean; intentos: number;
  criterios: RespuestaVoz["criterios"]; texto: string; porVoz: boolean;
}

/** Audio is owned by the single foreground panel; this block only reviews/submits text. */
export function BloqueVoz({ p, noticiaId, onFin, elecciones = [], texto: textoExterno, onTextoChange, porVoz = false, onBusyChange }: {
  p: PreguntaVozPublica; noticiaId: string; onFin: (r: FinVoz) => void;
  elecciones?: Array<{ preguntaId: string; opcion: number }>;
  texto?: string; onTextoChange?: (texto: string) => void; porVoz?: boolean; onBusyChange?: (busy: boolean) => void;
}) {
  const [textoLocal, setTextoLocal] = useState("");
  const texto = textoExterno ?? textoLocal;
  const setTexto = onTextoChange ?? setTextoLocal;
  const [estado, setEstado] = useState<"quieto" | "pensando" | "listo">("quieto");
  const [retro, setRetro] = useState<{ texto: string; bien: boolean } | null>(null);
  const [pista, setPista] = useState(0);
  const [capacidad, setCapacidad] = useState({ enabled: false, reason: "Comprobando disponibilidad de evaluación…" });
  const intentos = useRef(0);
  const [respondidas, setRespondidas] = useState(0);
  const requestEpoch = useRef(0);
  const pending = useRef<AbortController | null>(null);
  const busyCallback = useRef(onBusyChange);
  useEffect(() => { busyCallback.current = onBusyChange; }, [onBusyChange]);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/periodico/responder", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("unavailable");
        const data = await response.json();
        if (!controller.signal.aborted) setCapacidad(capacidadEvaluador(data));
      })
      .catch(() => { if (!controller.signal.aborted) setCapacidad({ enabled: false, reason: "Evaluación no disponible. Puedes leer y continuar sin evaluación." }); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const stop = () => { requestEpoch.current++; pending.current?.abort(); pending.current = null; busyCallback.current?.(false); };
    const visibility = () => {
      if (document.visibilityState !== "hidden" || !pending.current) return;
      stop(); setEstado((current) => current === "listo" ? current : "quieto");
      setRetro({ texto: "La espera se detuvo al salir. No se cuenta una evaluación pendiente.", bien: false });
    };
    document.addEventListener("visibilitychange", visibility);
    return () => { stop(); document.removeEventListener("visibilitychange", visibility); };
  }, []);

  function terminarSinEvaluacion() {
    requestEpoch.current++; pending.current?.abort(); pending.current = null; busyCallback.current?.(false);
    setEstado("listo");
    setRetro({ texto: "Lectura terminada sin evaluación de la explicación. No se registra una habilidad como lograda o por practicar.", bien: false });
    onFin({ evaluada: false, listo: false, intentos: intentos.current, criterios: [], texto, porVoz: false });
  }

  async function enviar() {
    if (!texto.trim() || texto.length > 800 || !capacidad.enabled || estado !== "quieto") return;
    const epoch = ++requestEpoch.current;
    const controller = new AbortController(); pending.current = controller;
    setEstado("pensando"); busyCallback.current?.(true);
    let d: RespuestaVoz;
    try {
      const r = await fetch("/api/periodico/responder", {
        method: "POST", headers: { "content-type": "application/json" },
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)]),
        body: JSON.stringify({ noticiaId, preguntaId: p.id, texto, intento: intentos.current + 1, elecciones }),
      });
      d = await r.json();
      if (!r.ok && d.evaluacion !== "no_evaluable") throw new Error("unavailable");
      if (typeof d.retro !== "string" || !Array.isArray(d.criterios) || !["evaluada", "no_evaluable"].includes(d.evaluacion)) throw new Error("invalid-response");
    } catch {
      d = { evaluacion: "no_evaluable", criterios: [], retro: "No se pudo evaluar tu respuesta. No gastaste un intento. Puedes reintentar o continuar sin evaluación.", listo: false, ia: false, cuenta: false };
    }
    if (requestEpoch.current !== epoch || controller.signal.aborted) return;
    pending.current = null; busyCallback.current?.(false);
    const outcome = applyVoiceEvaluation(d, intentos.current);
    intentos.current = outcome.attempts; setRespondidas(outcome.attempts);
    setRetro({ texto: outcome.evaluated ? d.retro : `Sin evaluación: ${d.retro}`, bien: outcome.evaluated && d.listo });
    if (outcome.complete) {
      setEstado("listo");
      onFin({ evaluada: true, listo: d.listo, intentos: outcome.attempts, criterios: d.criterios, texto, porVoz });
    } else setEstado("quieto");
  }

  return (
    <div className="pd-bloque pd-pregunta">
      <div className="pd-tipo">{p.etiqueta}</div>
      <h2>{p.titulo}</h2>
      <p className="muted small">Relaciona tu elección inicial, el fragmento nuevo y la decisión de mantener o cambiar. Usa evidencia del texto. El micrófono es opcional; solo se envía el texto visible. Revisa y edita la transcripción antes de enviar: el último audio puede seguir pendiente.</p>
      <p className="muted small">La evaluación por IA es una demo y puede equivocarse.</p>
      <p className="pd-aviso" role="status">{capacidad.reason}</p>
      <label htmlFor={`r-${p.id}`}>Tu explicación ({texto.length}/800 caracteres)</label>
      <textarea id={`r-${p.id}`} className="pd-respuesta" rows={4} aria-label="Tu respuesta"
        placeholder="Escribe o activa el panel de voz. La transcripción nunca se envía automáticamente."
        value={texto} maxLength={800} disabled={estado !== "quieto"} onChange={(e) => setTexto(e.target.value)} />
      {pista > 0 && <p className="pd-retro">Pista: {p.pistas[pista - 1]}</p>}
      {retro && <p className={`pd-retro${retro.bien ? " bien" : ""}`} role="status">{retro.texto}</p>}
      {estado === "pensando" && <p role="status">Leyendo tu explicación… micrófono detenido.</p>}
      {estado === "listo" && retro?.bien === false && respondidas >= 2 && <p className="pd-aviso">Terminaste los intentos evaluados. Puedes revisar esta idea con un docente.</p>}
      {estado === "quieto" && (
        <div className="pd-acciones">
          {capacidad.enabled && texto.trim() && <button type="button" className="btn primary" disabled={texto.length > 800} onClick={() => void enviar()}>Pedir evaluación de mi respuesta</button>}
          {pista < p.pistas.length && <button type="button" className="btn ghost" onClick={() => setPista((n) => n + 1)}>Pedir pista</button>}
          <button type="button" className="btn ghost" onClick={terminarSinEvaluacion}>Continuar sin evaluación</button>
        </div>
      )}
    </div>
  );
}

export default function NoticiaFlow({ noticia }: { noticia: NoticiaPublica }) {
  const enNavegador = useSyncExternalStore(() => () => undefined, () => true, () => false);
  if (!enNavegador) return <div className="pd-flujo"><p className="pd-vacio">Cargando…</p></div>;
  const r = leerResultados()[noticia.id];
  return <Flujo key={noticia.id} noticia={noticia} inicial={leerAvance(noticia.id)} terminada={r && !r.enCurso ? r : null} />;
}

function Flujo({ noticia, inicial, terminada }: { noticia: NoticiaPublica; inicial: Avance | null; terminada: ResultadoNoticia | null }) {
  const pasos = noticia.pasos;
  const [intentosOpciones, setIntentosOpciones] = useState<IntentosOpciones>(() => restaurarIntentos(pasos, inicial?.elegidas ?? {}, inicial?.intentosOpciones));
  const [inicialesDesconocidas] = useState(() => Array.from(new Set([
    ...(Array.isArray(inicial?.inicialesDesconocidas) ? inicial.inicialesDesconocidas.filter((id) => typeof id === "string") : []),
    ...pasos.flatMap((p) => p.tipo === "opciones" && inicial?.elegidas?.[p.id] !== undefined && !inicial.intentosOpciones?.[p.id]?.length ? [p.id] : []),
  ])).filter((id) => pasos.some((p) => "id" in p && p.id === id)));
  const elegidas = Object.fromEntries(Object.entries(intentosOpciones).map(([id, elecciones]) => [id, elecciones.at(-1)!]));
  const [hasta, setHasta] = useState(() => {
    const solicitada = Math.max(0, Math.min(pasos.length - 1, Number.isInteger(inicial?.hasta) ? inicial!.hasta : 0));
    const primeraSinRespuesta = pasos.findIndex((p) => p.tipo === "opciones" && !intentosOpciones[p.id]?.length);
    return primeraSinRespuesta >= 0 ? Math.min(solicitada, primeraSinRespuesta) : solicitada;
  });
  const [fin, setFin] = useState<ResultadoNoticia | null>(terminada);
  const [borradorOpcion, setBorradorOpcion] = useState<BorradorOpcion | null>(null);
  const [respuestaVoz, setRespuestaVoz] = useState("");
  const [porVoz, setPorVoz] = useState(false);
  const [avisoAudio, setAvisoAudio] = useState("");
  const [judgeBusy, setJudgeBusy] = useState(false);
  const [capturePaused, setCapturePaused] = useState(false);
  const audio = useRef<QuizAudioHandle | null>(null);
  const ultimo = useRef<HTMLDivElement | null>(null);
  // Experimental emotion estimate: one per voice answer, held in state and in this browser only.
  const [emociones, setEmociones] = useState<Record<string, EstadoEmocion>>({});
  const emocionPedida = useRef(new Set<string>());
  const metricasPorPaso = useRef<Record<string, MetricasVoz>>({});
  const emotionAbort = useRef<AbortController | null>(null);
  useEffect(() => { const c = new AbortController(); emotionAbort.current = c; return () => c.abort(); }, []);

  let visibles = hasta;
  while (visibles < pasos.length - 1 && pasos[visibles].tipo === "fragmento") visibles++;
  const activa = pasos[visibles];
  const activeId = activa && "id" in activa && !fin ? activa.id : null;

  useEffect(() => {
    if (fin) return; // Opening a completed report must not recreate a draft.
    guardarAvance(noticia.id, { hasta, elegidas: Object.fromEntries(Object.entries(intentosOpciones).map(([id, elecciones]) => [id, elecciones.at(-1)!])), intentosOpciones, inicialesDesconocidas });
    if (hasta > 0) bajar(ultimo.current);
  }, [hasta, intentosOpciones, inicialesDesconocidas, noticia.id, fin]);

  function guardarParcial(historial: IntentosOpciones) {
    const habilidades: Record<string, boolean> = {};
    for (const p of pasos) if (p.tipo === "opciones" && p.habilidad && p.correcta !== null && historial[p.id]?.length) habilidades[p.habilidad] = historial[p.id].at(-1) === p.correcta;
    guardarResultado({ noticiaId: noticia.id, enCurso: true, titular: noticia.titular, fecha: new Date().toISOString(), habilidades, postura: null, seguridad: null, decision: null, voz: null, protocolo: resumenProtocolo(pasos, historial, inicialesDesconocidas) });
  }

  function elegir(p: PreguntaOpciones, opcion: number) {
    if (fin || p.id !== activeId) return;
    const nuevas = registrarIntento(p, intentosOpciones, opcion);
    if (nuevas === intentosOpciones) return;
    setIntentosOpciones(nuevas); setBorradorOpcion(null); guardarParcial(nuevas);
  }

  function recibirTranscripcion(event: QuizAudioTranscript) {
    if (fin || judgeBusy || event.stepId !== activeId) return;
    if (activa.tipo === "opciones") {
      setBorradorOpcion({ preguntaId: activa.id, opcion: opcionDesdeVoz(event.text, activa.opciones) });
    } else if (activa.tipo === "voz") {
      setRespuestaVoz((previa) => {
        const siguiente = [previa.trim(), event.text.trim()].filter(Boolean).join(" ");
        return siguiente.length <= 800 ? siguiente : previa;
      });
      // An overlong chunk is not silently truncated into a different answer.
      if ([respuestaVoz.trim(), event.text.trim()].filter(Boolean).join(" ").length > 800) setAvisoAudio("La transcripción supera 800 caracteres y no se añadió. Revisa tu texto o responde en partes más cortas.");
      else { setPorVoz(true); setAvisoAudio(""); }
    }
  }

  function recibirAudio(event: QuizAnswerAudio) {
    if (fin || event.stepId !== activeId) return;
    const stepId = event.stepId;
    if (event.metrics) {
      metricasPorPaso.current[stepId] = acumularMetricas(metricasPorPaso.current[stepId], event.metrics);
      registrarVozQuiz(noticia.id, noticia.titular, { metricas: event.metrics });
    }
    if (emocionPedida.current.has(stepId)) return;
    emocionPedida.current.add(stepId);
    const signal = emotionAbort.current?.signal;
    setEmociones((m) => ({ ...m, [stepId]: "analizando" }));
    void estimarEmocionRespuesta(event.audio, undefined, signal).then((estimate) => {
      if (signal?.aborted) return;
      setEmociones((m) => ({ ...m, [stepId]: estimate }));
      registrarVozQuiz(noticia.id, noticia.titular, { emocion: emocionDesdeEstimacion(stepId, estimate) });
      setFin((f) => (f ? leerResultados()[noticia.id] ?? f : f));
    });
  }

  function terminar(v: FinVoz) {
    audio.current?.stop(); // Synchronous: stop hardware before persisting/showing the report.
    setCapturePaused(true);
    const habilidades: Record<string, boolean> = {};
    let postura: string | null = null; let seguridad: string | null = null; let decision: string | null = null;
    for (const p of pasos) {
      if (p.tipo !== "opciones" || elegidas[p.id] === undefined) continue;
      if (p.habilidad && p.correcta !== null) habilidades[p.habilidad] = elegidas[p.id] === p.correcta;
      if (p.id.endsWith("-postura")) postura = p.opciones[elegidas[p.id]];
      if (p.id.endsWith("-seguridad")) seguridad = p.opciones[elegidas[p.id]];
      if (p.id.endsWith("-contraprueba")) decision = p.opciones[elegidas[p.id]];
    }
    const voz = pasos.find((p) => p.tipo === "voz");
    if (voz && v.evaluada) habilidades[voz.habilidad] = v.listo;
    const senales = countFillers(v.texto);
    const metricasExplicacion = voz && v.porVoz ? metricasPorPaso.current[voz.id] : undefined;
    const r: ResultadoNoticia = {
      noticiaId: noticia.id, titular: noticia.titular, fecha: new Date().toISOString(), habilidades, postura, seguridad, decision,
      protocolo: resumenProtocolo(pasos, intentosOpciones, inicialesDesconocidas),
      voz: v.evaluada ? {
        listo: v.listo, intentos: v.intentos, criterios: v.criterios.map(({ nombre, cumple }) => ({ nombre, cumple })),
        dudas: senales.hedges, muletillas: senales.fillers,
        pausasLargas: metricasExplicacion?.pausasLargas ?? null, segundosHablando: metricasExplicacion?.segundosHablando ?? null, porVoz: v.porVoz,
      } : null,
    };
    guardarResultado(r); setFin(leerResultados()[noticia.id] ?? r); setRespuestaVoz(""); setBorradorOpcion(null);
    setTimeout(() => bajar(ultimo.current), 300);
  }

  return (
    <div className="pd-flujo">
      <header className="pd-noticia-cabeza">
        <div className="eyebrow">{noticia.seccion}</div>
        <h1>{noticia.titular}</h1>
        <p className="pd-bajada">{noticia.bajada}</p>
        <p className="muted small">{noticia.minutos} min</p>
      </header>
      {!fin && <QuizAudioPanel ref={audio} stepId={activeId} paused={judgeBusy || capturePaused} onTranscript={recibirTranscripcion} onAnswerAudio={recibirAudio} />}
      {avisoAudio && !fin && <p role="status" className="pd-aviso">{avisoAudio}</p>}
      {pasos.slice(0, visibles + 1).map((p, k) => (
        <div key={"id" in p ? p.id : `frag-${k}`} ref={k === visibles ? ultimo : undefined}>
          {p.tipo === "fragmento" && <BloqueFragmento f={p} />}
          {/* Una idea a la vez: las preguntas ya cerradas quedan plegadas en una línea. */}
          {p.tipo === "opciones" && elegidas[p.id] !== undefined && k < visibles && (
            <details className="pd-cerrado">
              <summary><span className="pd-tipo">{p.etiqueta.split(" · ")[0]}</span><span>{p.opciones[elegidas[p.id]]}</span></summary>
              <BloqueOpciones p={p} intentos={intentosOpciones[p.id] ?? []} activa={false}
                apoyo={apoyoAdaptativo(pasos, p, intentosOpciones, elegidas)} borrador={null}
                onElegir={() => undefined} onContinuar={() => undefined} />
            </details>
          )}
          {p.tipo === "opciones" && !(elegidas[p.id] !== undefined && k < visibles) && <BloqueOpciones p={p} intentos={intentosOpciones[p.id] ?? []} activa={!fin && k === visibles}
            apoyo={apoyoAdaptativo(pasos, p, intentosOpciones, elegidas)} borrador={borradorOpcion}
            onElegir={(opcion) => elegir(p, opcion)}
            onContinuar={() => { if (!fin && k === visibles && puedeContinuar(p, intentosOpciones)) { setBorradorOpcion(null); setHasta(k + 1); } }} />}
          {p.tipo === "voz" && !fin && <BloqueVoz p={p} noticiaId={noticia.id} onFin={terminar}
            elecciones={eleccionesParaJuez(pasos, elegidas)} texto={respuestaVoz} onTextoChange={setRespuestaVoz} porVoz={porVoz} onBusyChange={(busy) => { if (busy) audio.current?.stop(); setJudgeBusy(busy); }} />}
          {"id" in p && emociones[p.id] && <EmocionRespuestaCard estado={emociones[p.id]} />}
        </div>
      ))}
      {visibles < pasos.length - 1 && !fin && <p className="pd-candado">Confirma tu elección y pulsa Continuar para abrir el siguiente paso.</p>}
      {fin && <div ref={ultimo}><InformeFinal resultado={fin} /></div>}
    </div>
  );
}
