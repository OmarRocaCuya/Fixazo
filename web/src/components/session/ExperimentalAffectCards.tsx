"use client";
// ADULT VIEW ONLY. Experimental emotion estimate from the VOICE (no consent gate).
// Never rendered in the child zone and never spoken by the agent.
import type { Mood, TurnState } from "@/lib/types";
import { SOURCE_LABEL, type AffectEstimate } from "@/lib/signals/affect";
import { moodLabel } from "@/components/ui";
import type { VoicePolicyStatus } from "@/lib/voice/types";

const STATE_LABEL: Record<TurnState, string> = {
  READ: "Lectura",
  Q_OBTIENE: "Qué dice",
  Q_INFIERE: "Por qué pasó",
  STANCE: "Qué opina",
  REVISE: "Por qué (contraprueba)",
};

export interface AffectPanelState {
  affect: Array<{ state: TurnState; estimate: AffectEstimate }>;
  simulation: boolean;
  emotionBackendAuthorized: boolean;
  emotionBackendFallback: boolean;
  emotionBackendError: string | null;
  emotionStatus: VoicePolicyStatus | null;
  emotionStatusLoading: boolean;
  affectTest: AffectEstimate | null;
  affectTestBusy: boolean;
  affectTestError: string | null;
}

export interface AffectPanelActions {
  authorizeEmotionBackend(enabled: boolean): void;
  analyzeTestAudio(file: Blob): Promise<void>;
  refreshEmotionStatus(): Promise<void>;
}

function EstimateLine({ e }: { e: AffectEstimate }) {
  return (
    <div className="row" style={{ gap: 6 }}>
      <strong>{e.label}</strong>
      {e.source !== "sin-modelo" && <span className={`tag ${e.confidence === "media" ? "blue" : ""}`}>confianza {e.confidence}</span>}
      <span className="small muted">
        {SOURCE_LABEL[e.source]}
        {e.score !== null ? ` · ${Math.round(e.score * 100)} %` : ""}
        {e.note ? ` · ${e.note}` : ""}
      </span>
    </div>
  );
}

export function ExperimentalAffectCards({ state, actions, moodStart }: { state: AffectPanelState; actions: AffectPanelActions; moodStart: Mood | null }) {
  return (
    <section className="card tight stack-sm" aria-label="Estimación experimental de emociones" style={{ borderStyle: "dashed" }}>
      <div className="row" style={{ gap: 8 }}>
        <strong className="small">Estimación experimental (por la voz)</strong>
        <span className="tag maize">Experimental</span>
      </div>

      {state.simulation ? (
        <p className="small muted">No hay captura de voz durante la sesión. Puedes analizar un audio de prueba.</p>
      ) : state.affect.length === 0 ? (
        <p className="small muted">Aparecerá después de cada respuesta hablada.</p>
      ) : (
        state.affect.slice(-4).map(({ state: s, estimate }, i) => (
          <div key={`${s}-${i}`} className="stack-sm" style={{ gap: 2 }}>
            <span className="small muted">{STATE_LABEL[s]}</span>
            <EstimateLine e={estimate} />
          </div>
        ))
      )}
      {state.emotionBackendError && <p className="small muted" role="status">{state.emotionBackendError}</p>}
      {state.emotionStatusLoading ? <p className="small muted" role="status">Comprobando emotion2vec+…</p> : !state.emotionStatus?.enabled ? (
        <p className="small muted" role="status">emotion2vec+ no está habilitado o disponible en este despliegue. No se estiman emociones sin el modelo.</p>
      ) : state.emotionStatus.reason ? (
        <p className="small muted" role="status">{state.emotionStatus.reason === "emotion-model-loading" ? "El modelo está cargando; espera antes de analizar un audio." : `Estado del modelo: ${state.emotionStatus.reason}.`}</p>
      ) : null}
      <button type="button" className="btn subtle" disabled={state.emotionStatusLoading} onClick={() => void actions.refreshEmotionStatus()}>Comprobar servicio</button>

      {state.emotionBackendAuthorized ? (
        <div className="stack-sm">
          <p className="small muted">Envío de voz a emotion2vec+ activo para esta sesión. Esto no confirma que el modelo esté listo.</p>
          <button type="button" className="btn subtle" onClick={() => actions.authorizeEmotionBackend(false)}>Dejar de enviar voz</button>
        </div>
      ) : (
        <form
          className="stack-sm"
          onSubmit={(e) => {
            e.preventDefault();
            actions.authorizeEmotionBackend(true);
          }}
        >
          <span className="small">
            Solo emotion2vec+ analiza emociones desde el audio, nunca desde el texto. Sin modelo no se estima una emoción. Al activarlo, hasta 15 segundos de voz de cada respuesta se envían al servidor privado, sin guardarlos.
          </span>
          <button type="submit" className="btn subtle" disabled={!state.emotionStatus?.enabled || state.emotionStatusLoading}>
            Usar emotion2vec+
          </button>
        </form>
      )}

      <div className="stack-sm">
        <label className="small" htmlFor="emo-test">Analizar un audio de prueba (WAV o WebM)</label>
        <input
          id="emo-test"
          type="file"
          accept="audio/wav,audio/x-wav,audio/webm,audio/ogg,audio/mpeg,audio/*"
          disabled={state.affectTestBusy || !state.emotionBackendAuthorized}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void actions.analyzeTestAudio(file);
          }}
        />
        {state.affectTestBusy && <span className="small muted">Analizando…</span>}
        {state.affectTestError && <span className="small">{state.affectTestError}</span>}
        {state.affectTest && (
          <div className="stack-sm" style={{ gap: 2 }}>
            <span className="small muted">Audio de prueba</span>
            <EstimateLine e={state.affectTest} />
          </div>
        )}
      </div>

      <p className="small muted">
        Puede equivocarse. Compárala con la carita que eligió{moodStart ? ` (al llegar: ${moodLabel(moodStart)})` : ""}. Nunca entra en la nota.
      </p>
    </section>
  );
}
