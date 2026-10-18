"use client";

import { useEffect, useRef, useState } from "react";
import { MetaReadingClient, ReadingChunkQueue, READING_LANGUAGES, boundedReadingHistory, matchObservedWords, referenceWords, type PreparedReading, type ReadingCapabilities, type ReadingHistoryEntry, type ReadingLanguage, type ReadingReply } from "@/lib/browser/meta-reading-client";
import { ReadingPcmCapture } from "@/lib/browser/reading-pcm-capture";
import { normalizeWord } from "@/lib/signals/text";
import styles from "./MultilingualReadingSession.module.css";

type Phase = "setup" | "preparing" | "ready" | "reading" | "processing" | "conversation" | "answer-recording" | "answer-processing" | "speaking" | "paused";
const ERROR_COPY: Record<string, string> = {
  "capture-backpressure": "El servidor tardó más que la grabación. Se pausó la captura para no acumular ni descartar fragmentos sin avisar. Autoriza de nuevo para continuar; el último fragmento no se procesó.",
  "voice-access-required": "El código no fue aceptado. Pide el código vigente al responsable y vuelve a autorizar.",
  "voice-rate-limit": "Se alcanzó el límite de solicitudes. El micrófono está apagado. Espera antes de volver a autorizar.",
  "adult-demo-only": "Esta prueba solo admite voces adultas o sintéticas. No se activó una sesión infantil.",
  "no-observable-words": "No obtuvimos palabras observables en el fragmento. No se considera un error de lectura. Puedes volver a autorizar y repetirlo.",
  "backend-not-ready": "Los modelos todavía no están preparados. Comprueba su disponibilidad antes de volver a autorizar.",
  "speech-unavailable": "La voz sintética de esta lengua no está disponible. No la sustituiremos por una voz en castellano.",
  "playback-blocked": "El navegador no reprodujo la voz. Vuelve a autorizar y pulsa «Escuchar pregunta». No se activó el micrófono.",
};

/** No timer/prefix state: only indices matched to actual returned ASR words. */
export function ObservedPassageText({ passage, language, observed }: { passage: string; language: ReadingLanguage; observed: readonly number[] }) {
  let wordIndex = -1;
  const seen = new Set(observed);
  return <p className={styles.text} lang={language === "quy_Latn" ? "quy" : "ayr"}>{passage.split(/(\s+)/).map((word, index) => {
    if (!normalizeWord(word)) return word;
    wordIndex++;
    return <span key={index} className={seen.has(wordIndex) ? styles.observed : undefined} data-observed={seen.has(wordIndex) ? "true" : "false"}>{word}</span>;
  })}</p>;
}

/** A scripted opening is not evidence that the subsequent model is disabled. */
export function readingDialoguePresentation(dialogue: ReadingCapabilities["dialogue"], reply: Pick<ReadingReply, "dialogueMode" | "model"> | null) {
  const localDialogue = reply ? reply.dialogueMode === "local-llm-reading" : dialogue?.enabled === true;
  const model = reply?.model ?? dialogue?.model ?? "modelo local configurado";
  return {
    heading: localDialogue ? "Conversación con modelo local" : "Conversación guiada por un guion",
    description: localDialogue
      ? `Modelo: ${model}. ${reply ? "Esta respuesta proviene del modelo local." : "La apertura es un guion predefinido; los siguientes turnos usarán el modelo local configurado, cuya respuesta aún no se ha generado."} Conversa sobre el texto en castellano y traducimos sus respuestas; puede equivocarse.`
      : "Este modo sigue preguntas programadas, no es un agente de conversación libre.",
    questionLabel: reply ? "Respuesta del agente" : "Pregunta de apertura predefinida",
  };
}

/** Isolated adult research lane. Never receives a profile/controller/report. */
export function MultilingualReadingSession({ passage, title, onClose }: { passage: string; title: string; onClose: () => void }) {
  const [status, setStatus] = useState<ReadingCapabilities | null>(null);
  const [checking, setChecking] = useState(true);
  const [language, setLanguage] = useState<ReadingLanguage>("quy_Latn");
  const [code, setCode] = useState("");
  const [consent, setConsent] = useState(false);
  const [adult, setAdult] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [prepared, setPrepared] = useState<PreparedReading | null>(null);
  const [phase, setPhase] = useState<Phase>("setup");
  const [message, setMessage] = useState("");
  const [transcript, setTranscript] = useState("");
  const [observed, setObserved] = useState<number[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [reply, setReply] = useState<ReadingReply | null>(null);
  const [heard, setHeard] = useState("");
  const [turn, setTurn] = useState(0);
  const [model, setModel] = useState("");
  const [captureReady, setCaptureReady] = useState(false);
  const client = useRef<MetaReadingClient | null>(null);
  const capture = useRef<ReadingPcmCapture | null>(null);
  const queue = useRef<ReadingChunkQueue<Blob> | null>(null);
  const player = useRef<HTMLAudioElement | null>(null);
  const playbackUrl = useRef<string | null>(null);
  const playbackDone = useRef<(() => void) | null>(null);
  const epoch = useRef(0);
  const cursor = useRef(0);
  const observedRef = useRef(new Set<number>());
  const elapsedRef = useRef(0);
  const preparedRef = useRef<PreparedReading | null>(null);
  const answerBlob = useRef<Blob | null>(null);
  const readingDone = useRef(false);
  const finishingAnswer = useRef(false);
  const speechTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusRequest = useRef<AbortController | null>(null);
  const history = useRef<ReadingHistoryEntry[]>([]);

  function releaseAudio() {
    if (speechTimer.current) clearTimeout(speechTimer.current);
    speechTimer.current = null;
    if (player.current) { player.current.onended = null; player.current.onerror = null; player.current.pause(); player.current.src = ""; player.current = null; }
    if (playbackUrl.current) URL.revokeObjectURL(playbackUrl.current);
    playbackUrl.current = null;
    playbackDone.current?.(); playbackDone.current = null;
  }
  function release() {
    epoch.current++;
    statusRequest.current?.abort(); statusRequest.current = null;
    capture.current?.abort(); capture.current = null;
    queue.current?.cancel(); queue.current = null;
    client.current?.close(); client.current = null;
    answerBlob.current = null; finishingAnswer.current = false;
    history.current = [];
    releaseAudio();
  }
  function pauseSession(copy = "Prueba pausada. El micrófono está apagado, se revocó la autorización y se borró el contexto de conversación. Puedes autorizar de nuevo sin perder el texto observado.") {
    release(); setChecking(false); setCaptureReady(false); setAuthorized(false); setCode(""); setConsent(false); setAdult(false); setPhase("paused"); setMessage(copy);
  }
  function fail(error: unknown) {
    const name = error instanceof Error ? error.message : "";
    pauseSession(ERROR_COPY[name] ?? "No se completó el procesamiento. Se apagó el micrófono y se conservaron solo los resultados recibidos. No es un error de quien lee. Revisa la conexión y vuelve a autorizar.");
  }

  async function checkStatus(signal?: AbortSignal) {
    if (signal?.aborted) return;
    statusRequest.current?.abort();
    const abort = new AbortController();
    statusRequest.current = abort;
    const current = () => statusRequest.current === abort && !signal?.aborted;
    const externalAbort = () => abort.abort();
    signal?.addEventListener("abort", externalAbort, { once: true });
    const timer = setTimeout(() => abort.abort(), 10_000);
    setChecking(true);
    try {
      const data = await MetaReadingClient.capabilities(abort.signal);
      if (current() && !abort.signal.aborted) setStatus(data);
    } catch { if (current()) { setStatus(null); setMessage("No se pudo comprobar el servicio. No se activará el micrófono hasta recuperar la disponibilidad."); } }
    finally { clearTimeout(timer); signal?.removeEventListener("abort", externalAbort); if (current()) setChecking(false); if (statusRequest.current === abort) statusRequest.current = null; }
  }

  useEffect(() => {
    const abort = new AbortController();
    void Promise.resolve().then(() => checkStatus(abort.signal));
    const stop = () => {
      release(); setChecking(false); setCaptureReady(false); setAuthorized(false); setCode(""); setConsent(false); setAdult(false); setPhase("paused");
      setMessage("Se pausó la prueba al ocultar o salir de la pestaña. El micrófono está apagado y se borró el contexto de conversación; vuelve a autorizar para continuar.");
    };
    const hide = () => { if (document.hidden) stop(); };
    window.addEventListener("pagehide", stop);
    document.addEventListener("visibilitychange", hide);
    return () => { abort.abort(); release(); window.removeEventListener("pagehide", stop); document.removeEventListener("visibilitychange", hide); };
    // Lifecycle resources are refs; callbacks must not restart on each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const busy = ["preparing", "reading", "processing", "answer-recording", "answer-processing", "speaking"].includes(phase);
  const available = !!status?.enabled && status.mode !== "disabled" && status.asr.ready && status.asr.wordTimestamps
    && status.asr.timingMethod === "ctc-greedy-frames" && status.asr.languages.includes(language)
    && status.translation.enabled && status.translation.ready && status.translation.languages.includes(language)
    && status.speech.enabled && status.speech.languages.includes(language);
  const canAuthorize = available && code.trim().length >= 16 && consent && adult;
  const supportsCapture = typeof window !== "undefined" && window.isSecureContext && !!navigator.mediaDevices?.getUserMedia && typeof AudioContext !== "undefined";
  const question = reply?.replyText ?? prepared?.opening ?? "";
  const dialogue = readingDialoguePresentation(status?.dialogue, reply);
  const totalWords = prepared ? referenceWords(prepared.passage).length : 0;

  async function authorize() {
    if (!canAuthorize || !status || status.mode === "disabled" || busy) return;
    release();
    const token = epoch.current;
    const service = new MetaReadingClient({ accessCode: code.trim(), audience: status.mode, consent: true, adultConfirmed: true });
    client.current = service; setCode(""); setAuthorized(true);
    if (preparedRef.current) { setPhase(readingDone.current ? "conversation" : "ready"); setMessage("Autorización renovada. El micrófono solo se activa al pulsar el botón de lectura o respuesta."); return; }
    setPhase("preparing"); setMessage("Preparando el texto de la misión en la lengua elegida… No es una traducción validada por una persona.");
    try {
      const result = await service.prepare(passage, language);
      if (token !== epoch.current) return;
      preparedRef.current = result; setPrepared(result); setPhase("ready");
      setMessage("Texto preparado automáticamente. Revísalo con una persona hablante antes de usarlo; esta prueba no evalúa a niños.");
    } catch (error) { if (token === epoch.current) fail(error); }
  }

  async function startReading() {
    const service = client.current, text = preparedRef.current;
    if (!service || !text || !authorized || !reviewed || phase !== "ready" || capture.current || queue.current || !supportsCapture || elapsedRef.current >= 60) return;
    const token = ++epoch.current;
    const base = elapsedRef.current;
    const pending = new ReadingChunkQueue<Blob>(async (blob) => {
      const result = await service.transcribe(blob, language);
      if (token !== epoch.current) return;
      const matches = matchObservedWords(text.passage, result.words, observedRef.current, cursor.current);
      observedRef.current = matches.observed; cursor.current = matches.cursor;
      setObserved([...matches.observed]); setModel(result.model);
      setTranscript((previous) => [previous, result.text].filter(Boolean).join(" "));
      setMessage("Fragmento recibido. Solo se resaltan coincidencias observadas; las palabras sin resaltar no son errores.");
    }, (error) => { if (token === epoch.current) fail(error); });
    queue.current = pending;
    const microphone = new ReadingPcmCapture({ chunkSeconds: 4, maxSeconds: 60 - base,
      onChunk: (blob, timing) => {
        if (token !== epoch.current) return;
        elapsedRef.current = Math.min(60, base + timing.startSeconds + timing.durationSeconds); setElapsed(elapsedRef.current);
        if (!pending.enqueue(blob)) fail(new Error("capture-backpressure"));
      }, onLimit: () => { if (token === epoch.current) void finishReading(); },
      onError: (error) => { if (token === epoch.current) fail(new Error(error)); },
    });
    capture.current = microphone; setCaptureReady(false); setPhase("reading"); setMessage("Permite el micrófono. Se envían fragmentos de unos 4 segundos, no una grabación continua guardada.");
    try { const started = await microphone.start(); if (token !== epoch.current) { microphone.abort(); return; } if (!started) fail(new Error("audio-capture")); else setCaptureReady(true); }
    catch (error) { if (token === epoch.current) fail(error); }
  }

  async function finishReading() {
    if (!capture.current || !queue.current) return;
    const token = epoch.current;
    const microphone = capture.current; capture.current = null;
    microphone.stop();
    if (token !== epoch.current) return;
    setCaptureReady(false); setPhase("processing"); setMessage("Micrófono apagado. Esperando los fragmentos enviados; este tiempo no se cuenta como lectura.");
    await queue.current?.idle();
    if (token !== epoch.current) return;
    queue.current = null; readingDone.current = true; setPhase("conversation");
    setMessage("Lectura cerrada. Puedes escuchar la pregunta guía y responder por turnos. No se generan notas ni informes.");
  }

  async function startAnswer() {
    if (!client.current || !preparedRef.current || !authorized || phase !== "conversation" || capture.current || turn >= 9 || !supportsCapture) return;
    const token = ++epoch.current;
    releaseAudio(); answerBlob.current = null; finishingAnswer.current = false;
    const microphone = new ReadingPcmCapture({ chunkSeconds: 15, maxSeconds: 15,
      onChunk: (blob) => { if (token === epoch.current) answerBlob.current = blob; },
      onLimit: () => { if (token === epoch.current) void finishAnswer(); },
      onError: (error) => { if (token === epoch.current) fail(new Error(error)); },
    });
    capture.current = microphone; setCaptureReady(false); setPhase("answer-recording"); setMessage("Tu respuesta: máximo 15 segundos. Pulsa «Enviar respuesta» al terminar.");
    try { const started = await microphone.start(); if (token !== epoch.current) { microphone.abort(); return; } if (!started) fail(new Error("audio-capture")); else setCaptureReady(true); }
    catch (error) { if (token === epoch.current) fail(error); }
  }

  async function finishAnswer() {
    const service = client.current;
    if (!capture.current || !service || finishingAnswer.current) return;
    finishingAnswer.current = true;
    const token = epoch.current;
    const microphone = capture.current; capture.current = null;
    microphone.stop();
    const blob = answerBlob.current; answerBlob.current = null;
    if (token !== epoch.current) return;
    if (!blob) { fail(new Error("no-observable-words")); return; }
    setCaptureReady(false); setPhase("answer-processing"); setMessage("Micrófono apagado. Transcribiendo y preparando la respuesta del servidor…");
    try {
      const native = await service.transcribe(blob, language);
      if (token !== epoch.current) return;
      setHeard(native.text);
      const next = await service.turn(passage, native.text, language, turn, history.current);
      if (token !== epoch.current) return;
      history.current = boundedReadingHistory([...history.current, { role: "user", text: next.heardSpanish }, { role: "assistant", text: next.replySpanish }]);
      setReply(next); setTurn((previous) => previous + 1); setPhase("conversation");
      setMessage(next.dialogueMode === "local-llm-reading" ? "Respuesta del modelo local recibida. Puede equivocarse; revisa el original y la traducción. No es una evaluación." : "Respuesta del guion recibida. Revisa las traducciones; este modo no es una conversación libre ni una evaluación.");
    } catch (error) { if (token === epoch.current) fail(error); }
    finally { if (token === epoch.current) finishingAnswer.current = false; }
  }

  async function speakQuestion() {
    const service = client.current;
    if (!service || !authorized || phase !== "conversation" || !question || question.length > 300) return;
    capture.current?.abort(); capture.current = null;
    const token = ++epoch.current;
    releaseAudio(); setPhase("speaking"); setMessage("Preparando la voz sintética de esta lengua… La primera carga puede tardar. El micrófono está apagado.");
    try {
      const wav = await service.speak(question, language);
      if (token !== epoch.current) return;
      const url = URL.createObjectURL(wav); playbackUrl.current = url;
      const audio = new Audio(url); player.current = audio;
      await new Promise<void>((resolve, reject) => {
        playbackDone.current = resolve;
        audio.onended = () => resolve();
        audio.onerror = () => reject(new Error("playback-blocked"));
        speechTimer.current = setTimeout(() => reject(new Error("playback-blocked")), 35_000);
        void audio.play().catch(() => reject(new Error("playback-blocked")));
      });
      if (token !== epoch.current) return;
      releaseAudio(); setPhase("conversation"); setMessage("Pregunta terminada. Pulsa «Responder con voz» cuando quieras; no se abre el micrófono automáticamente.");
    } catch (error) { if (token === epoch.current) fail(error); }
  }

  function changeLanguage(value: ReadingLanguage) {
    release(); setLanguage(value); setPrepared(null); preparedRef.current = null;
    setAuthorized(false); setReviewed(false); setCode(""); setConsent(false); setAdult(false); setPhase("setup");
    setObserved([]); observedRef.current.clear(); cursor.current = 0; setTranscript(""); setReply(null); setHeard(""); setTurn(0);
    setElapsed(0); elapsedRef.current = 0; readingDone.current = false; setMessage("");
  }

  return (
    <div className={styles.session}>
      <header className={styles.header}>
        <div><h1>Lectura multilingüe</h1><p className="muted">Demo adulta no comercial dentro de tu misión · sin notas ni informes</p></div>
        <button type="button" className="btn ghost" onClick={() => { release(); onClose(); }}>Volver a la misión</button>
      </header>
      <p className="notice">Solo voz adulta o sintética. Meta reconoce la lectura; NLLB traduce; MMS genera la voz. El modo de conversación se muestra según el modelo realmente habilitado. No infiere emociones ni juzga el acento.</p>

      {!authorized && <section className={styles.authorization} aria-labelledby="reading-access-title">
        <h2 id="reading-access-title">Autorizar esta prueba</h2>
        <div className={styles.fields}>
          <div className="field"><label htmlFor="reading-language">Lengua de la lectura y la conversación</label><select id="reading-language" className="input" value={language} disabled={busy} onChange={(event) => changeLanguage(event.target.value as ReadingLanguage)}>{READING_LANGUAGES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
          <div className="field"><label htmlFor="reading-access-code">Código privado del responsable</label><input id="reading-access-code" className="input" type="password" value={code} minLength={16} maxLength={128} autoComplete="off" onChange={(event) => setCode(event.target.value)} /></div>
        </div>
        <label className={styles.check}><input type="checkbox" checked={adult} onChange={(event) => setAdult(event.target.checked)} /><span>Confirmo que usaré solo voz adulta o sintética, no la voz de un menor.</span></label>
        <label className={styles.check}><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>Autorizo enviar el texto de esta misión y los fragmentos de voz al servidor configurado. Entiendo que las transcripciones y traducciones necesitan revisión de una persona hablante.</span></label>
        <p className="small muted">El código y el contenido de esta prueba solo viven en memoria. Esta vía no adjunta el perfil ni sus informes; evita datos personales en el texto y la voz. El servidor recibe audio para procesarlo; cancelar no retira lo ya recibido.</p>
        <div className="row"><button type="button" className="btn" disabled={!canAuthorize || checking || busy} onClick={() => void authorize()}>{prepared ? "Autorizar y continuar" : "Preparar lectura en esta lengua"}</button><button type="button" className="btn subtle" disabled={checking || busy} onClick={() => void checkStatus()}>{checking ? "Comprobando…" : "Comprobar modelos"}</button></div>
        {!checking && !available && <p className="small" role="status">No están disponibles todos los modelos necesarios para esta lengua. No se activará el micrófono. {status?.reason}</p>}
        {status && <p className="small muted">Conversación: {status.dialogue?.enabled ? `${status.dialogue.model ?? "modelo local"} · ${status.dialogue.ready ? "carga confirmada" : "carga aún no confirmada"}` : "guion de preguntas programadas; no hay un modelo conversacional habilitado"}. No se cambia de modo silenciosamente si falla el modelo.</p>}
      </section>}

      {prepared && <section className={styles.passage} aria-labelledby="multilingual-passage-title">
        <div className="spread"><h2 id="multilingual-passage-title">{title}</h2><span className="small mono">{Math.floor(elapsed)} / 60 s de audio</span></div>
        <p className="small muted">Traducción automática de investigación, no validada para evaluación infantil. Puede cambiar el sentido o la variante. Solo se resaltan palabras realmente reconocidas y coincidentes; el resto no se marca como error.</p>
        <ObservedPassageText passage={prepared.passage} language={language} observed={observed} />
        <p className="small">{observed.length} de {totalWords} palabras con coincidencia observada · {model || status?.asr.model || "Omnilingual ASR"}</p>
        <p className="small muted">Actualización por fragmentos de unos 4 segundos más el tiempo del servidor. Tiempos aproximados de frames CTC, no alineación forzada ni seguimiento instantáneo. Las palabras cortadas entre fragmentos pueden no reconocerse.</p>
        <details><summary>Ver texto original de la misión en castellano</summary><p className={styles.original}>{passage}</p></details>
        {phase === "ready" && authorized && <>
          <label className={styles.check}><input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} /><span>Revisé el texto para esta prueba adulta; entiendo que eso no lo convierte en material validado para niños.</span></label>
          <button type="button" className="btn kid" disabled={!reviewed || !supportsCapture || elapsed >= 60} onClick={() => void startReading()}>{elapsed > 0 ? "Continuar lectura con micrófono" : "Comenzar lectura con micrófono"}</button>
        </>}
        {phase === "reading" && <>
          <p className="small" role="status">{captureReady ? "Micrófono activo. Lee el texto en voz alta; tú decides cuándo terminar." : "Esperando permiso del micrófono…"}</p>
          <button type="button" className="btn kid" disabled={!captureReady} onClick={() => void finishReading()}>Terminar lectura y apagar micrófono</button>
        </>}
        {transcript && <details><summary>Ver transcripción recibida</summary><p className={styles.original}>{transcript}</p><p className="small muted">No es una nota de exactitud. No se guarda al salir de esta prueba.</p></details>}
      </section>}

      {prepared && readingDone.current && <section className={styles.dialogue} aria-labelledby="guided-dialogue-title">
        <h2 id="guided-dialogue-title">{dialogue.heading}</h2>
        <p className="small muted">{dialogue.description} Una respuesta por turno, hasta 9 respuestas de 15 segundos. No se escucha mientras habla la voz sintética. Las traducciones no sustituyen lo que dijiste.</p>
        <div className={styles.question}><strong>{dialogue.questionLabel}</strong><p lang={language === "quy_Latn" ? "quy" : "ayr"}>{question}</p>{reply?.replySpanish && <p className="small muted">Versión en castellano, por revisar: {reply.replySpanish}</p>}</div>
        {heard && <div className={styles.answer}><strong>Lo reconocido en tu lengua</strong><p>{heard}</p>{reply?.heardSpanish && <p className="small muted">Traducción propuesta: {reply.heardSpanish}</p>}</div>}
        <div className="row">
          <button type="button" className="btn ghost" disabled={!authorized || phase !== "conversation"} onClick={() => void speakQuestion()}>Escuchar pregunta en esta lengua</button>
          <button type="button" className="btn" disabled={!authorized || phase !== "conversation" || turn >= 9 || !supportsCapture} onClick={() => void startAnswer()}>Responder con voz (máx. 15 s)</button>
          {phase === "answer-recording" && <button type="button" className="btn" disabled={!captureReady} onClick={() => void finishAnswer()}>Enviar respuesta y apagar micrófono</button>}
        </div>
        {turn >= 9 && <p role="status">Terminó el límite de esta conversación. No se generó una evaluación ni se guardó un informe.</p>}
        <p className="small muted">Voz: {status?.speech.models[language] ?? "MMS de Meta"}. No se usa una voz en castellano para fingir que habla esta lengua.</p>
      </section>}

      <div className={styles.status} role="status" aria-live="polite">{message || "Elige una lengua y autoriza esta prueba adulta. No se abre el micrófono automáticamente."}</div>
      {authorized && <button type="button" className="btn ghost" onClick={() => pauseSession()}>Pausar y apagar voz y micrófono</button>}
      {!supportsCapture && <p className="small muted">La captura necesita HTTPS, Web Audio y permiso de micrófono del navegador y del sistema.</p>}
    </div>
  );
}
