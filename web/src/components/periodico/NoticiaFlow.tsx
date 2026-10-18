"use client";
// Flujo de una noticia: fragmentos reales intercalados con preguntas; responder desbloquea lo siguiente.
// La pregunta de voz usa la capa de Daniel: transcriptor del navegador, analizador de audio local
// (brillo y pausas) y detector de muletillas y palabras de duda.
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AudioAnalyzer } from "@/lib/browser/audio";
import { createTranscriber, speechRecognitionSupported, type Transcriber } from "@/lib/browser/transcriber";
import { voiceErrorMessage } from "@/lib/browser/voice-support";
import { guardarAvance, guardarResultado, leerAvance, leerResultados, type Avance, type ResultadoNoticia } from "@/lib/periodico/progreso";
import type { Fragmento, NoticiaPublica, PreguntaOpciones, PreguntaVozPublica, RespuestaVoz } from "@/lib/periodico/tipos";
import { countFillers, detectLongPauses } from "@/lib/signals/prosody";
import type { FrameFeature } from "@/lib/types";
import { applyVoiceEvaluation, RecordingAnswer } from "./voz-state";

type Elegidas = Record<string, number>;

function bajar(el: HTMLElement | null) {
  const reducir = typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  el?.scrollIntoView({ block: "start", behavior: reducir ? "auto" : "smooth" });
}

function BloqueFragmento({ f }: { f: Fragmento }) {
  return (
    <div className={`pd-bloque pd-frag ${f.lado}`}>
      <div className="pd-frag-medio">{f.medio} · {f.fecha}</div>
      <blockquote>{f.texto}</blockquote>
      <p className="pd-frag-ref">
        {f.titular} · <a href={f.url} target="_blank" rel="noopener noreferrer">Leer la nota completa</a>
      </p>
    </div>
  );
}

function BloqueOpciones({ p, elegida, onElegir }: { p: PreguntaOpciones; elegida: number | undefined; onElegir: (k: number) => void }) {
  const respondida = elegida !== undefined;
  const acerto = p.correcta === null || elegida === p.correcta;
  return (
    <div className="pd-bloque pd-pregunta">
      <div className="pd-tipo">{p.etiqueta}</div>
      <h2>{p.titulo}</h2>
      <div className="pd-ops">
        {p.opciones.map((o, k) => (
          <button
            key={o}
            type="button"
            className={`pd-op${respondida && k === p.correcta ? " correcta" : ""}${respondida && k === elegida ? " elegida" : ""}`}
            disabled={respondida}
            aria-pressed={k === elegida}
            onClick={() => onElegir(k)}
          >
            {o}
          </button>
        ))}
      </div>
      {respondida && <p className={`pd-retro${acerto ? " bien" : ""}`}>{acerto ? p.bien : p.otra}</p>}
    </div>
  );
}

// --- Brillo de bordes: sigue el volumen con suavizado (sube rápido, baja lento) ---
function useBrillo() {
  const objetivo = useRef(0);
  useEffect(() => {
    let actual = 0;
    let raf = 0;
    const paso = () => {
      actual += (objetivo.current - actual) * (objetivo.current > actual ? 0.1 : 0.035);
      document.documentElement.style.setProperty("--pd-nivel", actual.toFixed(3));
      raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => {
      cancelAnimationFrame(raf);
      document.body.classList.remove("pd-escuchando", "pd-pensando");
    };
  }, []);
  return {
    nivel: (v: number) => (objetivo.current = Math.max(0, Math.min(1, v))),
    estado: (e: "escuchando" | "pensando" | "quieto") => {
      document.body.classList.toggle("pd-escuchando", e === "escuchando");
      document.body.classList.toggle("pd-pensando", e === "pensando");
      objetivo.current = e === "pensando" ? 0.3 : e === "escuchando" ? 0.4 : 0;
    },
  };
}

interface FinVoz {
  evaluada: boolean;
  listo: boolean;
  intentos: number;
  criterios: RespuestaVoz["criterios"];
  texto: string;
  frames: FrameFeature[];
  porVoz: boolean;
}

export function BloqueVoz({ p, noticiaId, onFin }: { p: PreguntaVozPublica; noticiaId: string; onFin: (r: FinVoz) => void }) {
  const brillo = useBrillo();
  const [texto, setTexto] = useState("");
  const [estado, setEstado] = useState<"quieto" | "escuchando" | "pensando" | "listo">("quieto");
  const [retro, setRetro] = useState<{ texto: string; bien: boolean } | null>(null);
  const [aviso, setAviso] = useState("");
  const [pista, setPista] = useState(0);
  const [capacidad, setCapacidad] = useState({ enabled: false, reason: "Comprobando disponibilidad de evaluación…" });
  const [codigo, setCodigo] = useState("");
  const [autorizado, setAutorizado] = useState(false);
  const intentos = useRef(0);
  const [respondidas, setRespondidas] = useState(0);
  const porVoz = useRef(false);
  const frames = useRef<FrameFeature[]>([]);
  const trans = useRef<Transcriber | null>(null);
  const audio = useRef<AudioAnalyzer | null>(null);
  const recording = useRef(new RecordingAnswer());
  const recordingEpoch = useRef(0);
  const stopping = useRef(false);
  const requestEpoch = useRef(0);
  const pending = useRef<AbortController | null>(null);
  const micTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const puedeHablar = useSyncExternalStore(() => () => undefined, speechRecognitionSupported, () => false);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/periodico/responder", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("unavailable");
        const data = await response.json();
        if (!controller.signal.aborted) setCapacidad({ enabled: data.enabled === true && data.adultOnly === true, reason: typeof data.reason === "string" ? data.reason : "Evaluación no disponible." });
      })
      .catch(() => { if (!controller.signal.aborted) setCapacidad({ enabled: false, reason: "Evaluación no disponible. Puedes leer y continuar sin evaluación." }); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const answer = recording.current;
    const stop = () => {
      answer.cancel();
      trans.current?.abort(); trans.current = null;
      audio.current?.stop(); audio.current = null;
      if (micTimer.current) clearTimeout(micTimer.current);
      requestEpoch.current++; pending.current?.abort();
      document.body.classList.remove("pd-escuchando", "pd-pensando");
    };
    const visibility = () => {
      if (document.visibilityState !== "hidden") return;
      const active = trans.current !== null || pending.current !== null;
      stop();
      if (active) {
        setEstado((current) => current === "listo" ? current : "quieto");
        setAviso("La captura o espera se detuvo al salir de esta pantalla. No se contará una evaluación pendiente.");
      }
    };
    document.addEventListener("visibilitychange", visibility);
    return () => { stop(); document.removeEventListener("visibilitychange", visibility); };
  }, []);

  function terminarSinEvaluacion() {
    requestEpoch.current++; pending.current?.abort();
    recording.current.cancel(); trans.current?.abort(); audio.current?.stop();
    if (micTimer.current) clearTimeout(micTimer.current);
    setEstado("listo"); brillo.estado("quieto");
    setRetro({ texto: "Lectura terminada sin evaluación de voz. No se registra una habilidad como lograda o por practicar.", bien: false });
    onFin({ evaluada: false, listo: false, intentos: intentos.current, criterios: [], texto, frames: [], porVoz: false });
  }

  async function enviar(t: string) {
    if (!t.trim() || !capacidad.enabled || !autorizado || !codigo.trim() || estado !== "quieto") return;
    const epoch = ++requestEpoch.current;
    const controller = new AbortController(); pending.current = controller;
    setEstado("pensando"); brillo.estado("pensando");
    let d: RespuestaVoz;
    try {
      const r = await fetch("/api/periodico/responder", {
        method: "POST",
        headers: { "content-type": "application/json", "x-voice-access-code": codigo.trim() },
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)]),
        body: JSON.stringify({ noticiaId, preguntaId: p.id, texto: t, intento: intentos.current + 1, consent: true, adultConfirmed: true }),
      });
      d = await r.json();
      if (!r.ok && d.evaluacion !== "no_evaluable") throw new Error("unavailable");
      if (typeof d.retro !== "string" || !Array.isArray(d.criterios) || !["evaluada", "no_evaluable"].includes(d.evaluacion)) throw new Error("invalid-response");
    } catch {
      d = { evaluacion: "no_evaluable", criterios: [], retro: "No se pudo evaluar tu respuesta. No gastaste un intento. Puedes reintentar o continuar sin evaluación.", listo: false, ia: false, cuenta: false };
    }
    if (requestEpoch.current !== epoch || controller.signal.aborted) return;
    pending.current = null; brillo.estado("quieto");
    const outcome = applyVoiceEvaluation(d, intentos.current);
    intentos.current = outcome.attempts; setRespondidas(outcome.attempts);
    setRetro({ texto: outcome.evaluated ? d.retro : `Sin evaluación: ${d.retro}`, bien: outcome.evaluated && d.listo });
    if (outcome.complete) {
      setEstado("listo");
      onFin({ evaluada: true, listo: d.listo, intentos: outcome.attempts, criterios: d.criterios, texto: t, frames: frames.current, porVoz: porVoz.current });
    } else setEstado("quieto");
  }

  async function alternarMic() {
    if (!autorizado || stopping.current) return;
    if (estado === "escuchando") {
      const tr = trans.current; if (!tr) return;
      const epoch = recordingEpoch.current;
      stopping.current = true;
      audio.current?.stop(); audio.current = null;
      if (micTimer.current) clearTimeout(micTimer.current);
      let final = "";
      try { final = await tr.stop(); } catch { /* keep the last displayed partial */ }
      tr.abort(); stopping.current = false;
      const answer = recording.current.finish(epoch, final);
      if (answer === null) return;
      trans.current = null; setTexto(answer); setEstado("quieto"); brillo.estado("quieto");
      return; // Reviewing text and sending it are separate, explicit actions.
    }
    if (estado !== "quieto") return;
    const tr = createTranscriber("es");
    if (!tr) { setAviso(voiceErrorMessage("unsupported")); return; }
    trans.current = tr;
    const epoch = recording.current.begin(texto); recordingEpoch.current = epoch;
    setAviso(""); setRetro(null); frames.current = []; porVoz.current = true;
    setEstado("escuchando"); brillo.estado("escuchando");
    tr.start({
      onText: (t) => { const next = recording.current.partial(epoch, t); if (next !== null) setTexto(next); },
      onError: (code) => {
        if (recordingEpoch.current !== epoch || trans.current !== tr) return;
        recording.current.cancel(); trans.current = null;
        setAviso(voiceErrorMessage(code)); setEstado("quieto"); brillo.estado("quieto");
        audio.current?.stop(); audio.current = null;
        if (micTimer.current) clearTimeout(micTimer.current);
      },
    });
    if (trans.current !== tr) return; // start() may report a synchronous failure.
    const an = new AudioAnalyzer(); audio.current = an;
    an.start().then(() => {
      if (trans.current !== tr || recordingEpoch.current !== epoch) { an.stop(); return; }
      an.subscribe((f) => { if (frames.current.length < 2000) frames.current.push(f); brillo.nivel(f.rms * 8); });
    }).catch(() => an.stop());
    micTimer.current = setTimeout(() => {
      if (trans.current !== tr) return;
      recording.current.cancel(); tr.abort(); trans.current = null; an.stop(); audio.current = null;
      setEstado("quieto"); brillo.estado("quieto"); setAviso("Se alcanzó el límite de 60 segundos. Revisa lo transcrito antes de enviarlo.");
    }, 60_000);
  }

  return (
    <>
      <div className="pd-bloque pd-pregunta">
        <div className="pd-tipo">{p.etiqueta}</div>
        <h2>{p.titulo}</h2>
        <p className="muted small">Puedes responder por escrito y terminar la lectura sin evaluación. La evaluación por IA es una demo solo para adultos; puede equivocarse.</p>
        {!capacidad.enabled && <p className="pd-aviso" role="status">{capacidad.reason}</p>}
        {(puedeHablar || capacidad.enabled) && (
          <label className="pd-aviso">
            <input type="checkbox" checked={autorizado} disabled={estado !== "quieto"} onChange={(e) => setAutorizado(e.target.checked)} />{" "}
            Soy adulto y autorizo usar solo mi voz adulta o audio sintético. El reconocedor del navegador puede enviar audio a su proveedor; al pedir evaluación, mi respuesta escrita se envía al proveedor de IA. No incluiré datos personales ni voces de menores.
          </label>
        )}
        {capacidad.enabled && (
          <label>Código privado de la demo
            <input type="password" value={codigo} autoComplete="off" disabled={estado !== "quieto"} onChange={(e) => setCodigo(e.target.value)} />
          </label>
        )}
        <textarea
          id={`r-${p.id}`} className="pd-respuesta" rows={3} aria-label="Tu respuesta"
          placeholder="Escribe tu respuesta aquí. El micrófono es opcional y requiere autorización adulta."
          value={texto} disabled={estado !== "quieto"} onChange={(e) => setTexto(e.target.value)}
        />
        {aviso && <p className="pd-aviso">{aviso}</p>}
        {pista > 0 && <p className="pd-retro">Pista: {p.pistas[pista - 1]}</p>}
        {retro && <p className={`pd-retro${retro.bien ? " bien" : ""}`} role="status">{retro.texto}</p>}
        {estado === "listo" && retro?.bien === false && respondidas >= 2 && <p className="pd-aviso">Terminaste los intentos evaluados. Puedes revisar esta idea con un docente.</p>}
        {estado === "quieto" && (
          <div className="pd-acciones">
            {capacidad.enabled && texto.trim() && <button type="button" className="btn primary" disabled={!autorizado || !codigo.trim()} onClick={() => void enviar(texto)}>Pedir evaluación de mi respuesta</button>}
            {pista < p.pistas.length && <button type="button" className="btn ghost" onClick={() => setPista((n) => n + 1)}>Pedir pista</button>}
            <button type="button" className="btn ghost" onClick={terminarSinEvaluacion}>Continuar sin evaluación</button>
          </div>
        )}
      </div>
      {estado !== "listo" && puedeHablar && (
        <div className="pd-zona-mic">
          <p className="pd-estado" aria-live="polite">{estado === "escuchando" ? "Te escucho… toca para terminar" : estado === "pensando" ? "Leyendo tu respuesta…" : respondidas ? "Toca para ampliar tu respuesta" : "Micrófono opcional (voz adulta)"}</p>
          <button type="button" className={`pd-mic${estado === "escuchando" ? " activo" : ""}`} aria-pressed={estado === "escuchando"}
            aria-label={estado === "escuchando" ? "Terminar de hablar" : "Empezar a hablar"} disabled={estado === "pensando" || !autorizado} onClick={() => void alternarMic()}>
            <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
            <span className="stop" aria-hidden="true" />
          </button>
        </div>
      )}
    </>
  );
}

// En el servidor no hay localStorage: se espera al navegador y se monta con el avance guardado.
export default function NoticiaFlow({ noticia }: { noticia: NoticiaPublica }) {
  const enNavegador = useSyncExternalStore(() => () => undefined, () => true, () => false);
  if (!enNavegador) return <div className="pd-flujo"><p className="pd-vacio">Cargando…</p></div>;
  const r = leerResultados()[noticia.id];
  return <Flujo key={noticia.id} noticia={noticia} inicial={leerAvance(noticia.id)} terminada={r && !r.enCurso ? r : null} />;
}

function Flujo({ noticia, inicial, terminada }: { noticia: NoticiaPublica; inicial: Avance | null; terminada: ResultadoNoticia | null }) {
  const [hasta, setHasta] = useState(inicial?.hasta ?? 0);
  const [elegidas, setElegidas] = useState<Elegidas>(inicial?.elegidas ?? {});
  const [fin, setFin] = useState<ResultadoNoticia | null>(terminada);
  const ultimo = useRef<HTMLDivElement | null>(null);
  const pasos = noticia.pasos;
  const ultimaRespondida = pasos.reduce((m, p, k) => (p.tipo === "opciones" && elegidas[p.id] !== undefined ? k : m), -1);

  // Los fragmentos no esperan respuesta: muestran también el paso siguiente.
  const visibles = (() => {
    let n = hasta;
    while (n < pasos.length - 1 && pasos[n].tipo === "fragmento") n++;
    return n;
  })();

  useEffect(() => {
    if (hasta > 0) bajar(ultimo.current);
    guardarAvance(noticia.id, { hasta, elegidas });
  }, [hasta, elegidas, noticia.id]);

  function avanzar(desde: number) {
    setTimeout(() => setHasta((h) => Math.max(h, desde + 1)), 650);
  }

  // Progreso en vivo para Mis insights mientras la noticia está a medio responder.
  function guardarParcial(e: Elegidas) {
    const habilidades: Record<string, boolean> = {};
    for (const p of pasos) if (p.tipo === "opciones" && p.habilidad && p.correcta !== null && e[p.id] !== undefined) habilidades[p.habilidad] = e[p.id] === p.correcta;
    guardarResultado({ noticiaId: noticia.id, enCurso: true, titular: noticia.titular, fecha: new Date().toISOString(), habilidades, postura: null, seguridad: null, decision: null, voz: null });
  }

  function terminar(v: FinVoz) {
    const habilidades: Record<string, boolean> = {};
    let postura: string | null = null;
    let seguridad: string | null = null;
    let decision: string | null = null;
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
    const r: ResultadoNoticia = {
      noticiaId: noticia.id,
      titular: noticia.titular,
      fecha: new Date().toISOString(),
      habilidades,
      postura,
      seguridad,
      decision,
      voz: v.evaluada ? {
        listo: v.listo,
        intentos: v.intentos,
        criterios: v.criterios.map(({ nombre, cumple }) => ({ nombre, cumple })),
        dudas: senales.hedges,
        muletillas: senales.fillers,
        pausasLargas: v.porVoz && v.frames.length ? detectLongPauses(v.frames).length : null,
        segundosHablando: v.porVoz && v.frames.length ? Math.round((v.frames.at(-1)!.t - v.frames[0].t) / 1000) : null,
        porVoz: v.porVoz,
      } : null,
    };
    guardarResultado(r);
    setFin(r);
    setTimeout(() => bajar(ultimo.current), 300);
  }

  return (
    <div className="pd-flujo">
      <div className="pd-luz halo" aria-hidden="true"><i /></div>
      <div className="pd-luz linea" aria-hidden="true" />
      <header className="pd-noticia-cabeza">
        <div className="eyebrow">{noticia.seccion}</div>
        <h1>{noticia.titular}</h1>
        <p className="pd-bajada">{noticia.bajada}</p>
        <p className="muted small">{noticia.minutos} min</p>
      </header>
      {pasos.slice(0, visibles + 1).map((p, k) => (
        <div key={"id" in p ? p.id : `frag-${k}`} ref={k === visibles ? ultimo : undefined}>
          {p.tipo === "fragmento" && <BloqueFragmento f={p} />}
          {/* Una idea a la vez: las preguntas ya respondidas (menos la última, que muestra su explicación) quedan en una línea. */}
          {p.tipo === "opciones" && elegidas[p.id] !== undefined && k < ultimaRespondida && (
            <details className="pd-cerrado">
              <summary><span className="pd-tipo">{p.etiqueta.split(" · ")[0]}</span><span>{p.opciones[elegidas[p.id]]}</span></summary>
              <BloqueOpciones p={p} elegida={elegidas[p.id]} onElegir={() => undefined} />
            </details>
          )}
          {p.tipo === "opciones" && !(elegidas[p.id] !== undefined && k < ultimaRespondida) && (
            <BloqueOpciones
              p={p}
              elegida={elegidas[p.id]}
              onElegir={(o) => {
                const nuevas = { ...elegidas, [p.id]: o };
                setElegidas(nuevas);
                guardarParcial(nuevas);
                avanzar(k);
              }}
            />
          )}
          {p.tipo === "voz" && <BloqueVoz p={p} noticiaId={noticia.id} onFin={terminar} />}
        </div>
      ))}
      {visibles < pasos.length - 1 && <div className="pd-candado" aria-hidden="true"><span /><span /><span /><p>🔒 Responde para seguir leyendo</p></div>}
      {fin && (
        <div className="pd-bloque pd-pregunta" ref={ultimo}>
          <div className="pd-tipo">Terminaste esta noticia</div>
          <h2>Lo que hiciste en esta lectura</h2>
          {!fin.voz && <p className="muted">Sin evaluación de voz. Esta respuesta no afecta tus habilidades.</p>}
          <ul className="pd-lista-logros">
            {Object.entries(fin.habilidades).map(([h, ok]) => (
              <li key={h}><span>{h}</span><span className="muted">{ok ? "Lo lograste" : "Para practicar"}</span></li>
            ))}
          </ul>
          <div className="row">
            <Link className="btn primary" href="/insights" target="_blank">Ver mis insights</Link>
            <Link className="btn ghost" href="/">Volver a la portada</Link>
          </div>
        </div>
      )}
    </div>
  );
}
