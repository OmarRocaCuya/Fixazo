"use client";
// EXPERIMENTAL emotion estimate per quiz voice answer (emotion2vec+, audio only).
// Never graded; "sin modelo" is shown instead of a guess when the backend fails.
import { EstimateLine } from "@/components/session/ExperimentalAffectCards";
import type { AffectEstimate } from "@/lib/signals/affect";
import { resumenEmociones, type EmocionRespuesta, type MetricasVoz } from "@/lib/periodico/voz-quiz";

export type EstadoEmocion = AffectEstimate | "analizando";

export function EmocionRespuestaCard({ estado }: { estado: EstadoEmocion }) {
  return (
    <div className="card tight stack-sm pd-emocion" aria-label="Estimación experimental de emoción de esta respuesta" style={{ borderStyle: "dashed" }}>
      <div className="row" style={{ gap: 8 }}>
        <strong className="small">Cómo sonabas al responder</strong>
        <span className="tag maize">Experimental</span>
      </div>
      {estado === "analizando"
        ? <p className="small muted" role="status">Analizando tu voz con emotion2vec+…</p>
        : estado.source === "sin-modelo"
          ? <p className="small muted" role="status">Sin modelo: no se estimó una emoción{estado.note ? ` (${estado.note.replace(/^sin modelo: /, "")})` : ""}.</p>
          : <EstimateLine e={estado} />}
      <p className="small muted">Estimación desde el audio, no desde tus palabras. Puede equivocarse y nunca entra en la nota.</p>
    </div>
  );
}

const etiqueta = (l: string, n: number) => `${l}${n > 1 ? ` ×${n}` : ""}`;

/** Summary for the final report and Mis insights. Shows nothing invented: absent data stays absent. */
export function ResumenVozQuiz({ emociones, metricas, titulo = "Cómo sonabas al responder" }: { emociones?: EmocionRespuesta[]; metricas?: MetricasVoz | null; titulo?: string }) {
  const resumen = resumenEmociones(emociones);
  if (!resumen.estimadas && !resumen.sinModelo && !metricas) return null;
  return (
    <section className="pd-card stack-sm" aria-label={titulo} style={{ borderStyle: "dashed" }}>
      <div className="row" style={{ gap: 8 }}>
        <h3 style={{ margin: 0 }}>{titulo}</h3>
        <span className="tag maize">Experimental</span>
      </div>
      {resumen.estimadas > 0 ? (
        <p>emotion2vec+ estimó en {resumen.estimadas} respuesta{resumen.estimadas > 1 ? "s" : ""} por voz: <strong>{resumen.etiquetas.map(([l, n]) => etiqueta(l, n)).join(", ")}</strong>.</p>
      ) : resumen.sinModelo > 0 ? (
        <p className="muted">Sin modelo: emotion2vec+ no estuvo disponible, así que no se estimaron emociones.</p>
      ) : null}
      {metricas && (
        <ul className="pd-senales">
          <li><span>Respuestas por voz analizadas</span><span>{metricas.respuestas}</span></li>
          <li><span>Palabras reconocidas</span><span>{metricas.palabras}{metricas.respuestas ? ` (≈${Math.round(metricas.palabras / metricas.respuestas)} por respuesta)` : ""}</span></li>
          <li><span>Pausas largas (&gt; 2 s)</span><span>{metricas.pausasLargas}</span></li>
          <li><span>Segundos de audio analizados</span><span>{metricas.segundosHablando}</span></li>
        </ul>
      )}
      <p className="small muted">Estimación experimental desde la voz (no desde el texto), sin validar con estudiantes peruanos. No es un diagnóstico ni una nota.</p>
    </section>
  );
}
