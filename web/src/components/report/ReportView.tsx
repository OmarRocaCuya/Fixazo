"use client";
import Link from "next/link";
import { useState } from "react";
import type { LevelResult, Report, ReviewerRole, ReviewTarget } from "@/lib/types";
import { provisionalReview, reviewReport } from "@/lib/report/build";
import { getStore } from "@/lib/storage";
import { notifyStore } from "@/lib/useStore";
import { CONFIDENCE_LABELS, Face, MetricCard, SignalRow, moodLabel } from "@/components/ui";

const LEVEL_PHRASE = (r: LevelResult) => {
  if (r.status === "no_observable") return "No se pudo observar (no es un 0).";
  return r.explanation;
};

function levelValue(r: LevelResult) {
  if (r.level === "NO") return "—";
  return `${r.level}/3`;
}


function LevelTag({ r }: { r: LevelResult }) {
  return (
    <span className="row" style={{ gap: 6 }}>
      {r.status === "dudoso" && <span className="tag maize">en revisión</span>}
      {r.withHelp && <span className="tag blue">con ayuda</span>}
      {r.source === "ia" && <span className="tag">juez IA</span>}
    </span>
  );
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" });
const fmtDur = (s: number) => `${Math.floor(s / 60)} min ${s % 60} s`;
const intonation = { sube: "sube (como pregunta)", baja: "baja (como afirmación)", plana: "plana" } as const;
const calibration = {
  ajustada: "Su seguridad coincide con lo que acertó.",
  sobreconfianza: "Dijo estar muy segura, pero todavía no acertó: vale repasar juntos.",
  subconfianza: "Acertó más de lo que creía: dile que confíe en lo que piensa.",
  sin_dato: "Sin dato.",
} as const;

export function ReportView({ report }: { report: Report }) {
  const [showQuotes, setShowQuotes] = useState(false);
  const [updatedReport, setUpdatedReport] = useState<Report | null>(null);
  const [reviewer, setReviewer] = useState<ReviewerRole>("familia");
  const [reviewMessage, setReviewMessage] = useState("");
  const r = updatedReport?.id === report.id ? updatedReport : report;
  const review = r.review ?? provisionalReview();
  function saveReview(action: Parameters<typeof reviewReport>[1]) {
    try {
      const updated = reviewReport(r, action);
      getStore().saveReport(updated);
      setUpdatedReport(updated);
      notifyStore();
      setReviewMessage("Revisión guardada en este navegador.");
    } catch {
      setReviewMessage("No se pudo guardar la revisión. Intenta nuevamente sin cerrar esta página.");
    }
  }
  const evidence: { target: ReviewTarget; title: string; quote: string; observable: boolean }[] = [
    { target: "lectura", title: "Lectura y prosodia", quote: r.fluency.quote ?? "No hay transcripción de lectura en este informe anterior.", observable: r.fluency.status === "ok" && !!r.fluency.quote?.trim() },
    { target: "obtiene", title: "Qué dice", quote: r.levels.obtiene.quote, observable: r.levels.obtiene.level !== "NO" },
    { target: "infiere", title: "Por qué pasó", quote: r.levels.infiere.quote, observable: r.levels.infiere.level !== "NO" },
    { target: "reflexiona", title: "Qué opina y cómo revisa", quote: [r.chain.stance.quote, r.chain.revision.quote].filter(Boolean).join(" / "), observable: r.levels.reflexiona.level !== "NO" },
  ];
  const c = r.chain;
  const links = [
    { title: "Postura", ...c.stance },
    { title: "Razón", ...c.reason },
    { title: "Dato nuevo", present: c.evidence.present, quote: c.evidence.quote ? `Usó: ${c.evidence.quote}` : "" },
    {
      title: "Revisión",
      present: c.revision.decision !== null,
      quote: c.revision.decision ? `${c.revision.changed ? "Cambió" : "Mantuvo"} su idea${c.revision.withReason ? " con una buena razón" : ""}` : "",
    },
    { title: "Otra opción", ...c.alternative },
  ];

  return (
    <article className="page">
      <div className="stack-sm">
        <span className="eyebrow">
          {fmtDate(r.createdAt)} · {fmtDur(r.durationSec)} · «{r.missionTitle}» · {r.lang === "qu" ? "quechua" : "castellano"}
          {r.simulated ? " · modo simulación" : ""}
        </span>
        <h1>{r.headline}</h1>
        <p className="small"><strong>{review.status === "revisado" ? "Evidencia revisada por una persona" : "Informe provisional: pendiente de revisión humana"}.</strong> {review.status !== "revisado" && "Los resultados automáticos todavía no son una evaluación confirmada."}</p>
      </div>

      <section className="card stack" aria-labelledby="review-title">
        <h2 id="review-title">Revisar la evidencia</h2>
        <p>Compara estas transcripciones con lo que escuchaste y con la lectura. Si el reconocimiento, el ruido o una interrupción impiden comprobarlo, marca «No observable»: nunca se convierte en 0.</p>
        <label className="row" style={{ gap: 12 }}>
          Reviso como
          <select value={reviewer} onChange={(e) => setReviewer(e.target.value as ReviewerRole)}>
            <option value="familia">Familia</option><option value="docente">Docente</option>
          </select>
        </label>
        {evidence.map((e) => {
          const decision = review.evidence[e.target];
          return <div key={e.target} className="stack-sm" style={{ borderTop: "1px solid var(--line)", paddingTop: 16 }}>
            <h3>{e.title}</h3>
            <q style={{ overflowWrap: "anywhere" }}>{e.quote || "Sin transcripción disponible."}</q>
            <p className="small muted">{decision.decision === "pendiente" ? "Pendiente de revisión" : `${decision.decision === "confirmado" ? "Evidencia confirmada" : "No observable, no es un 0"} · ${decision.reviewedBy === "docente" ? "docente" : "familia"}${decision.reviewedAt ? ` · ${fmtDate(decision.reviewedAt)}` : ""}`}</p>
            <div className="row" style={{ flexWrap: "wrap" }}>
              <button className="btn ghost" type="button" disabled={!e.observable || decision.decision === "confirmado"} onClick={() => saveReview({ target: e.target, decision: "confirmado", role: reviewer })}>Confirmar {e.title.toLowerCase()}</button>
              <button className="btn ghost" type="button" disabled={decision.decision === "no_observable"} onClick={() => saveReview({ target: e.target, decision: "no_observable", role: reviewer })}>Marcar {e.title.toLowerCase()} no observable</button>
            </div>
          </div>;
        })}
        <p className="small" role="status">{reviewMessage}</p>
      </section>

      <section className="card stack-sm" aria-labelledby="transcription-title">
        <h2 id="transcription-title">De dónde viene la transcripción</h2>
        {r.transcription?.length ? r.transcription.map((source, index) => <div key={`${source.provider}-${index}`} className="stack-sm">
          <SignalRow name="Fuente y modelo" value={<span style={{ overflowWrap: "anywhere" }}>{source.provider} · {source.model}</span>} />
          <SignalRow name="Idioma configurado" value={source.language === "qu" ? "quechua" : "castellano"} />
          <SignalRow name="Tiempos por palabra" value={source.timingsAvailable ? "el reconocedor suministró estimaciones; no se guardan los tiempos" : "no disponibles en esta evidencia"} />
        </div>) : <p className="small muted">Informe anterior sin procedencia del reconocedor. No se puede deducir el modelo usado.</p>}
        <p className="small muted">El reconocimiento puede normalizar el habla, omitir muletillas o cambiar palabras; la transcripción manual también puede omitirlas. Los tiempos ASR no son alineación exacta con el pasaje. La confianza del modelo no es una nota del niño.</p>
      </section>

      <div className="metric-grid">
        <MetricCard
          title="Fluidez"
          value={r.fluency.pcpm ?? "—"}
          caption={
            r.fluency.status === "ok"
              ? `palabras correctas por minuto · precisión ${Math.round((r.fluency.accuracy ?? 0) * 100)} %${r.lang === "qu" ? " · meta en quechua: por definir" : ""}`
              : "No se pudo observar la lectura (no es un 0)."
          }
        />
        <MetricCard title="Qué dice" value={levelValue(r.levels.obtiene)} tag={<LevelTag r={r.levels.obtiene} />} caption={LEVEL_PHRASE(r.levels.obtiene)} />
        <MetricCard title="Por qué pasó" value={levelValue(r.levels.infiere)} tag={<LevelTag r={r.levels.infiere} />} caption={LEVEL_PHRASE(r.levels.infiere)} />
        <MetricCard title="Qué opina" value={levelValue(r.levels.reflexiona)} tag={<LevelTag r={r.levels.reflexiona} />} caption={LEVEL_PHRASE(r.levels.reflexiona)} />
      </div>

      <section className="card stack">
        <h2>Cómo construyó su juicio</h2>
        <div className="chain">
          {links.map((l) => (
            <div key={l.title} className={`link${l.present ? "" : " absent"}`}>
              <strong>{l.title}</strong>
              {l.present ? <q>{l.quote}</q> : <span className="small">No apareció</span>}
            </div>
          ))}
        </div>
      </section>

      <div className="two-col">
        <section className="card stack-sm">
          <h2>Cómo lo dijo</h2>
          {r.process.enabled ? (
            <>
              <SignalRow name="Tiempo para responder" value={r.process.latencyMs === null ? "—" : `${(r.process.latencyMs / 1000).toFixed(1)} s${r.simulated ? " (escrito)" : ""}`} />
              <SignalRow name="Pausas largas (> 2 s)" value={r.process.audioAvailable ? (r.process.longPauses ?? "—") : "no disponible en simulación"} />
              <SignalRow name="Posibles autocorrecciones en el texto" value={r.process.selfCorrections || "no encontradas en la transcripción"} />
              <SignalRow name="Palabras de duda en el texto" value={r.process.fillers ? `${r.process.fillers}${r.process.hedges.length ? ` (${r.process.hedges.join(", ")})` : ""}` : "no encontradas en la transcripción"} />
              <SignalRow
                name="Seguridad y acierto"
                value={r.process.confidence ? CONFIDENCE_LABELS[r.process.confidence] : "—"}
              />
              <p className="small">{calibration[r.process.calibration]}</p>
              {r.process.finalIntonation && <SignalRow name="Entonación al final de su opinión" value={intonation[r.process.finalIntonation]} />}
              <p className="small muted">Describe señales del texto disponible, no cuánto sabe ni cómo se siente. No encontrar una muletilla o autocorrección no demuestra que no ocurrió: el ASR puede normalizarla.</p>
            </>
          ) : (
            <p className="small muted">Desactivado por la familia en Privacidad.</p>
          )}
        </section>
        <section className="card stack-sm">
          <h2>Cómo se sintió</h2>
          {r.mood.enabled ? (
            <>
              <div className="row" style={{ gap: 24 }}>
                <div className="stack-sm" style={{ justifyItems: "center" }}>
                  <span className="small muted">Al inicio</span>
                  {r.mood.start ? <Face mood={r.mood.start} size={48} /> : <span>—</span>}
                  <span className="small">{moodLabel(r.mood.start)}</span>
                </div>
                <div className="stack-sm" style={{ justifyItems: "center" }}>
                  <span className="small muted">Al final</span>
                  {r.mood.end ? <Face mood={r.mood.end} size={48} /> : <span>—</span>}
                  <span className="small">{moodLabel(r.mood.end)}</span>
                </div>
              </div>
              <p className="small muted">Lo eligió {r.alias}. No adivinamos emociones por la voz.</p>
            </>
          ) : (
            <p className="small muted">Desactivado por la familia en Privacidad.</p>
          )}
        </section>
      </div>

      <div className="two-col">
        <section className="card stack-sm">
          <h2>Contexto</h2>
          <SignalRow name="Ruido" value={r.context.noise === "no_disponible" ? "no disponible en simulación" : r.context.noise === "alto" ? "alto" : "bien"} />
          <SignalRow name="Audio saturado" value={r.context.saturated ? "sí: medición no observable" : r.context.noise === "no_disponible" ? "no disponible" : "no"} />
          <SignalRow name="Ayuda de un adulto" value={review.adultHelp ? (review.adultHelp.declared ? `declarada por ${review.adultHelp.reviewedBy}` : `sin ayuda, declarado por ${review.adultHelp.reviewedBy}`) : "sin declaración"} />
          <p className="small muted">No inferimos quién habla ni si alguien dicta por el tono de voz. Solo una persona puede declarar ayuda.</p>
          <div className="row" style={{ flexWrap: "wrap" }}>
            <button className="btn ghost" type="button" onClick={() => saveReview({ adultHelp: true, role: reviewer })}>Declarar ayuda adulta</button>
            <button className="btn ghost" type="button" onClick={() => saveReview({ adultHelp: false, role: reviewer })}>Declarar sin ayuda adulta</button>
          </div>
        </section>
        <section className="card stack-sm">
          <h2>Conversación</h2>
          <SignalRow name="Pidió repetir" value={r.conversation.repeatRequests} />
          <SignalRow name="Pidió la respuesta" value={r.conversation.answerRequests ? `${r.conversation.answerRequests} (no se la dimos)` : "0"} />
          <SignalRow name="Hizo sus propias preguntas" value={r.conversation.ownQuestions.length} />
          <SignalRow name="Cambió de idea con razón" value={r.conversation.changedWithReason ? "sí" : r.conversation.keptWithReason ? "mantuvo con razón" : "no"} />
          {r.conversation.ownQuestions.length > 0 && <q className="small">{r.conversation.ownQuestions[0]}</q>}
        </section>
      </div>

      <section className="card soft stack">
        <h2>Para conversar en casa</h2>
        <p style={{ fontSize: "1.2rem", fontWeight: 700 }}>{r.homeQuestion.es}</p>
        <div className="row">
          <Link className="btn" href="/chat">
            Programar la próxima misión
          </Link>
          <button type="button" className="btn ghost" onClick={() => setShowQuotes((v) => !v)} aria-expanded={showQuotes}>
            {showQuotes ? "Ocultar la transcripción" : "Ver la transcripción"}
          </button>
        </div>
        {showQuotes && (
          <div className="stack-sm">
            <p className="small"><strong>Qué dice:</strong> {r.levels.obtiene.quote || "—"}</p>
            <p className="small"><strong>Por qué pasó:</strong> {r.levels.infiere.quote || "—"}</p>
            <p className="small"><strong>Qué opina:</strong> {c.stance.quote || "—"}</p>
            <p className="small"><strong>Después del dato nuevo:</strong> {c.revision.quote || "—"}</p>
            {r.fluency.differentWords.length > 0 && (
              <p className="small"><strong>Palabras leídas distinto:</strong> {r.fluency.differentWords.join(", ")}</p>
            )}
          </div>
        )}
      </section>

      <section className="card no stack-sm">
        <h2 style={{ color: "var(--red)" }}>Lo que no medimos</h2>
        <ul className="stack-sm" style={{ margin: 0, paddingLeft: 20 }}>
          {r.notMeasured.map((n) => (
            <li key={n} className="small">
              {n}
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
