"use client";
import { TranslatedText } from "@/components/i18n/LanguageProvider";

// Authored passages/options remain fixed. The protocol adapts support, not truth or learner traits.
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { guardarAvance, guardarResultado, leerAvance, leerResultados, registrarVozQuiz, type Avance, type ResultadoNoticia } from "@/lib/periodico/progreso";
import { acumularMetricas, emocionDesdeEstimacion, type MetricasVoz } from "@/lib/periodico/voz-quiz";
import { estimarEmocionRespuesta } from "@/lib/browser/quiz-emotion";
import { calcularRacha, type Racha } from "@/lib/periodico/racha";
import type { Fragmento, NoticiaPublica, PreguntaOpciones, PreguntaVozPublica, RespuestaVoz } from "@/lib/periodico/tipos";
import { apoyoAdaptativo, capacidadEvaluador, eleccionesParaJuez, MAX_INTENTOS_OPCIONES, opcionDesdeVoz, puedeContinuar, registrarIntento, restaurarIntentos, resumenProtocolo, type IntentosOpciones } from "@/lib/periodico/adaptacion";
import { countFillers } from "@/lib/signals/prosody";
import type { QuizAnswerAudio, QuizAudioTranscript } from "@/lib/browser/quiz-microphone";
import { EmocionRespuestaCard, type EstadoEmocion } from "./EmocionRespuesta";
import { applyVoiceEvaluation } from "./voz-state";
import { QuizAudioPanel, type QuizAudioHandle } from "./QuizAudioPanel";
import { InformeFinal } from "./InformeFinal";
import { publishCompanionEmotion, publishCompanionValidation } from "@/lib/browser/voice-companion";

interface BorradorOpcion { preguntaId: string; opcion: number | null }

function bajar(el: HTMLElement | null) {
  const reducir = typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  el?.scrollIntoView({ block: "start", behavior: reducir ? "auto" : "smooth" });
}

function BloqueFragmento({ f }: { f: Fragmento }) {
  return (
    <div className={`pd-bloque pd-frag ${f.lado}`}>
      <div className="pd-frag-medio">{f.medio} · {f.fecha}</div>
      <blockquote><TranslatedText text={f.texto} /></blockquote>
      <p className="pd-frag-ref"><TranslatedText text={f.titular} /> · <a href={f.url} target="_blank" rel="noopener noreferrer"><TranslatedText text="Leer la nota completa" /></a></p>
    </div>
  );
}

export function BloqueOpciones({ p, intentos, activa, apoyo, borrador, onElegir, onContinuar, onVolverAlTexto }: {
  p: PreguntaOpciones; intentos: number[]; activa: boolean;
  apoyo: ReturnType<typeof apoyoAdaptativo>; borrador: BorradorOpcion | null;
  onElegir: (k: number) => void; onContinuar: () => void;
  onVolverAlTexto?: () => void;
}) {
  const elegida = intentos.at(-1);
  const respondida = elegida !== undefined;
  const acerto = p.correcta !== null && elegida === p.correcta;
  const agotada = p.correcta === null ? respondida : acerto || intentos.length >= MAX_INTENTOS_OPCIONES;
  const revelar = p.correcta !== null && (acerto || intentos.length >= MAX_INTENTOS_OPCIONES);
  const draft = activa && !agotada && borrador?.preguntaId === p.id ? borrador : null;
  return (
    <div className="pd-bloque pd-pregunta">
      <div className="pd-tipo"><TranslatedText text={p.etiqueta} /></div>
      <h2><TranslatedText text={p.titulo} /></h2>
      <div className="pd-ops">
        {p.opciones.map((o, k) => (
          <button key={o} type="button"
            className={`pd-op${revelar && k === p.correcta ? " correcta" : ""}${k === elegida ? " elegida" : ""}`}
            disabled={!activa || agotada} aria-pressed={k === elegida}
            onClick={() => onElegir(k)}>
            <span className="muted">{k + 1}. </span><TranslatedText text={o} />
          </button>
        ))}
      </div>
      <p className={`pd-retro${acerto ? " bien" : ""}`} role="status">{apoyo.mensaje}</p>
      {activa && respondida && p.correcta !== null && !acerto && onVolverAlTexto && (
        <div className="pd-acciones">
          <button type="button" className="btn ghost" onClick={onVolverAlTexto}><TranslatedText text="Volver al texto" /></button>
        </div>
      )}
      {draft && (
        <div className="pd-aviso" role="status">
          {draft.opcion === null
            ? <p><TranslatedText text="No pude identificar una sola opción. Di su número o elige con los botones; no se ha enviado una respuesta." /></p>
            : <><p><TranslatedText text="Por voz se preseleccionó: «" />{p.opciones[draft.opcion]}<TranslatedText text="». Revisa antes de confirmar." /></p>
              <button type="button" className="btn ghost" onClick={() => onElegir(draft.opcion!)}><TranslatedText text="Confirmar esta opción de voz" /></button></>}
        </div>
      )}
      {activa && (
        <div className="pd-acciones">
          {p.correcta !== null && <p className="muted small">{intentos.length} <TranslatedText text="de" />{" "}{MAX_INTENTOS_OPCIONES} <TranslatedText text="elecciones · una revisión con apoyo como máximo" /></p>}
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

interface RetroVoz { texto: string; bien: boolean; evaluada: boolean }

/** Transient review state; never persisted or used as a learner profile. */
export interface RevisionVoz {
  preguntaId: string; texto: string; porVoz: boolean; intentos: number;
  retro: RetroVoz | null; finalizada: boolean;
}

/** Audio is owned by the single foreground panel; this block only reviews/submits text. */
export function BloqueVoz({ p, noticiaId, onFin, elecciones = [], texto: textoExterno, onTextoChange, porVoz: porVozExterno, onBusyChange, onVolverAlTexto, revisionVoz, onRevisionVozChange }: {
  p: PreguntaVozPublica; noticiaId: string; onFin: (r: FinVoz) => void;
  elecciones?: Array<{ preguntaId: string; opcion: number }>;
  texto?: string; onTextoChange?: (texto: string) => void; porVoz?: boolean; onBusyChange?: (busy: boolean) => void;
  onVolverAlTexto?: () => void; revisionVoz?: RevisionVoz | null; onRevisionVozChange?: (revision: RevisionVoz) => void;
}) {
  const revision = revisionVoz?.preguntaId === p.id ? revisionVoz : null;
  const porVoz = porVozExterno ?? revision?.porVoz ?? false;
  const [textoLocal, setTextoLocal] = useState(revision?.texto ?? "");
  const texto = textoExterno ?? textoLocal;
  const setTexto = onTextoChange ?? setTextoLocal;
  const [estado, setEstado] = useState<"quieto" | "pensando" | "listo">(revision?.finalizada ? "listo" : "quieto");
  const [retro, setRetro] = useState<RetroVoz | null>(revision?.retro ?? null);
  const [pista, setPista] = useState(0);
  const [capacidad, setCapacidad] = useState({ enabled: false, reason: "Comprobando disponibilidad de evaluación…" });
  const intentos = useRef(revision?.intentos ?? 0);
  const [respondidas, setRespondidas] = useState(revision?.intentos ?? 0);
  const requestEpoch = useRef(0);
  const pending = useRef<AbortController | null>(null);
  const busyCallback = useRef(onBusyChange);
  useEffect(() => { busyCallback.current = onBusyChange; }, [onBusyChange]);
  useEffect(() => {
    onRevisionVozChange?.({ preguntaId: p.id, texto, porVoz, intentos: respondidas, retro, finalizada: estado === "listo" });
  }, [p.id, texto, porVoz, respondidas, retro, estado, onRevisionVozChange]);

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
    const stop = () => {
      requestEpoch.current++;
      if (pending.current) publishCompanionValidation(null);
      pending.current?.abort(); pending.current = null; busyCallback.current?.(false);
    };
    const visibility = () => {
      if (document.visibilityState !== "hidden" || !pending.current) return;
      stop(); setEstado((current) => current === "listo" ? current : "quieto");
      setRetro({ texto: "La espera se detuvo al salir. No se cuenta una evaluación pendiente.", bien: false, evaluada: false });
    };
    document.addEventListener("visibilitychange", visibility);
    const languageChanged = () => {
      if (!pending.current) return;
      stop(); setEstado((current) => current === "listo" ? current : "quieto");
    };
    window.addEventListener("fixazo:language-changing", languageChanged);
    window.addEventListener("pagehide", languageChanged);
    return () => {
      stop(); document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("fixazo:language-changing", languageChanged); window.removeEventListener("pagehide", languageChanged);
    };
  }, []);

  function terminarSinEvaluacion() {
    publishCompanionValidation(null);
    requestEpoch.current++; pending.current?.abort(); pending.current = null; busyCallback.current?.(false);
    setEstado("listo");
    setRetro({ texto: "Lectura terminada sin evaluación de la explicación. No se registra una habilidad como lograda o por practicar.", bien: false, evaluada: false });
    onFin({ evaluada: false, listo: false, intentos: intentos.current, criterios: [], texto, porVoz: false });
  }

  async function enviar() {
    if (!texto.trim() || texto.length > 800 || !capacidad.enabled || estado !== "quieto") return;
    const epoch = ++requestEpoch.current;
    const controller = new AbortController(); pending.current = controller;
    setEstado("pensando"); busyCallback.current?.(true);
    publishCompanionValidation("thinking");
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
    // Evaluation and vocal emotion are independent; unavailable/opinion is not a grade.
    publishCompanionValidation(outcome.evaluated ? d.listo ? "success" : "retry" : null);
    intentos.current = outcome.attempts; setRespondidas(outcome.attempts);
    const feedback = { texto: outcome.evaluated ? d.retro : `Sin evaluación: ${d.retro}`, bien: outcome.evaluated && d.listo, evaluada: outcome.evaluated };
    setRetro(feedback);
    // Save before onFin can unmount this block; pending requests are never restored.
    onRevisionVozChange?.({ preguntaId: p.id, texto, porVoz, intentos: outcome.attempts, retro: feedback, finalizada: outcome.complete });
    if (outcome.complete) {
      setEstado("listo");
      onFin({ evaluada: true, listo: d.listo, intentos: outcome.attempts, criterios: d.criterios, texto, porVoz });
    } else setEstado("quieto");
  }

  return (
    <div className="pd-bloque pd-pregunta">
      <div className="pd-tipo"><TranslatedText text={p.etiqueta} /></div>
      <h2><TranslatedText text={p.titulo} /></h2>
      <p className="muted small"><TranslatedText text="Relaciona tu elección inicial, el fragmento nuevo y la decisión de mantener o cambiar. Usa evidencia del texto. El micrófono es opcional; solo se envía el texto visible. Revisa y edita la transcripción antes de enviar: el último audio puede seguir pendiente." /></p>
      <p className="muted small"><TranslatedText text="La evaluación por IA es una demo y puede equivocarse." /></p>
      <p className="pd-aviso" role="status">{capacidad.reason}</p>
      <label htmlFor={`r-${p.id}`}><TranslatedText text="Tu explicación (" />{texto.length}<TranslatedText text="/800 caracteres)" /></label>
      <textarea id={`r-${p.id}`} className="pd-respuesta" rows={4} aria-label="Tu respuesta"
        placeholder="Escribe o activa el panel de voz. La transcripción nunca se envía automáticamente."
        value={texto} maxLength={800} disabled={estado !== "quieto"} onChange={(e) => setTexto(e.target.value)} />
      {pista > 0 && <p className="pd-retro"><TranslatedText text="Pista:" />{" "}{p.pistas[pista - 1]}</p>}
      {retro && <p className={`pd-retro${retro.bien ? " bien" : ""}`} role="status">{retro.texto}</p>}
      {respondidas > 0 && <p className="muted small">{respondidas} <TranslatedText text="de 2 intentos evaluados" /></p>}
      {retro?.evaluada && !retro.bien && estado !== "pensando" && onVolverAlTexto && <div className="pd-acciones"><button type="button" className="btn ghost" onClick={onVolverAlTexto}><TranslatedText text="Volver al texto" /></button></div>}
      {estado === "pensando" && <p role="status"><TranslatedText text="Leyendo tu explicación… micrófono detenido." /></p>}
      {estado === "listo" && retro?.bien === false && respondidas >= 2 && <p className="pd-aviso"><TranslatedText text="Terminaste los intentos evaluados. Puedes revisar esta idea con un docente." /></p>}
      {estado === "quieto" && (
        <div className="pd-acciones">
          {capacidad.enabled && texto.trim() && <button type="button" className="btn primary" disabled={texto.length > 800} onClick={() => void enviar()}><TranslatedText text="Pedir evaluación de mi respuesta" /></button>}
          {pista < p.pistas.length && <button type="button" className="btn ghost" onClick={() => setPista((n) => n + 1)}><TranslatedText text="Pedir pista" /></button>}
          <button type="button" className="btn ghost" onClick={terminarSinEvaluacion}><TranslatedText text="Continuar sin evaluación" /></button>
        </div>
      )}
    </div>
  );
}

interface ApoyosLectura {
  embedded?: boolean;
  onVolverAlTexto?: () => void;
  revisionVoz?: RevisionVoz | null;
  onRevisionVozChange?: (revision: RevisionVoz) => void;
}

export default function NoticiaFlow({ noticia, ...apoyos }: { noticia: NoticiaPublica } & ApoyosLectura) {
  const enNavegador = useSyncExternalStore(() => () => undefined, () => true, () => false);
  if (!enNavegador) return <div className="pd-flujo"><p className="pd-vacio"><TranslatedText text="Cargando…" /></p></div>;
  const r = leerResultados()[noticia.id];
  return <Flujo key={noticia.id} noticia={noticia} inicial={leerAvance(noticia.id)} terminada={r && !r.enCurso ? r : null} {...apoyos} />;
}

function Flujo({ noticia, inicial, terminada, embedded = false, onVolverAlTexto, revisionVoz, onRevisionVozChange }: { noticia: NoticiaPublica; inicial: Avance | null; terminada: ResultadoNoticia | null } & ApoyosLectura) {
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
  // Solo al terminar en esta visita: reabrir una noticia no suma otro día.
  const [racha, setRacha] = useState<Racha | null>(null);
  const [borradorOpcion, setBorradorOpcion] = useState<BorradorOpcion | null>(null);
  const [respuestaVoz, setRespuestaVoz] = useState(revisionVoz?.texto ?? "");
  const [porVoz, setPorVoz] = useState(revisionVoz?.porVoz ?? false);
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
  const hastaAnterior = useRef(hasta);
  let visibles = hasta;
  while (visibles < pasos.length - 1 && pasos[visibles].tipo === "fragmento") visibles++;
  const activa = pasos[visibles];
  const activeId = activa && "id" in activa && !fin ? activa.id : null;

  useEffect(() => {
    const renew = () => {
      emotionAbort.current?.abort(); emotionAbort.current = new AbortController();
      emocionPedida.current.clear(); publishCompanionEmotion(null);
    };
    const hidden = () => { if (document.hidden) renew(); };
    renew(); window.addEventListener("fixazo:language-changing", renew);
    window.addEventListener("pagehide", renew);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      emotionAbort.current?.abort(); publishCompanionEmotion(null);
      window.removeEventListener("fixazo:language-changing", renew);
      window.removeEventListener("pagehide", renew);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [activeId]);

  useEffect(() => {
    if (fin) return; // Opening a completed report must not recreate a draft.
    guardarAvance(noticia.id, { hasta, elegidas: Object.fromEntries(Object.entries(intentosOpciones).map(([id, elecciones]) => [id, elecciones.at(-1)!])), intentosOpciones, inicialesDesconocidas });
    if (hasta > 0 && (!embedded || hasta !== hastaAnterior.current)) bajar(ultimo.current);
    hastaAnterior.current = hasta;
  }, [hasta, intentosOpciones, inicialesDesconocidas, noticia.id, fin, embedded]);

  function guardarParcial(historial: IntentosOpciones) {
    const habilidades: Record<string, boolean> = {};
    for (const p of pasos) if (p.tipo === "opciones" && p.habilidad && p.correcta !== null && historial[p.id]?.length) habilidades[p.habilidad] = historial[p.id].at(-1) === p.correcta;
    guardarResultado({ noticiaId: noticia.id, enCurso: true, titular: noticia.titular, fecha: new Date().toISOString(), habilidades, postura: null, seguridad: null, decision: null, voz: null, protocolo: resumenProtocolo(pasos, historial, inicialesDesconocidas) });
  }

  function elegir(p: PreguntaOpciones, opcion: number) {
    if (fin || p.id !== activeId) return;
    const nuevas = registrarIntento(p, intentosOpciones, opcion);
    if (nuevas === intentosOpciones) return;
    publishCompanionValidation(p.correcta === null ? null : opcion === p.correcta ? "success" : "retry");
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
      publishCompanionEmotion(estimate.source === "voz-emotion2vec" ? estimate.label : null);
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
    guardarResultado(r);
    setRacha(calcularRacha(Object.values(leerResultados()).filter((x) => !x.enCurso).map((x) => x.fecha)));
    setFin(leerResultados()[noticia.id] ?? r); setRespuestaVoz(""); setBorradorOpcion(null);
    setTimeout(() => bajar(ultimo.current), 300);
  }

  return (
    <div className="pd-flujo">
      {!embedded && <header className="pd-noticia-cabeza">
        <div className="eyebrow"><TranslatedText text={noticia.seccion} /></div>
        <h1><TranslatedText text={noticia.titular} /></h1>
        <p className="pd-bajada"><TranslatedText text={noticia.bajada} /></p>
        <p className="muted small">{noticia.minutos} <TranslatedText text="min" /></p>
      </header>}
      {!fin && <QuizAudioPanel ref={audio} stepId={activeId} paused={judgeBusy || capturePaused} onTranscript={recibirTranscripcion} onAnswerAudio={recibirAudio} />}
      {avisoAudio && !fin && <p role="status" className="pd-aviso">{avisoAudio}</p>}
      {pasos.slice(0, visibles + 1).map((p, k) => (
        <div key={"id" in p ? p.id : `frag-${k}`} ref={k === visibles ? ultimo : undefined}>
          {p.tipo === "fragmento" && <BloqueFragmento f={p} />}
          {/* Una idea a la vez: las preguntas ya cerradas quedan plegadas en una línea. */}
          {p.tipo === "opciones" && elegidas[p.id] !== undefined && k < visibles && (
            <details className="pd-cerrado">
              <summary><span className="pd-tipo">{p.etiqueta.split(" · ")[0]}</span><span><TranslatedText text={p.opciones[elegidas[p.id]]} /></span></summary>
              <BloqueOpciones p={p} intentos={intentosOpciones[p.id] ?? []} activa={false}
                apoyo={apoyoAdaptativo(pasos, p, intentosOpciones, elegidas)} borrador={null}
                onElegir={() => undefined} onContinuar={() => undefined} />
            </details>
          )}
          {p.tipo === "opciones" && !(elegidas[p.id] !== undefined && k < visibles) && <BloqueOpciones p={p} intentos={intentosOpciones[p.id] ?? []} activa={!fin && k === visibles}
            apoyo={apoyoAdaptativo(pasos, p, intentosOpciones, elegidas)} borrador={borradorOpcion}
            onVolverAlTexto={onVolverAlTexto}
            onElegir={(opcion) => elegir(p, opcion)}
            onContinuar={() => { if (!fin && k === visibles && puedeContinuar(p, intentosOpciones)) { setBorradorOpcion(null); setHasta(k + 1); } }} />}
          {p.tipo === "voz" && !fin && <BloqueVoz p={p} noticiaId={noticia.id} onFin={terminar}
            onVolverAlTexto={onVolverAlTexto} revisionVoz={revisionVoz} onRevisionVozChange={onRevisionVozChange}
            elecciones={eleccionesParaJuez(pasos, elegidas)} texto={respuestaVoz} onTextoChange={setRespuestaVoz} porVoz={porVoz} onBusyChange={(busy) => { if (busy) audio.current?.stop(); setJudgeBusy(busy); }} />}
          {"id" in p && emociones[p.id] && <EmocionRespuestaCard estado={emociones[p.id]} />}
        </div>
      ))}
      {visibles < pasos.length - 1 && !fin && <p className="pd-candado"><TranslatedText text="Confirma tu elección y pulsa Continuar para abrir el siguiente paso." /></p>}
      {fin && <div ref={ultimo}>
        {racha?.estado === "hoy" && <p className="pd-racha-fin">🔥 <TranslatedText text="Sumaste el día" /> {racha.dias} <TranslatedText text="de tu racha" />{racha.marca ? <>. {racha.marca} <TranslatedText text="días seguidos leyendo con criterio" /></> : null}</p>}
        <InformeFinal resultado={fin} />
        {fin.voz && !fin.voz.listo && onVolverAlTexto && <button type="button" className="btn ghost" onClick={onVolverAlTexto}><TranslatedText text="Volver al texto" /></button>}
      </div>}
    </div>
  );
}
