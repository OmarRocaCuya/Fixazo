"use client";
// Flujo de una noticia: fragmentos reales intercalados con preguntas; responder desbloquea lo siguiente.
// La pregunta de voz usa la capa de Daniel: transcriptor del navegador, analizador de audio local
// (brillo y pausas) y detector de muletillas y palabras de duda.
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AudioAnalyzer } from "@/lib/browser/audio";
import { createTranscriber, speechRecognitionSupported, type Transcriber } from "@/lib/browser/transcriber";
import { voiceErrorMessage } from "@/lib/browser/voice-support";
import { guardarResultado, idAlumno, type ResultadoNoticia } from "@/lib/periodico/progreso";
import type { Fragmento, NoticiaPublica, PreguntaOpciones, PreguntaVozPublica, RespuestaVoz } from "@/lib/periodico/tipos";
import { countFillers, detectLongPauses } from "@/lib/signals/prosody";
import type { FrameFeature } from "@/lib/types";

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
  listo: boolean;
  intentos: number;
  criterios: RespuestaVoz["criterios"];
  texto: string;
  frames: FrameFeature[];
  porVoz: boolean;
}

function BloqueVoz({ p, noticiaId, onFin }: { p: PreguntaVozPublica; noticiaId: string; onFin: (r: FinVoz) => void }) {
  const brillo = useBrillo();
  const [texto, setTexto] = useState("");
  const [estado, setEstado] = useState<"quieto" | "escuchando" | "pensando" | "listo">("quieto");
  const [retro, setRetro] = useState<{ texto: string; bien: boolean } | null>(null);
  const [aviso, setAviso] = useState("");
  const [pista, setPista] = useState(0);
  const intentos = useRef(0);
  const [respondidas, setRespondidas] = useState(0);
  const porVoz = useRef(false);
  const frames = useRef<FrameFeature[]>([]);
  const trans = useRef<Transcriber | null>(null);
  const audio = useRef<AudioAnalyzer | null>(null);
  const puedeHablar = useSyncExternalStore(() => () => undefined, speechRecognitionSupported, () => false);

  useEffect(() => () => {
    trans.current?.abort();
    audio.current?.stop();
  }, []);

  async function enviar(t: string) {
    if (!t.trim()) return;
    setEstado("pensando");
    brillo.estado("pensando");
    let d: RespuestaVoz & { cuenta?: boolean };
    try {
      const r = await fetch("/api/periodico/responder", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: AbortSignal.timeout(20_000),
        body: JSON.stringify({ noticiaId, preguntaId: p.id, texto: t, intento: intentos.current + 1, alumno: idAlumno() }),
      });
      if (!r.ok) throw new Error(String(r.status));
      d = await r.json();
    } catch {
      d = { criterios: [], retro: `Sigamos pensando. ${p.pistas[0] ?? ""}`, listo: false, ia: false, cuenta: false };
    }
    brillo.estado("quieto");
    if (d.cuenta) {
      intentos.current++;
      setRespondidas(intentos.current);
    }
    setRetro({ texto: d.retro, bien: d.listo });
    if (d.listo || intentos.current >= 2) {
      setEstado("listo");
      onFin({ listo: d.listo, intentos: intentos.current, criterios: d.criterios, texto: t, frames: frames.current, porVoz: porVoz.current });
    } else setEstado("quieto");
  }

  async function alternarMic() {
    if (estado === "escuchando") {
      const final = (await trans.current?.stop()) ?? texto;
      audio.current?.stop();
      audio.current = null;
      const t = final.trim() || texto;
      setTexto(t);
      if (t.trim()) void enviar(t);
      else {
        setEstado("quieto");
        brillo.estado("quieto");
      }
      return;
    }
    const tr = createTranscriber("es");
    if (!tr) {
      setAviso(voiceErrorMessage("unsupported"));
      return;
    }
    trans.current = tr;
    const base = texto.trim() ? `${texto.trim()} ` : "";
    setAviso("");
    setRetro(null);
    frames.current = [];
    porVoz.current = true;
    tr.start({
      onText: (t) => setTexto(base + t),
      onError: (code) => {
        setAviso(voiceErrorMessage(code));
        setEstado("quieto");
        brillo.estado("quieto");
        audio.current?.stop();
      },
    });
    setEstado("escuchando");
    brillo.estado("escuchando");
    const an = new AudioAnalyzer();
    audio.current = an;
    an.start()
      .then(() => an.subscribe((f) => {
        frames.current.push(f);
        brillo.nivel(f.rms * 8);
      }))
      .catch(() => undefined); // sin medidor el brillo respira igual
  }

  return (
    <>
      <div className="pd-bloque pd-pregunta">
        <div className="pd-tipo">{p.etiqueta}</div>
        <h2>{p.titulo}</h2>
        <textarea
          id={`r-${p.id}`}
          className="pd-respuesta"
          rows={3}
          aria-label="Tu respuesta"
          placeholder={puedeHablar ? "Lo que digas aparece aquí. También puedes escribir." : "Escribe tu respuesta aquí…"}
          value={texto}
          disabled={estado === "listo" || estado === "pensando"}
          onChange={(e) => setTexto(e.target.value)}
        />
        {aviso && <p className="pd-aviso">{aviso}</p>}
        {pista > 0 && <p className="pd-retro">Pista: {p.pistas[pista - 1]}</p>}
        {retro && <p className={`pd-retro${retro.bien ? " bien" : ""}`}>{retro.texto}</p>}
        {estado === "listo" && !retro?.bien && <p className="pd-aviso">Seguimos. Mañana volvemos a esta idea.</p>}
        {estado !== "listo" && (
          <div className="pd-acciones">
            {texto.trim() && estado === "quieto" && (
              <button type="button" className="btn primary" onClick={() => void enviar(texto)}>Enviar</button>
            )}
            {pista < p.pistas.length && estado === "quieto" && (
              <button type="button" className="btn ghost" onClick={() => setPista((n) => n + 1)}>Pedir pista</button>
            )}
          </div>
        )}
      </div>
      {estado !== "listo" && puedeHablar && (
        <div className="pd-zona-mic">
          <p className="pd-estado" aria-live="polite">
            {estado === "escuchando" ? "Te escucho… toca para terminar" : estado === "pensando" ? "Leyendo tu respuesta…" : respondidas ? "Toca para responder otra vez" : "Toca para hablar"}
          </p>
          <button
            type="button"
            className={`pd-mic${estado === "escuchando" ? " activo" : ""}`}
            aria-pressed={estado === "escuchando"}
            aria-label={estado === "escuchando" ? "Terminar de hablar" : "Empezar a hablar"}
            disabled={estado === "pensando"}
            onClick={() => void alternarMic()}
          >
            <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
            </svg>
            <span className="stop" aria-hidden="true" />
          </button>
          <button type="button" className="pd-escribir" onClick={() => document.getElementById(`r-${p.id}`)?.focus()}>o escribe tu respuesta</button>
        </div>
      )}
    </>
  );
}

export default function NoticiaFlow({ noticia }: { noticia: NoticiaPublica }) {
  const [hasta, setHasta] = useState(0);
  const [elegidas, setElegidas] = useState<Elegidas>({});
  const [fin, setFin] = useState<ResultadoNoticia | null>(null);
  const ultimo = useRef<HTMLDivElement | null>(null);
  const pasos = noticia.pasos;

  // Los fragmentos no esperan respuesta: muestran también el paso siguiente.
  const visibles = (() => {
    let n = hasta;
    while (n < pasos.length - 1 && pasos[n].tipo === "fragmento") n++;
    return n;
  })();

  useEffect(() => {
    if (hasta > 0) bajar(ultimo.current);
  }, [hasta]);

  function avanzar(desde: number) {
    setTimeout(() => setHasta((h) => Math.max(h, desde + 1)), 650);
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
    if (voz) habilidades[voz.habilidad] = v.listo;
    const senales = countFillers(v.texto);
    const r: ResultadoNoticia = {
      noticiaId: noticia.id,
      titular: noticia.titular,
      fecha: new Date().toISOString(),
      habilidades,
      postura,
      seguridad,
      decision,
      voz: {
        listo: v.listo,
        intentos: v.intentos,
        criterios: v.criterios.map(({ nombre, cumple }) => ({ nombre, cumple })),
        dudas: senales.hedges,
        muletillas: senales.fillers,
        pausasLargas: v.porVoz && v.frames.length ? detectLongPauses(v.frames).length : null,
        segundosHablando: v.porVoz && v.frames.length ? Math.round((v.frames.at(-1)!.t - v.frames[0].t) / 1000) : null,
        porVoz: v.porVoz,
      },
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
        <div className="eyebrow">{noticia.seccion} · noticia del día</div>
        <h1>{noticia.titular}</h1>
        <p className="pd-bajada">{noticia.bajada}</p>
        <p className="muted small">{noticia.minutos} min · {pasos.filter((p) => p.tipo !== "fragmento").length} preguntas · 🎤 1 con tu voz</p>
      </header>
      {pasos.slice(0, visibles + 1).map((p, k) => (
        <div key={"id" in p ? p.id : `frag-${k}`} ref={k === visibles ? ultimo : undefined}>
          {p.tipo === "fragmento" && <BloqueFragmento f={p} />}
          {p.tipo === "opciones" && (
            <BloqueOpciones
              p={p}
              elegida={elegidas[p.id]}
              onElegir={(o) => {
                setElegidas((e) => ({ ...e, [p.id]: o }));
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
          <h2>Lo que hiciste hoy</h2>
          <ul className="pd-lista-logros">
            {Object.entries(fin.habilidades).map(([h, ok]) => (
              <li key={h}><span>{h}</span><span className="muted">{ok ? "Lo lograste" : "Para practicar"}</span></li>
            ))}
          </ul>
          <div className="row">
            <Link className="btn primary" href="/insights">Ver mis insights</Link>
            <Link className="btn ghost" href="/">Volver a la portada</Link>
          </div>
        </div>
      )}
    </div>
  );
}
