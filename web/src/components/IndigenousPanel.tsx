"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { IndigenousRecorder, releaseIndigenousRecorder } from "@/lib/browser/indigenous-recorder";
import type { VoiceCloudMode } from "@/lib/voice/types";

type Language = "spa_Latn" | "quy_Latn" | "quz_Latn" | "ayr_Latn";
type Capabilities = {
  enabled: boolean; mode: VoiceCloudMode; reason: string | null; configured: boolean; backendReachable: boolean;
  asr: { model: string; languages: string[]; ready: boolean; wordTimestamps: false };
  translation: { model: string; languages: string[]; enabled: boolean; ready: boolean; researchOnly: true };
};
type Result = { text: string; language?: string; sourceLanguage?: string; targetLanguage?: string; model: string };
type Access = { audience: "adult-demo" | "approved-pilot"; code: string };
const LANGUAGES: { value: Language; label: string }[] = [
  { value: "quy_Latn", label: "Quechua Ayacucho (quy)" }, { value: "quz_Latn", label: "Quechua Cusco (quz)" },
  { value: "ayr_Latn", label: "Aimara central (ayr)" }, { value: "spa_Latn", label: "Castellano (spa)" },
];
const TRANSLATION_LANGUAGES = LANGUAGES.filter((language) => language.value !== "quz_Latn");
const ERROR_COPY: Record<string, string> = {
  "not-authorized": "El código de acceso no fue aceptado. Pide al responsable el código vigente.",
  "access-denied": "El código de acceso no fue aceptado. Pide al responsable el código vigente.",
  "not-allowed": "No se autorizó la solicitud. Revisa el código y la modalidad del despliegue.",
  "voice-disabled": "El servicio está desactivado en este despliegue. No se procesó la solicitud.",
  "indigenous-unavailable": "El servidor de modelos no respondió. Conservamos el texto escrito para que puedas reintentar.",
  "backend-not-ready": "El servidor aún no terminó de cargar los modelos. Comprueba la disponibilidad antes de reintentar.",
  "translation-disabled": "La traducción de investigación no está habilitada en este despliegue.",
  "unsupported-language": "Esta variante no está habilitada para esa tarea. No cambiaremos de lengua automáticamente.",
  "invalid-audio": "El audio no cumple el formato de la demo. Graba nuevamente, hasta 30 segundos.",
  "invalid-audio-use-mono-16khz-pcm16-wav": "El servidor no aceptó el formato de audio. Graba una muestra nueva, hasta 30 segundos.",
  "indigenous-busy": "El servidor de modelos está ocupado. Espera un momento y vuelve a intentar; no repitas envíos continuamente.",
  "indigenous-not-configured": "El servidor de modelos no está configurado. Pide al responsable que complete el despliegue; no se está simulando la transcripción.",
  "request-too-large": "La solicitud supera el límite. Usa hasta 30 segundos de voz o 1500 caracteres de texto.",
  "voice-access-required": "El código de acceso no fue aceptado. Pide al responsable el código vigente.",
  "voice-rate-limit": "Se alcanzó el límite de solicitudes. Espera antes de volver a intentarlo.",
};

export function IndigenousPanel() {
  const [status, setStatus] = useState<Capabilities | null>(null);
  const [checking, setChecking] = useState(true);
  const [supported, setSupported] = useState(false);
  const [language, setLanguage] = useState<Language>("quy_Latn");
  const [target, setTarget] = useState<Language>("spa_Latn");
  const [text, setText] = useState("");
  const [code, setCode] = useState("");
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [transcript, setTranscript] = useState<Result | null>(null);
  const [translation, setTranslation] = useState<(Result & { original: string }) | null>(null);
  const recorder = useRef<IndigenousRecorder | null>(null);
  const request = useRef<AbortController | null>(null);
  const epoch = useRef(0);

  useEffect(() => {
    const abort = new AbortController();
    void readStatus(abort.signal);
    const release = () => {
      epoch.current++;
      recorder.current?.cancel(); recorder.current = null;
      request.current?.abort();
    };
    const stop = () => {
      release();
      setRecording(false); setBusy(false); setCode("");
      setText(""); setTranscript(null); setTranslation(null);
      setMessage("Se cerró la prueba al salir u ocultar la pestaña. El micrófono está apagado y se borró el contenido temporal.");
    };
    const hide = () => { if (document.hidden) stop(); };
    window.addEventListener("pagehide", stop);
    document.addEventListener("visibilitychange", hide);
    return () => {
      abort.abort(); release();
      window.removeEventListener("pagehide", stop);
      document.removeEventListener("visibilitychange", hide);
    };
  }, []);

  async function readStatus(signal?: AbortSignal) {
    setChecking(true);
    try {
      const response = await fetch("/api/indigenous", { cache: "no-store", signal });
      const data = await response.json() as Capabilities;
      if (!response.ok || typeof data.enabled !== "boolean" || !["disabled", "adult-demo", "approved-pilot"].includes(data.mode)
        || typeof data.configured !== "boolean" || typeof data.backendReachable !== "boolean" || !data.asr || !data.translation
        || !Array.isArray(data.asr.languages) || !Array.isArray(data.translation.languages)
        || typeof data.asr.ready !== "boolean" || typeof data.translation.ready !== "boolean") throw new Error("status");
      if (!signal?.aborted) {
        setStatus(data);
        setSupported(window.isSecureContext && !!navigator.mediaDevices?.getUserMedia && typeof AudioContext !== "undefined");
      }
    } catch {
      if (!signal?.aborted) { setStatus(null); setMessage("No pudimos comprobar los modelos. No se activará el micrófono ni se enviará texto hasta recuperar la disponibilidad."); }
    } finally { if (!signal?.aborted) setChecking(false); }
  }

  const accessReady = status?.enabled && status.mode !== "disabled" && code.trim().length >= 16;
  const canRecord = !!accessReady && supported && status?.backendReachable === true && status.asr.ready && status.asr.languages.includes(language);
  const canTranslate = !!accessReady && status?.backendReachable === true && status.translation.enabled && status.translation.ready
    && status.translation.languages.includes(language) && status.translation.languages.includes(target) && language !== target && !!text.trim();

  function access(): Access | null {
    if (!accessReady || !status || status.mode === "disabled") return null;
    return { audience: status.mode, code: code.trim() };
  }

  function cancel() {
    epoch.current++;
    recorder.current?.cancel(); recorder.current = null;
    request.current?.abort(); request.current = null;
    setRecording(false); setBusy(false);
    setMessage("Prueba cancelada. El micrófono está apagado; no se guardó la grabación. Si el envío ya comenzó, cancelarlo no retira lo que el servidor haya recibido.");
  }

  async function send(body: BodyInit, accessValue: Access, token: number, isJson = false) {
    const abort = new AbortController(); request.current = abort;
    const timeout = setTimeout(() => abort.abort(), 60_000);
    try {
      const response = await fetch("/api/indigenous", { method: "POST", headers: { "X-Voice-Access-Code": accessValue.code, ...(isJson ? { "Content-Type": "application/json" } : {}) }, body, signal: abort.signal });
      const data = await response.json() as Result & { error?: string };
      if (token !== epoch.current) return null;
      if (!response.ok || typeof data.text !== "string") throw new Error(data.error ?? "indigenous-unavailable");
      return data;
    } finally { clearTimeout(timeout); if (request.current === abort) request.current = null; }
  }

  async function finishRecording(accessValue: Access, selected: Language, token: number) {
    const activeRecorder = recorder.current;
    if (!activeRecorder || token !== epoch.current) return;
    recorder.current = null;
    const audio = activeRecorder.finish();
    setRecording(false);
    if (!audio?.size || audio.size > 1_000_000) { setBusy(false); setMessage("No se capturó audio válido. Revisa el micrófono y prueba otra vez."); return; }
    setMessage("Transcribiendo en el servidor de Meta… No hay evaluación ni seguimiento por palabra.");
    const form = new FormData();
    form.set("action", "transcribe"); form.set("file", audio, "muestra.wav"); form.set("language", selected);
    form.set("audience", accessValue.audience);
    try {
      const result = await send(form, accessValue, token);
      if (result && token === epoch.current) { setTranscript(result); setText(result.text); setMessage("Transcripción recibida. Debe revisarla una persona que hable esta variante antes de usarla."); }
    } catch (error) { if (token === epoch.current) setMessage(ERROR_COPY[error instanceof Error ? error.message : ""] ?? "La transcripción no se completó. Revisa la conexión y vuelve a intentarlo; no es un error de la persona que habló."); }
    finally { if (token === epoch.current) setBusy(false); }
  }

  async function startRecording() {
    const allowed = access();
    if (!canRecord || !allowed || busy || recorder.current || request.current) return;
    const token = ++epoch.current;
    const client = new IndigenousRecorder(); recorder.current = client;
    setBusy(true); setTranscript(null); setTranslation(null); setMessage("Permite el micrófono. La grabación solo empieza cuando el permiso se confirma.");
    try {
      const started = await client.start(() => void finishRecording(allowed, language, token));
      if (token !== epoch.current) { releaseIndigenousRecorder(recorder, client); return; }
      setRecording(started);
      setMessage(started ? "Grabando en memoria, máximo 30 segundos. Al detener, la muestra se envía al servidor de modelos configurado." : "Grabación cancelada.");
      if (!started) { releaseIndigenousRecorder(recorder, client); setBusy(false); }
    } catch {
      releaseIndigenousRecorder(recorder, client);
      if (token === epoch.current) { setBusy(false); setRecording(false); setMessage("No se pudo abrir el micrófono. Revisa el permiso del sitio y del sistema; no se envió una grabación."); }
    }
  }

  async function translate() {
    const allowed = access();
    if (!canTranslate || !allowed || busy || recorder.current || request.current) return;
    const token = ++epoch.current;
    const original = text.trim();
    setBusy(true); setTranslation(null); setMessage("Traduciendo texto en el servidor de investigación…");
    try {
      const result = await send(JSON.stringify({ action: "translate", text: original, sourceLanguage: language, targetLanguage: target, audience: allowed.audience }), allowed, token, true);
      if (result && token === epoch.current) { setTranslation({ ...result, original }); setMessage("Traducción automática de investigación. Revisa el original y la traducción con una persona hablante; puede cambiar el sentido."); }
    } catch (error) { if (token === epoch.current) setMessage(ERROR_COPY[error instanceof Error ? error.message : ""] ?? "La traducción no se completó. El texto escrito sigue disponible para corregirlo o reintentar."); }
    finally { if (token === epoch.current) setBusy(false); }
  }

  return (
    <div className="page" style={{ maxWidth: 820 }}>
      <header className="stack-sm">
        <h1>Laboratorio de lenguas</h1>
        <p className="muted">Demo independiente de transcripción y traducción. No da notas, no infiere emociones y no modifica las misiones ni los informes.</p>
      </header>
      <section className="card stack" aria-labelledby="indigenous-status-title">
        <h2 id="indigenous-status-title">Modelos reales, disponibilidad comprobada</h2>
        <p className="small">Omnilingual ASR de Meta transcribe; NLLB traduce texto y tiene una licencia de investigación no comercial. No son un agente conversacional ni una voz sintética en quechua. Esta demo no implica soporte de todas las lenguas indígenas.</p>
        {checking ? <p role="status">Comprobando conexión y modelos…</p> : <>
          <p><strong>{!status?.configured ? "Servidor no configurado" : !status.backendReachable ? "Servidor configurado, conexión no verificada" : "Servidor accesible"}</strong></p>
          <p className="small">ASR: {status?.asr.model ?? "Omnilingual ASR"} · {status?.asr.ready && status.backendReachable ? "modelo preparado" : "preparación no confirmada"}. Traducción: {status?.translation.model ?? "NLLB-200"} · {status?.translation.enabled && status.translation.ready && status.backendReachable ? "preparada para investigación" : "no habilitada o no preparada"}.</p>
          {!status?.enabled && <p className="notice">La demo no está habilitada en este despliegue. El responsable debe configurar el servidor, el acceso y las condiciones de privacidad. No se enviará audio ni texto.</p>}
        </>}
        <button type="button" className="btn subtle" disabled={checking || busy} onClick={() => void readStatus()}>Comprobar modelos otra vez</button>
      </section>
      <section className="card stack" aria-labelledby="indigenous-access-title">
        <h2 id="indigenous-access-title">Acceso a esta prueba</h2>
        <p className="small muted">Audio o texto se envían al servidor externo configurado por el responsable. No se guardan en el perfil, informes ni almacenamiento local. El tratamiento externo depende del despliegue. No incluyas nombres completos, datos personales ni contenido sensible.</p>
        <fieldset className="stack-sm" style={{ border: 0, padding: 0, margin: 0 }} disabled={busy || !status?.enabled}>
          <legend className="sr-only">Acceso a la prueba de lenguas</legend>
          <div className="field"><label htmlFor="indigenous-code">Código privado del responsable</label><input id="indigenous-code" type="password" className="input" value={code} minLength={16} maxLength={128} autoComplete="off" onChange={(event) => setCode(event.target.value)} /></div>
          {status?.mode === "approved-pilot" && <p className="small">Piloto autorizado: usa solo los participantes y condiciones aprobados por el responsable.</p>}
          <p className="small muted">La transcripción y la traducción requieren revisión de una persona hablante.</p>
        </fieldset>
      </section>
      <section className="card stack" aria-labelledby="indigenous-input-title">
        <h2 id="indigenous-input-title">Elegir variante y tarea</h2>
        <div className="field"><label htmlFor="indigenous-language">Lengua de la muestra o texto original</label><select id="indigenous-language" className="input" value={language} disabled={busy} onChange={(event) => { setLanguage(event.target.value as Language); setTranscript(null); setTranslation(null); setText(""); }}>{LANGUAGES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
        <p className="small muted">No sustituimos Cusco por Ayacucho. Quechua Cusco puede transcribirse si el ASR está preparado, pero esta integración NLLB no lo traduce.</p>
        <div className="row">
          {!recording ? <button type="button" className="btn" onClick={() => void startRecording()} disabled={!canRecord || busy}>Grabar muestra (máx. 30 s)</button> : <button type="button" className="btn" onClick={() => { const allowed = access(); if (allowed) void finishRecording(allowed, language, epoch.current); }}>Detener y transcribir</button>}
          {busy && <button type="button" className="btn ghost" onClick={cancel}>Cancelar y apagar micrófono</button>}
        </div>
        {!supported && <p className="small muted">La grabación necesita HTTPS y un navegador con micrófono y Web Audio. La traducción de texto no necesita micrófono.</p>}
        <div className="field"><label htmlFor="indigenous-text">Texto original para traducir (hasta 1500 caracteres)</label><textarea id="indigenous-text" className="input" value={text} maxLength={1500} rows={4} disabled={busy} onChange={(event) => { setText(event.target.value); setTranslation(null); }} placeholder="Escribe un texto o revisa aquí la transcripción antes de traducir…" /></div>
        <div className="field"><label htmlFor="indigenous-target">Traducir a</label><select id="indigenous-target" className="input" value={target} disabled={busy} onChange={(event) => { setTarget(event.target.value as Language); setTranslation(null); }}>{TRANSLATION_LANGUAGES.map((option) => <option key={option.value} value={option.value} disabled={option.value === language}>{option.label}</option>)}</select></div>
        <button type="button" className="btn ghost" disabled={!canTranslate || busy} onClick={() => void translate()}>Traducir texto · investigación</button>
        <p role="status" aria-live="polite">{message}</p>
      </section>
      {transcript && <section className="card stack-sm"><h2>Transcripción original</h2><p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{transcript.text}</p><p className="small muted">Modelo: {transcript.model}. Sin tiempos por palabra. Revisa con una persona hablante; el texto editable de traducción puede diferir de este original.</p></section>}
      {translation && <section className="card stack-sm"><h2>Traducción automática, por revisar</h2><h3>Original enviado</h3><p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{translation.original}</p><h3>Traducción propuesta</h3><p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{translation.text}</p><p className="small muted">Modelo: {translation.model}. Solo investigación; no usar como traducción certificada ni evidencia educativa confirmada.</p></section>}
      <p className="small muted">Esta demo no almacena grabaciones ni resultados. Al salir u ocultar la pestaña se cancela la captura y se borra el contenido temporal. No hay TTS indígena ni cambio automático de variante. <Link href="/privacidad">Ver privacidad</Link>.</p>
    </div>
  );
}
