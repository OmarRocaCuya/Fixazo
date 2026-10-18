"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import LanguageSelector from "./LanguageSelector";
import { TranslatedText } from "./LanguageProvider";
import { QuizAudioPanel, type QuizAudioHandle } from "@/components/periodico/QuizAudioPanel";
import { estimarEmocionRespuesta } from "@/lib/browser/quiz-emotion";
import { publishCompanionEmotion } from "@/lib/browser/voice-companion";

export default function LanguagesPage() {
  const [text, setText] = useState("");
  const pending = useRef<AbortController | null>(null);
  const audio = useRef<QuizAudioHandle | null>(null);
  useEffect(() => {
    const stop = () => { pending.current?.abort(); pending.current = null; publishCompanionEmotion(null); };
    const hide = () => { if (document.hidden) stop(); };
    window.addEventListener("fixazo:language-changing", stop);
    window.addEventListener("pagehide", stop); document.addEventListener("visibilitychange", hide);
    return () => { stop(); window.removeEventListener("fixazo:language-changing", stop); window.removeEventListener("pagehide", stop); document.removeEventListener("visibilitychange", hide); };
  }, []);
  return <section className="stack">
    <header><p className="eyebrow">Fixazo</p><h1><TranslatedText text="Texto y voz, en tu idioma" /></h1>
      <p><TranslatedText text="Elige una lengua: cambia el texto de la pantalla y el idioma que transcribe el micrófono." /></p></header>
    <LanguageSelector />
    <QuizAudioPanel ref={audio} stepId="language-practice" onTranscript={(event) => setText((previous) => [previous, event.text].filter(Boolean).join(" ").slice(0, 800))}
      onAnswerAudio={(event) => {
        pending.current?.abort();
        const request = new AbortController(); pending.current = request;
        void estimarEmocionRespuesta(event.audio, undefined, request.signal).then((estimate) => {
          if (request.signal.aborted || pending.current !== request) return;
          publishCompanionEmotion(estimate.source === "voz-emotion2vec" ? estimate.label : null);
        });
      }} />
    <label htmlFor="language-transcript"><TranslatedText text="Tu transcripción" /></label>
    <textarea id="language-transcript" className="pd-respuesta" rows={5} value={text} maxLength={800} onChange={(event) => setText(event.target.value)} />
    <p className="muted small"><TranslatedText text="Revisa la transcripción. La traducción asistida y la emoción de la mascota son experimentales; no son una evaluación." /></p>
    <p className="muted small"><TranslatedText text="Traducción experimental; pendiente de revisión por hablantes." /></p>
    <Link className="btn ghost" href="/"><TranslatedText text="Volver al periódico" /></Link>
  </section>;
}
