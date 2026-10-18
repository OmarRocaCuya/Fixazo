"use client";
import { TranslatedText } from "@/components/i18n/LanguageProvider";


import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import { MetaReadingClient } from "@/lib/browser/meta-reading-client";
import { QuizMicrophone, type QuizAnswerAudio, type QuizAudioTranscript, type QuizMicrophoneState } from "@/lib/browser/quiz-microphone";
import type { CloudVoiceAccess, VoiceAudience } from "@/lib/voice/types";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { LANGUAGE_NAMES } from "@/lib/i18n/language";
import type { ReadingAsrLanguage } from "@/lib/browser/meta-reading-client";

const ASR_LANGUAGE = { es: "spa_Latn", quy: "quy_Latn", ayr: "ayr_Latn" } as const satisfies Record<string, ReadingAsrLanguage>;

export interface QuizAudioHandle { stop(): void }
export interface QuizAudioPanelProps {
  stepId: string | null;
  paused?: boolean;
  onTranscript(event: QuizAudioTranscript): void;
  onAccessChange?(access: CloudVoiceAccess | null): void;
  onAnswerAudio?(event: QuizAnswerAudio): void;
}
const INITIAL: QuizMicrophoneState = { status: "idle", remainingSeconds: 0, message: "Micrófono apagado. Puedes completar el quiz escribiendo o tocando las opciones." };
const minutes = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

/** Closed help must not mount translated text or spend translation work. */
export function QuizAudioHelp({ expanded }: { expanded: boolean }) {
  if (!expanded) return null;
  return <>
    <p><TranslatedText text="Actívalo una vez para responder por voz mientras esta pantalla está visible. Las opciones dictadas se preseleccionan: tú las confirmas. También puedes escribir o tocar las opciones." /></p>
    <p className="muted small"><TranslatedText text="El navegador pide el micrófono solo al pulsar Iniciar. El audio se envía al backend Meta del proyecto para transcribirlo, sin guardar la grabación. Con cada respuesta hablada se muestra una estimación experimental de emociones (emotion2vec+, desde el audio; si no hay modelo, no se estima). No se infieren identidad, acento ni salud." /></p>
    <p className="muted small"><TranslatedText text="Límite: 10 minutos por inicio. Se detiene al pausar, ocultar o salir de la pantalla, finalizar, perder el permiso o saturarse la transcripción. Para retomar, pulsa Iniciar; no se reactiva solo." /></p>
    <p className="muted small"><TranslatedText text="Al cambiar de pregunta se descarta el segmento en curso para no mezclar respuestas. Espera a que termine «Preparando la nueva pregunta» antes de dictar otra opción." /></p>
  </>;
}

/** Admission is inline, not a navigation gate. Mounting never asks for microphone permission. */
export const QuizAudioPanel = forwardRef<QuizAudioHandle, QuizAudioPanelProps>(function QuizAudioPanel({ stepId, paused = false, onTranscript, onAccessChange, onAnswerAudio }, ref) {
  const { language, t } = useLanguage();
  const asrLanguage = ASR_LANGUAGE[language];
  const [state, setState] = useState(INITIAL);
  const [helpExpanded, setHelpExpanded] = useState(false);
  const [capability, setCapability] = useState<{ ready: boolean; mode: VoiceAudience; message: string }>({ ready: false, mode: "adult-demo", message: "Comprobando transcripción de audio…" });
  const controller = useRef<QuizMicrophone | null>(null);
  const transcriptCallback = useRef(onTranscript);
  const accessCallback = useRef(onAccessChange);
  const answerAudioCallback = useRef(onAnswerAudio);
  useLayoutEffect(() => {
    transcriptCallback.current = onTranscript;
    accessCallback.current = onAccessChange;
    answerAudioCallback.current = onAnswerAudio;
  }, [onTranscript, onAccessChange, onAnswerAudio]);
  const active = state.status === "starting" || state.status === "listening";
  // Text judging remains available independently of ASR readiness.
  // The self-hosted Meta backend needs no access code; the server limits per IP.
  const authorized = true;

  useImperativeHandle(ref, () => ({ stop: () => controller.current?.pause("Micrófono detenido al finalizar la lectura.") }), []);

  useEffect(() => {
    const abort = new AbortController();
    void MetaReadingClient.capabilities(abort.signal).then((status) => {
      if (abort.signal.aborted) return;
      const ready = status.enabled && status.asr.ready && status.asr.languages.includes(asrLanguage) && status.mode !== "disabled";
      setCapability({ ready, mode: status.mode === "approved-pilot" ? "approved-pilot" : "adult-demo",
        message: ready ? "Meta ASR disponible. Envía segmentos de 8 segundos: las respuestas aparecen después de procesarlos, no instantáneamente." : "Transcripción no disponible. Puedes seguir con texto y opciones." });
    }).catch(() => { if (!abort.signal.aborted) setCapability({ ready: false, mode: "adult-demo", message: "No se pudo comprobar la voz. Puedes seguir con texto y opciones." }); });
    return () => abort.abort();
  }, [asrLanguage]);

  useEffect(() => {
    const stop = () => controller.current?.pause("Cambiaste de idioma. Micrófono detenido; pulsa Iniciar para transcribir en la nueva lengua.");
    window.addEventListener("fixazo:language-changing", stop);
    return () => window.removeEventListener("fixazo:language-changing", stop);
  }, []);

  useEffect(() => {
    const stopHidden = () => { if (document.visibilityState === "hidden") controller.current?.pause("Micrófono detenido al ocultar esta pantalla. Pulsa Iniciar para retomarlo."); };
    const stopPage = () => controller.current?.pause("Micrófono detenido al salir de esta pantalla.");
    document.addEventListener("visibilitychange", stopHidden); window.addEventListener("pagehide", stopPage);
    return () => {
      document.removeEventListener("visibilitychange", stopHidden); window.removeEventListener("pagehide", stopPage);
      controller.current?.dispose(); controller.current = null; accessCallback.current?.(null);
    };
  }, []);

  useEffect(() => { controller.current?.setStep(stepId); }, [stepId]);
  useEffect(() => {
    if (paused) controller.current?.pause("Micrófono pausado durante la evaluación o al terminar. Pulsa Iniciar para retomarlo.");
  }, [paused]);
  useEffect(() => {
    accessCallback.current?.(authorized ? { accessCode: "", audience: capability.mode } : null);
  }, [authorized, capability.mode]);

  function start() {
    if (!authorized || !capability.ready || paused) return;
    if (!controller.current) controller.current = new QuizMicrophone({ onState: setState, onTranscript: (event) => transcriptCallback.current(event), onAnswerAudio: (event) => answerAudioCallback.current?.(event) });
    void controller.current.start({ accessCode: "", audience: capability.mode }, stepId, asrLanguage);
  }

  return (
    <section className="pd-bloque pd-pregunta" aria-label={t("Audio durante el quiz")}>
      <h2><TranslatedText text="Micrófono durante el quiz" /></h2>
      <p className="muted small">{LANGUAGE_NAMES[language]} · {asrLanguage}</p>
      <p className="muted small"><TranslatedText text="Se envía audio para transcribir y estimar emoción. No se guarda la grabación." /></p>
      <p className="pd-aviso"><TranslatedText text={capability.message} /></p>
      <p role="status" aria-live="polite"><TranslatedText text={state.message} />{active ? ` ${minutes(state.remainingSeconds)}` : ""}</p>
      <div className="pd-acciones">
        <button type="button" className="btn primary" disabled={active || !authorized || !capability.ready || paused} onClick={start}><TranslatedText text="Iniciar micrófono del quiz" /></button>
        <button type="button" className="btn ghost" disabled={!active} onClick={() => controller.current?.pause()}><TranslatedText text="Pausar micrófono" /></button>
      </div>
      <details onToggle={(event) => setHelpExpanded(event.currentTarget.open)}><summary><TranslatedText text="Cómo funciona el micrófono" /></summary>
        <QuizAudioHelp expanded={helpExpanded} />
      </details>
    </section>
  );
});
