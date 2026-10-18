"use client";
// Report block for the opt-in experimental emotion estimate from the VOICE
// (adult-only, never graded).
import { SOURCE_LABEL, type ExperimentalAffectReport } from "@/lib/signals/affect";
import type { TurnState } from "@/lib/types";

const STATE_LABEL: Record<TurnState, string> = {
  READ: "Lectura",
  Q_OBTIENE: "Qué dice",
  Q_INFIERE: "Por qué pasó",
  STANCE: "Qué opina",
  REVISE: "Después del dato nuevo",
};

const AGREEMENT_TAG = { coincide: "green", "no coincide": "maize", "sin comparación": "" } as const;

export function ExperimentalAffectBlock({ block }: { block: ExperimentalAffectReport }) {
  return (
    <section className="card stack-sm" aria-label="Estimación experimental de emociones" style={{ borderStyle: "dashed" }}>
      <div className="row" style={{ gap: 8 }}>
        <h2>Estimación experimental de emociones (demo)</h2>
        <span className="tag maize">Experimental</span>
      </div>
      {block.turns.length === 0 ? (
        <p className="small muted">Sin datos: la estimación necesita respuestas habladas con el micrófono.</p>
      ) : (
        <ol className="stack-sm" style={{ margin: 0, paddingLeft: 20 }}>
          {block.turns.map((t, i) => (
            <li key={`${t.state}-${i}`} className="small">
              <strong>{STATE_LABEL[t.state]}:</strong> {t.label}{t.source !== "sin-modelo" ? ` · confianza ${t.confidence}` : ""} · {SOURCE_LABEL[t.source]}
              {t.score !== null ? ` · ${Math.round(t.score * 100)} %` : ""}
            </li>
          ))}
        </ol>
      )}
      <p>
        <strong>Lo más frecuente:</strong> {block.overall}
      </p>
      <div className="row">
        <span className="small">Comparación con la carita al inicio:</span>
        <span className={`tag ${AGREEMENT_TAG[block.agreement.start]}`}>{block.agreement.start}</span>
        <span className="small">al final:</span>
        <span className={`tag ${AGREEMENT_TAG[block.agreement.end]}`}>{block.agreement.end}</span>
      </div>
      <p className="small muted">
        Estimación experimental hecha con el audio de la voz, no con las palabras. Con el código de acceso del despliegue se usa emotion2vec+ (Ma et al. 2024, Alibaba/FunASR, FunASR Model License v1.1). Sin modelo o audio suficiente no se estima una emoción ni se sustituye con heurísticas. Los resultados antiguos de activación acústica local no son emociones del modelo. No es un diagnóstico. No está validada con niños ni en quechua o castellano peruano. Nunca entra en la nota y solo la ve el adulto. Si no coincide, vale lo que tu hijo eligió. En el Perú, inferir emociones en educación se considera de alto riesgo (DS 115-2025-PCM, art. 24.1 i); se muestra solo para demostración. Puedes borrar las estimaciones guardadas en Privacidad.
      </p>
    </section>
  );
}
