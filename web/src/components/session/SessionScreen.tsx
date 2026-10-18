"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { Confidence } from "@/lib/types";
import { STEP_LABELS, type SessionState } from "@/lib/session/machine";
import { buildJudgmentChain, scoreInfiere, scoreObtiene, scoreReflexiona } from "@/lib/scoring";
import { PAUSE_OFFER } from "@/lib/signals/pace";
import { completedReportHref } from "@/lib/report/family-share";
import { CONFIDENCE_LABELS, Face, Icon, LevelCell, MoodPicker, SignalRow, moodLabel } from "@/components/ui";
import { toChildView } from "@/lib/session/childView";
import { ReadingText } from "./ReadingText";
import { ExperimentalAffectCards } from "./ExperimentalAffectCards";
import { MultilingualReadingSession } from "./MultilingualReadingSession";
import { READ_LIMIT_S, SessionController, type SessionAsrProvider, type Snapshot } from "./controller";

const PILLS = ["CHECK_IN", "READ", "Q_OBTIENE", "Q_INFIERE", "STANCE", "COUNTER", "CHECK_OUT"] as const;
const PILL_LABEL: Record<(typeof PILLS)[number], string> = {
  CHECK_IN: "Cómo llegas",
  READ: "Lee",
  Q_OBTIENE: "Qué dice",
  Q_INFIERE: "Por qué pasó",
  STANCE: "Qué opinas",
  COUNTER: "Contraprueba",
  CHECK_OUT: "Cierre",
};

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

function stepIndex(state: SessionState): number {
  const s = state === "REVISE" ? "COUNTER" : state === "REPORT" || state === "DONE" ? "CHECK_OUT" : state;
  return PILLS.indexOf(s as (typeof PILLS)[number]);
}

export function SessionScreen() {
  const router = useRouter();
  const [ctl] = useState(() => new SessionController());
  const snap = useSyncExternalStore(ctl.subscribe, ctl.getSnapshot, ctl.getServerSnapshot);
  const [adultOpen, setAdultOpen] = useState(false);
  const [multilingualOpen, setMultilingualOpen] = useState(false);

  useEffect(() => {
    ctl.init();
    return () => ctl.dispose();
  }, [ctl]);

  useEffect(() => {
    const href = completedReportHref(snap.phase, snap.reportId);
    if (href) router.replace(href);
  }, [snap.phase, snap.reportId, router]);
  const ctx = snap.ctx;
  const state: SessionState | null = ctx ? (ctx.state === "PAUSED" ? (ctx.resumeState ?? "CHECK_IN") : ctx.state) : null;
  const current = state ? stepIndex(state) : -1;

  const spanishPassage = snap.mission?.lang === "qu" ? snap.mission.textEs : snap.mission?.text;
  if (multilingualOpen && snap.phase === "intro" && snap.mission && spanishPassage) {
    return <MultilingualReadingSession passage={spanishPassage} title={snap.mission.title} onClose={() => setMultilingualOpen(false)} />;
  }

  return (
    <div className="session">
      <header className="s-top">
        <Link href="/chat" className="brand" aria-label="Ñawinchay, volver al chat">
          <span className="brand-mark" aria-hidden="true">Ñ</span>
          <span>Ñawinchay</span>
        </Link>
        {snap.phase === "running" || snap.phase === "saving" || snap.phase === "finished" ? (
          <>
            <ol className="steps" aria-label="Pasos de la misión" style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {PILLS.map((p, i) => (
                <li key={p} className={`step-pill ${i < current || snap.phase === "finished" ? "done" : i === current ? "now" : ""}`} aria-current={i === current ? "step" : undefined}>
                  {i < current || snap.phase === "finished" ? "✓ " : ""}
                  {PILL_LABEL[p]}
                </li>
              ))}
            </ol>
            <div className="steps-dots" aria-hidden="true">
              {PILLS.map((p, i) => (
                <i key={p} className={i < current ? "done" : i === current ? "now" : ""} />
              ))}
              <strong className="small" style={{ marginLeft: 6 }}>
                {state ? STEP_LABELS[state] ?? "" : ""}
              </strong>
            </div>
          </>
        ) : (
          <span />
        )}
        <div className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
          <button type="button" className="btn subtle" onClick={() => ctl.toggleMute()} aria-pressed={snap.muted} aria-label={snap.muted ? "Activar la voz del agente" : "Silenciar la voz del agente"}>
            <Icon name={snap.muted ? "mute" : "sound"} />
          </button>
          {snap.phase === "running" && (
            <button type="button" className="btn pause-btn" onClick={() => ctl.pause()} disabled={ctx?.state === "PAUSED"}>
              <Icon name="pause" /> Pausar
            </button>
          )}
        </div>
      </header>

      <div className="s-body">
        <section className="kid-zone" aria-label="Zona del niño">
          {snap.phase === "intro" && snap.mission && <div className="notice info stack-sm">
            <strong>Sesión multilingüe · demo</strong>
            <p className="small">Prueba esta lectura en quechua Ayacucho o aimara con Meta, traducción y voz por turnos. No modifica la evaluación ni crea informes.</p>
            <button type="button" className="btn subtle" disabled={!spanishPassage || snap.localPreparing || snap.micTesting || snap.micBusy} onClick={() => { ctl.cancelMicrophoneTest(); setMultilingualOpen(true); }}>Abrir lectura multilingüe de esta misión</button>
            {!spanishPassage && <p className="small">Esta misión no tiene texto original en castellano para preparar la prueba. No sustituimos ni etiquetamos el texto quechua como castellano.</p>}
          </div>}
          <KidZone snap={snap} ctl={ctl} onDone={(id) => router.push(`/informe?id=${encodeURIComponent(id)}`)} />
        </section>
        {(snap.phase === "running" || snap.phase === "saving") && snap.mission && (
          <>
            <button type="button" className="btn subtle adult-toggle" onClick={() => setAdultOpen((v) => !v)} aria-expanded={adultOpen} style={{ justifySelf: "start" }}>
              {adultOpen ? "Ocultar vista del adulto" : "Ver como adulto"}
            </button>
            <AdultPanel snap={snap} ctl={ctl} open={adultOpen} />
          </>
        )}
      </div>

      {ctx?.state === "PAUSED" && (
        <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="pause-title">
          <div className="card">
            <h2 id="pause-title">Pausa</h2>
            <p>Tómate un momento. Cuando quieras, seguimos donde nos quedamos.</p>
            <div className="big-actions">
              <button type="button" className="btn kid" autoFocus onClick={() => ctl.resume()}>
                Seguir
              </button>
              <button
                type="button"
                className="btn kid ghost"
                onClick={() => {
                  ctl.finishLater();
                  router.push("/chat");
                }}
              >
                Terminar después
              </button>
            </div>
            <p className="small muted">Si terminas después, puedes retomar la misión dentro de 24 horas.</p>
          </div>
        </div>
      )}

      {snap.paceOffer && ctx?.state !== "PAUSED" && (
        <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="pace-title">
          <div className="card">
            <h2 id="pace-title">{PAUSE_OFFER}</h2>
            <div className="big-actions">
              <button type="button" className="btn kid" onClick={() => ctl.pause()}>
                Sí, una pausa
              </button>
              <button type="button" className="btn kid ghost" onClick={() => ctl.dismissPaceOffer()}>
                Seguimos
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Orb({ snap }: { snap: Snapshot }) {
  const alias = snap.profile?.alias ?? "";
  const paused = snap.ctx?.state === "PAUSED";
  const mode = snap.micError ? "error" : paused ? "paused" : snap.agentSpeaking ? "speaking" : snap.listening && !snap.simulation ? "listening" : "";
  const title = snap.agentSpeaking
    ? "Ñawinchay está hablando…"
    : snap.listening
      ? snap.simulation
        ? `Turno de ${alias}`
        : `Te escucho, ${alias}`
      : paused
        ? "En pausa"
        : "Tu turno de elegir";
  const sub = snap.agentSpeaking
    ? snap.mission?.lang === "es" && !snap.simulation
      ? "Puedes interrumpir cuando quieras."
      : "Escucha la pregunta."
    : snap.ctx?.state === "READ"
      ? "Lee en voz alta. Si te equivocas, sigue no más."
      : snap.listening
        ? snap.simulation
          ? "El adulto escribe lo que dice."
          : "Cuando termines, toca «Listo» o quédate en silencio."
        : "Toca una opción.";
  return (
    <div className="orb-pill" role="status" aria-live="polite">
      <div className={`orb ${mode}`} aria-hidden="true">
        {mode === "speaking" && <span className="ring" />}
        <Icon name="mic" />
      </div>
      <div className="stack-sm" style={{ gap: 0 }}>
        <strong style={{ fontSize: "1.1rem" }}>{title}</strong>
        <span className="small muted">{sub}</span>
      </div>
    </div>
  );
}

function AgentLine({ show, showEs }: { show: string; showEs?: string }) {
  return (
    <div className="agent-bubble">
      <span className="eyebrow" style={{ color: "var(--accent)" }}>
        Ñawinchay
      </span>
      <span>{show}</span>
      {showEs && <span className="es">{showEs}</span>}
    </div>
  );
}

function KidZone({ snap, ctl, onDone }: { snap: Snapshot; ctl: SessionController; onDone: (id: string) => void }) {
  const alias = snap.profile?.alias ?? "tu hijo";
  if (snap.phase === "loading") return <div className="skeleton" style={{ height: 300 }} />;
  if (snap.phase === "no-mission")
    return (
      <div className="card stack">
        <h1>No hay una misión elegida</h1>
        <p>Primero arma una misión en el chat (puedes usar una de ejemplo).</p>
        <Link className="btn" href="/chat">
          Ir al chat
        </Link>
      </div>
    );
  if (snap.phase === "intro") return <Intro snap={snap} ctl={ctl} />;
  if (snap.phase === "saving")
    return (
      <div className="stack" role="status">
        <h1>Preparando el informe…</h1>
        <div className="skeleton" />
        <div className="skeleton" />
      </div>
    );
  if (snap.phase === "error")
    return (
      <div className="card no stack" role="alert">
        <h1>No se pudo guardar el informe</h1>
        <p className="small">{snap.error}</p>
        <Link className="btn" href="/chat">
          Volver al chat
        </Link>
      </div>
    );
  if (snap.phase === "finished")
    return (
      <div className="card stack" style={{ textAlign: "center", justifyItems: "center", gap: 20 }}>
        <span className="eyebrow">Cierre</span>
        <h1>¡Misión cumplida, {alias}!</h1>
        <p style={{ fontSize: "1.2rem" }}>{snap.utterance?.show.replace(/\s*¿Cómo te fuiste\?$/, "")}</p>
        <button type="button" className="btn kid" onClick={() => snap.reportId && onDone(snap.reportId)} autoFocus>
          Listo
        </button>
        <p className="small muted">«Listo» lleva al adulto al informe.</p>
      </div>
    );


  const ctx = snap.ctx;
  if (!ctx || !snap.mission) return null;
  const st = ctx.state === "PAUSED" ? ctx.resumeState : ctx.state;
  const mission = snap.mission;
  // The child zone reads an allowlisted projection: adult-only data never reaches it.
  const child = toChildView(snap);
  const lastAgent = [...child.lines].reverse().find((l) => l.who === "agente");
  const kidLines = child.lines.slice(-4);

  return (
    <>
      <Orb snap={snap} />
      {snap.asrConnecting && <p className="notice info" role="status">Preparando el reconocedor… El tiempo de lectura y de respuesta empieza cuando esté listo.</p>}
      {snap.asrFinalizing && <p className="notice info" role="status">Terminando la transcripción… En el modelo local puede tardar. Este procesamiento no cuenta como tiempo de lectura ni como silencio.</p>}
      {snap.micError && (
        <div className="notice error row" role="alert" style={{ justifyContent: "space-between" }}>
          <span>{snap.micError}</span>
          {!snap.simulationForced && (
            <button type="button" className="btn subtle" onClick={() => void ctl.retryMic()} disabled={snap.micBusy || ctx.state === "PAUSED"}>
              {snap.micBusy ? "Conectando…" : "Reintentar voz"}
            </button>
          )}
        </div>
      )}
      {snap.live.noise === "alto" && !snap.simulation && <p className="notice">Hay mucho ruido, ¿nos movemos a un lugar más tranquilo?</p>}

      {st === "CHECK_IN" && (
        <div className="stack">
          {lastAgent && <AgentLine show={lastAgent.show} showEs={lastAgent.showEs} />}
          <h2>¿Cómo llegas hoy?</h2>
          <MoodPicker value={null} onPick={(m) => ctl.chooseMood(m)} legend="¿Cómo llegas hoy?" />
        </div>
      )}

      {st === "READ" && (
        <div className="stack">
          <div className="reading-card">
            <div className="spread">
              <h2>{mission.title}</h2>
              <span className="mono small" aria-live="off">
                {snap.simulation ? "Leyendo" : `Leyendo · ${fmt(snap.readElapsed)} de ${fmt(READ_LIMIT_S)}`}
              </span>
            </div>
            <ReadingText text={mission.text} progress={snap.readProgress} tracking={!snap.simulation} provisional={snap.readProvisional} />
            {mission.textEs && <p className="reading-es">{mission.textEs}</p>}
          </div>
          <p className="small muted">
            {snap.simulation
              ? "Modo manual: comparamos el texto al enviarlo. No hay seguimiento de voz."
              : `Seguimiento aproximado por transcripción${snap.readProvisional ? " provisional" : ""}. Puede corregirse mientras hablas; los tiempos del reconocedor no son una alineación exacta con el pasaje.`}
          </p>
          {!snap.simulation && <div className="caption" aria-live="polite">{snap.caption || "…"}</div>}
          {!snap.simulation && (
            <button type="button" className="btn kid" onClick={() => ctl.finishReading()} disabled={!snap.listening || snap.asrConnecting || snap.asrFinalizing}>
              Terminé
            </button>
          )}
        </div>
      )}

      {(st === "Q_OBTIENE" || st === "Q_INFIERE" || st === "STANCE" || st === "COUNTER" || st === "REVISE") && (
        <div className="stack">
          {kidLines.map((l, i) =>
            l.who === "agente" ? (
              <AgentLine key={i} show={l.show} showEs={l.showEs} />
            ) : (
              <div key={i} className="kid-bubble">
                {l.show}
              </div>
            ),
          )}
          {snap.listening && !snap.simulation && <div className="caption" aria-live="polite">{snap.caption || "…"}</div>}
          {st === "STANCE" && ctx.awaitingConfidence && <ConfidencePicker onPick={(c) => ctl.setConfidence(c)} />}
          {st === "COUNTER" && (
            <>
              <div className="counter-card">
                <span className="eyebrow">Contraprueba</span>
                <span className="fact">{mission.counter.text}</span>
              </div>
              <div className="pair">
                <button type="button" className="btn kid" onClick={() => ctl.decide("mantengo")}>
                  Mantengo mi idea
                </button>
                <button type="button" className="btn kid ghost" onClick={() => ctl.decide("cambio")}>
                  Cambio mi idea
                </button>
              </div>
            </>
          )}
          {snap.listening && !snap.simulation && (
            <button type="button" className="btn kid" onClick={() => ctl.doneSpeaking()}>
              Listo
            </button>
          )}
        </div>
      )}

      {st === "CHECK_OUT" && (
        <div className="stack">
          {lastAgent && <AgentLine show={lastAgent.show} showEs={lastAgent.showEs} />}
          <h2>¿Cómo te fuiste?</h2>
          <MoodPicker value={null} onPick={(m) => ctl.chooseMood(m)} legend="¿Cómo te fuiste?" />
        </div>
      )}

      {snap.listening && snap.simulation && st && <SimulationPanel key={`${st}-${snap.lines.length}`} snap={snap} ctl={ctl} reading={st === "READ"} />}

      <ModeBar snap={snap} ctl={ctl} />
    </>
  );
}

function ConfidencePicker({ onPick }: { onPick: (c: Confidence) => void }) {
  return (
    <fieldset className="stack-sm" style={{ border: 0, padding: 0, margin: 0 }}>
      <legend>
        <h2>¿Qué tan seguro o segura estás?</h2>
      </legend>
      <div className="triple">
        {(Object.keys(CONFIDENCE_LABELS) as Confidence[]).map((c) => (
          <button key={c} type="button" className="btn kid subtle" onClick={() => onPick(c)}>
            {CONFIDENCE_LABELS[c]}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function SimulationPanel({ snap, ctl, reading }: { snap: Snapshot; ctl: SessionController; reading: boolean }) {
  const alias = snap.profile?.alias ?? "el niño";
  const [text, setText] = useState(() => snap.caption);
  const [pause, setPause] = useState("");
  const [secs, setSecs] = useState("");
  const submit = () => {
    const p = pause.trim() === "" ? null : Number(pause);
    const s = secs.trim() === "" ? null : Number(secs);
    ctl.submitSimulated(text, Number.isFinite(p) ? p : null, Number.isFinite(s) ? s : null);
    setText("");
    setPause("");
    setSecs("");
  };
  return (
    <form
      className="sim"
      aria-label="Transcripción manual"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="spread">
        <strong>Transcripción manual</strong>
        <span className="tag blue">Sin medición de audio</span>
      </div>
      <p className="small muted">Escribe lo que realmente escuchaste, sin corregir ni traducir. Un fallo técnico no se toma como una respuesta incorrecta.</p>
      <div className="field">
        <label htmlFor="sim-text">{reading ? `Lo que leyó ${alias}` : `Lo que dijo ${alias}`}</label>
        <textarea
          id="sim-text"
          className="input"
          value={text}
          autoFocus
          onChange={(e) => {
            setText(e.target.value);
            if (reading) ctl.previewSimulatedReading(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={reading ? "Escribe lo que leyó en voz alta…" : "Escribe su respuesta tal como la dijo…"}
        />
      </div>
      <div className="row" style={{ alignItems: "end" }}>
        {reading ? (
          <div className="field">
            <label htmlFor="sim-secs">Segundos leyendo</label>
            <input id="sim-secs" className="input" type="number" min={1} max={60} inputMode="numeric" placeholder="60" value={secs} onChange={(e) => setSecs(e.target.value)} />
          </div>
        ) : (
          <div className="field">
            <label htmlFor="sim-pause">Silencio antes de responder (s)</label>
            <input id="sim-pause" className="input" type="number" min={0} step={0.5} inputMode="decimal" placeholder="opcional" value={pause} onChange={(e) => setPause(e.target.value)} />
          </div>
        )}
        {reading && snap.mission && (
          <button
            type="button"
            className="btn subtle"
            onClick={() => {
              setText(snap.mission!.text);
              ctl.previewSimulatedReading(snap.mission!.text);
            }}
          >
            Copiar el texto completo
          </button>
        )}
      </div>
      <div className="big-actions">
        <button type="submit" className="btn kid" disabled={!text.trim()}>
          Enviar turno
        </button>
        {!reading && (
          <button
            type="button"
            className="btn kid ghost"
            onClick={() => {
              setText("");
              ctl.simulateSilence();
            }}
          >
            Simular silencio
          </button>
        )}
      </div>
    </form>
  );
}

function ModeBar({ snap, ctl }: { snap: Snapshot; ctl: SessionController }) {
  return (
    <div className="card tight stack-sm">
      <div className="spread">
        <span className="small">
          <strong>Modo:</strong> {snap.simulation ? "transcripción manual (el adulto escribe)" : "voz"}
        </span>
        {!snap.simulationForced && (
          <button type="button" className="btn subtle" onClick={() => void ctl.toggleSimulation()} aria-pressed={snap.simulation} disabled={snap.micBusy || snap.ctx?.state === "PAUSED"}>
            {snap.micBusy ? "Conectando…" : snap.simulation ? "Usar el micrófono" : "Escribir la respuesta"}
          </button>
        )}
      </div>
      {snap.simulationForced && <p className="small muted">{snap.simulationForced}</p>}
      {!snap.simulation && snap.usingWebSpeech && (
        <p className="small muted">
          La transcripción puede enviar audio al proveedor del navegador y necesitar internet. El análisis de pausas y prosodia se hace en este dispositivo; la app no guarda grabaciones.
        </p>
      )}
      {!snap.simulation && snap.voiceProvider === "deepgram" && <p className="small muted">Deepgram Nova-3 recibe la voz para transcribir. Conexión limitada por turno; la app no guarda grabaciones ni cambia de proveedor sin que lo elijas.</p>}
      {!snap.simulation && snap.voiceProvider === "local-whisper" && <p className="small muted">Whisper base se ejecuta en este dispositivo. La inferencia puede tardar, especialmente en celulares; la app no envía esta voz al proveedor de ASR.</p>}
    </div>
  );
}

function Intro({ snap, ctl }: { snap: Snapshot; ctl: SessionController }) {
  const alias = snap.profile?.alias ?? "";
  const m = snap.mission!;
  return (
    <div className="card stack" style={{ gap: 20 }}>
      <span className="eyebrow">Misión de hoy · {m.lang === "qu" ? "quechua" : "castellano"}</span>
      <h1>Hola, {alias}. Hoy leemos «{m.title}»</h1>
      <p>Vas a leer en voz alta, responder tres preguntas y pensar en un dato nuevo. No es un examen: nos interesa cómo piensas.</p>
      <VoiceProviderSetup snap={snap} ctl={ctl} />
      {snap.voiceSupport && (
        <div className="card tight stack-sm" aria-label="Diagnóstico de voz">
          <strong>Antes de empezar: micrófono y transcripción son distintos</strong>
          <p className="small">Micrófono: {snap.voiceSupport.canRecord ? "API disponible; falta comprobar permiso y sonido" : "no disponible en esta página"}.</p>
          <p className="small">Web Speech del navegador: {snap.voiceSupport.canTranscribe ? "API disponible; el servicio aún debe responder" : "no disponible; puedes elegir el modelo local, una nube con código de acceso o escribir"}.</p>
          <p className="small muted">{snap.voiceSupport.message}</p>
          <p className="small muted">La voz necesita HTTPS o localhost. Abrir una IP local con HTTP desde el celular no lo soluciona.</p>
          {snap.voiceSupport.canRecord && snap.permissions.voice && (
            <button type="button" className="btn subtle" onClick={() => snap.micTesting ? ctl.cancelMicrophoneTest() : void ctl.testMicrophone()}>
              {snap.micTesting ? "Cancelar prueba" : "Probar micrófono (sin grabar)"}
            </button>
          )}
          {snap.micTestMessage && <p className="small" role="status">{snap.micTestMessage}</p>}
        </div>
      )}
      {snap.simulationForced ? (
        <p className="notice info">{snap.simulationForced}</p>
      ) : (
        <p className="small muted">
          Al empezar, el navegador pedirá permiso para usar el micrófono. La app no guarda grabaciones. La transcripción puede enviar audio a un proveedor externo del navegador;
          las señales acústicas de lectura se calculan en el dispositivo. El modelo local evita enviar la voz al ASR; la nube requiere el código de acceso del despliegue. Si prefieres, escribe la transcripción.
        </p>
      )}
      <div className="big-actions">
        {snap.resumable && (
          <button type="button" className="btn kid" onClick={() => void ctl.begin(true)} disabled={snap.micTesting || snap.localPreparing}>
            Retomar donde quedaste
          </button>
        )}
        <button type="button" className={`btn kid${snap.resumable ? " ghost" : ""}`} onClick={() => void ctl.begin(false)} disabled={snap.micTesting || snap.localPreparing} autoFocus>
          {snap.resumable ? "Empezar de nuevo" : "Empezar"}
        </button>
      </div>
      {!snap.simulationForced && (
        <label className="row small" style={{ gap: 8 }}>
          <input type="checkbox" checked={snap.simulation} onChange={() => void ctl.toggleSimulation()} style={{ width: 22, height: 22 }} />
          Usar transcripción manual (sin micrófono: el adulto escribe lo que dice el niño)
        </label>
      )}
    </div>
  );
}

function VoiceProviderSetup({ snap, ctl }: { snap: Snapshot; ctl: SessionController }) {
  return (
    <section className="stack-sm" aria-labelledby="asr-title">
      <h2 id="asr-title">Cómo transcribimos la voz</h2>
      <div className="field">
        <label htmlFor="asr-provider">Reconocedor</label>
        <select id="asr-provider" className="input" value={snap.voiceProvider} onChange={(event) => ctl.selectVoiceProvider(event.target.value as SessionAsrProvider)} disabled={snap.micTesting || snap.localPreparing}>
          <option value="browser">Web Speech · servicio del navegador</option>
          <option value="local-whisper">Whisper base · en este dispositivo</option>
          <option value="deepgram">Deepgram Nova-3 · nube con código de acceso</option>
        </select>
      </div>
      {snap.voiceProvider === "browser" && <p className="small muted">No elegimos el modelo interno del navegador. Puede enviar audio a su proveedor y no ofrece tiempos por palabra. Opera puede permitir el micrófono sin transcribir.</p>}
      {snap.voiceProvider === "local-whisper" && (
        <>
          <p className="small muted">Descarga explícita de aproximadamente 80 MB más el motor de ejecución; necesita internet al prepararlo y memoria suficiente. Solo castellano en este MVP. No está validado como evaluación autónoma de lectura infantil.</p>
          <button type="button" className="btn subtle" onClick={() => void ctl.prepareLocalVoice()} disabled={snap.localReady || snap.localPreparing || !snap.permissions.voice || snap.mission?.lang !== "es"}>
            {snap.localPreparing ? "Preparando modelo…" : snap.localReady ? "Modelo local listo" : "Descargar y preparar modelo local (~80 MB)"}
          </button>
          {snap.localProgress && <p className="small" role="status">{snap.localProgress}</p>}
        </>
      )}
      {snap.voiceProvider === "deepgram" && <CloudAuthorization key={snap.cloudStatus?.mode ?? "pending"} snap={snap} ctl={ctl} />}
      <p className="small muted">Ningún reconocedor infiere emociones, identidad, salud ni calidad del acento. Sus transcripciones y tiempos requieren revisión humana; la confianza del ASR no es una nota.</p>
    </section>
  );
}

function CloudAuthorization({ snap, ctl }: { snap: Snapshot; ctl: SessionController }) {
  const [code, setCode] = useState("");
  const policy = snap.cloudStatus;
  const revoke = () => ctl.authorizeCloud(null);
  if (snap.cloudStatusLoading) return <p className="small" role="status">Comprobando disponibilidad de Deepgram…</p>;
  if (!policy?.enabled) return (
    <div className="stack-sm">
      <p className="notice">Deepgram no está habilitado o no se pudo comprobar en este despliegue. No se enviará audio. El responsable debe configurar el proveedor, acceso y modalidad de privacidad.</p>
      <button type="button" className="btn subtle" onClick={() => void ctl.refreshAsrStatus()}>Comprobar otra vez</button>
    </div>
  );
  return (
    <div className="stack-sm">
      <p className="small muted">La voz se envía a Deepgram (Nova-3) para transcribir en castellano y obtener tiempos estimados. La app no almacena audio; el tratamiento del proveedor depende del acuerdo y la configuración del despliegue.</p>
      {!snap.cloudReady && <div className="field">
        <label htmlFor="cloud-code">Código de acceso del responsable</label>
        <input id="cloud-code" type="password" className="input" value={code} maxLength={256} autoComplete="off" aria-describedby="cloud-code-help" onChange={(event) => { setCode(event.target.value); revoke(); }} />
        <span id="cloud-code-help" className="small muted">Se usa solo en memoria durante esta sesión. No se guarda en el perfil ni en los informes.</span>
      </div>}
      {snap.cloudReady ? <p className="small" role="status">Código listo para esta sesión. El servidor comprobará el acceso al conectar.</p> : <button type="button" className="btn subtle" disabled={!code.trim() || !snap.permissions.voice || snap.mission?.lang !== "es"} onClick={() => {
        if (!policy || policy.mode === "disabled") return;
        ctl.authorizeCloud({ accessCode: code, audience: policy.mode });
        setCode("");
      }}>Usar Deepgram en esta sesión</button>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Adult view (desktop panel / mobile toggle)
// ---------------------------------------------------------------------------

function AdultPanel({ snap, ctl, open }: { snap: Snapshot; ctl: SessionController; open: boolean }) {
  const ctx = snap.ctx;
  const mission = snap.mission;
  if (!mission) return null;
  const st = ctx ? (ctx.state === "PAUSED" ? ctx.resumeState : ctx.state) : null;
  const alias = snap.profile?.alias ?? "";
  const live = snap.live;
  const proc = snap.permissions.process;
  const answers = ctx?.answers ?? {};
  const inJudgment = st === "STANCE" || st === "COUNTER" || st === "REVISE" || st === "CHECK_OUT" || st === "REPORT";
  const chain = buildJudgmentChain({ stance: answers.stance ?? "", reason: answers.revise ?? "", decision: ctx?.decision ?? null, mission });
  const reflex = answers.revise ? scoreReflexiona(answers.revise, mission) : null;

  return (
    <aside className={`adult${open ? " open" : ""}`} aria-label="Vista del adulto">
      <span className="tag blue">Vista del adulto</span>
      <div className="stack-sm">
        <SignalRow name="Fuente ASR" value={<span style={{ overflowWrap: "anywhere" }}>{snap.simulation ? "manual" : snap.asrMetadata ? `${snap.asrMetadata.provider} · ${snap.asrMetadata.model}` : snap.voiceProvider === "browser" ? "Web Speech · modelo del navegador" : snap.voiceProvider === "deepgram" ? "Deepgram · esperando resultados" : "Whisper base · esperando resultados"}</span>} />
        <SignalRow name="Tiempos ASR" value={snap.asrMetadata?.timedWords ? `${snap.asrMetadata.timedWords} palabras · ${snap.asrMetadata.firstStart?.toFixed(1)}–${snap.asrMetadata.lastEnd?.toFixed(1)} s` : "no disponibles"} />
        <p className="small muted">Tiempos relativos del reconocedor, no alineación forzada con el pasaje ni evidencia de exactitud. Un ASR puede omitir muletillas: no encontrarlas no demuestra que no ocurrieran.</p>
      </div>
      {st === "READ" || st === "CHECK_IN" ? (
        <>
          <h3>Lectura en curso</h3>
          <SignalRow name="Palabras correctas por minuto" value={live.pcpm ?? "—"} />
          <SignalRow name="Precisión" value={live.accuracy === null ? "—" : `${Math.round(live.accuracy * 100)} %`} />
          {proc && <SignalRow name="Autocorrecciones" value={live.selfCorrections} />}
          {proc && <SignalRow name="Pausas largas (> 2 s)" value={snap.simulation ? "no disponible en simulación" : live.longPauses ?? "—"} />}
          {proc && <SignalRow name="Lee en frases" value={live.prosody === null ? "—" : `${live.prosody} de 4`} />}
          <div className="card tight" style={{ padding: 12 }}>
            <ReadingText text={mission.text} progress={snap.readProgress} tracking={!snap.simulation} provisional={snap.readProvisional} adult different={live.differentIdx} size={16} />
          </div>
          <p className="small muted">Estimaciones basadas en la transcripción, pendientes de tu revisión. El rojo señala una posible diferencia en texto confirmado por el reconocedor, no un error confirmado del niño.</p>
        </>
      ) : inJudgment ? (
        <>
          <h3>Juicio en construcción</h3>
          <SignalRow name="Postura" value={chain.stance.present ? "sí" : "—"} />
          <SignalRow name="Seguridad" value={ctx?.confidence ? CONFIDENCE_LABELS[ctx.confidence] : "—"} />
          <SignalRow name="Ante el dato nuevo" value={ctx?.decision === "cambio" ? "cambia" : ctx?.decision === "mantengo" ? "mantiene" : "—"} />
          <SignalRow name="Razón usa el dato" value={answers.revise ? (chain.evidence.present ? "sí" : "no") : "—"} />
          <SignalRow name="Otra opción" value={answers.revise ? (chain.alternative.present ? "sí" : "no") : "—"} />
          {reflex && (
            <div className="card soft tight stack-sm">
              <div className="row">
                <strong>Nivel propuesto</strong>
                <LevelCell level={reflex.level} small />
              </div>
              {reflex.quote && <q className="small">{reflex.quote}</q>}
            </div>
          )}
          <p className="small muted">Mantener la idea con una buena razón vale igual que cambiarla con una buena razón.</p>
        </>
      ) : (
        <>
          <h3>Respuestas</h3>
          <div className="row">
            <span className="small" style={{ minWidth: 110 }}>Qué dice</span>
            <LevelCell level={answers.obtiene !== undefined ? scoreObtiene(answers.obtiene, mission.questions[0]).level : null} small />
            <span className="small muted">{ctx?.helps.obtiene ? "con ayuda" : ""}</span>
          </div>
          <div className="row">
            <span className="small" style={{ minWidth: 110 }}>Por qué pasó</span>
            <LevelCell level={answers.infiere !== undefined ? scoreInfiere(answers.infiere, mission.questions[1], mission).level : null} small />
            <span className="small muted">{ctx?.helps.infiere ? "con ayuda" : ""}</span>
          </div>
          {ctx && ctx.answerRequests > 0 && <p className="small">Pidió la respuesta {ctx.answerRequests} vez/veces: el agente repreguntó sin darla.</p>}
        </>
      )}
      <div className="card tight stack-sm" style={{ background: "var(--bg)" }}>
        <strong className="small">Cómo llegó (lo eligió {alias})</strong>
        {ctx?.moodStart ? (
          <div className="row">
            <Face mood={ctx.moodStart} size={32} />
            <span className="small">{moodLabel(ctx.moodStart)}</span>
          </div>
        ) : (
          <span className="small muted">{snap.permissions.mood ? "Sin dato" : "Desactivado por la familia"}</span>
        )}
      </div>
      {snap.experimentalEmotion && <ExperimentalAffectCards state={snap} actions={ctl} moodStart={ctx?.moodStart ?? null} />}
      <SignalRow name="Ruido" value={snap.simulation ? "no disponible" : live.noise === "alto" ? "alto" : live.noise === "ok" ? "bien" : "—"} />
      <SignalRow name="Juez" value={snap.judgeMode === "ia" ? "IA (3 corridas)" : "reglas"} />
      <p className="small muted">Las señales de proceso describen cómo lo dijo; no son una nota.</p>
    </aside>
  );
}
