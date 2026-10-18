"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { RealtimeTutor, realtimeTutorSupported, type TutorState } from "@/lib/browser/realtime-tutor";
import { Icon } from "@/components/ui";

type Policy = { enabled: boolean; mode: "disabled" | "adult-demo" | "approved-pilot"; reason: string | null };
const LABELS: Record<TutorState, string> = {
  idle: "Desconectado", connecting: "Conectando…", ready: "Listo: el micrófono no transmite voz",
  listening: "Tu turno: el micrófono transmite voz", thinking: "Preparando respuesta…", speaking: "Escucha al tutor", error: "Voz interrumpida",
};

export function VoiceTutorPanel() {
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [loadingFailed, setLoadingFailed] = useState(false);
  const [supported, setSupported] = useState(false);
  const [state, setState] = useState<TutorState>("idle");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [texts, setTexts] = useState<string[]>([]);
  const tutor = useRef<RealtimeTutor | null>(null);

  useEffect(() => {
    const abort = new AbortController();
    void fetch("/api/voice/session", { cache: "no-store", signal: abort.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("status");
        const data = await response.json() as Policy;
        if (typeof data.enabled !== "boolean" || !["disabled", "adult-demo", "approved-pilot"].includes(data.mode)) throw new Error("status");
        setPolicy(data);
        setSupported(realtimeTutorSupported());
      })
      .catch(() => { if (!abort.signal.aborted) setLoadingFailed(true); });
    return () => { abort.abort(); tutor.current?.stop(); tutor.current = null; };
  }, []);

  useEffect(() => {
    const stop = () => tutor.current?.stop();
    const hide = () => { if (document.hidden) stop(); };
    window.addEventListener("pagehide", stop);
    document.addEventListener("visibilitychange", hide);
    return () => { window.removeEventListener("pagehide", stop); document.removeEventListener("visibilitychange", hide); };
  }, []);

  const active = !["idle", "error"].includes(state);
  const canStart = policy?.enabled && policy.mode !== "disabled" && supported && code.trim().length >= 16;

  async function connect() {
    if (!canStart || !policy || policy.mode === "disabled") return;
    tutor.current?.stop();
    setMessage("");
    setTexts([]);
    const client = new RealtimeTutor({
      onState: setState,
      onError: (text) => { setMessage(text); setTexts([]); },
      onTutorText: (text) => setTexts((previous) => [...previous.slice(-7), text]),
      onEnd: (reason) => { setTexts([]); setMessage(reason === "time-limit" ? "La prueba terminó al llegar a tres minutos. El micrófono está apagado." : "Conexión cerrada. El micrófono está apagado y el texto temporal se borró."); },
    });
    tutor.current = client;
    await client.start({ audience: policy.mode, accessCode: code.trim() });
    setCode("");
  }

  return (
    <div className="stack" style={{ maxWidth: 760, margin: "0 auto", gap: 24 }}>
      <header className="stack-sm">
        <h1>Prueba el tutor de voz</h1>
        <p className="muted">Una conversación de práctica con inteligencia artificial. Es independiente de las misiones y no modifica el informe ni la evaluación.</p>
      </header>
      <section className="card stack" aria-labelledby="voice-demo-heading">
        <h2 id="voice-demo-heading">Tú decides cuándo hablar</h2>
        <p>La voz del tutor es generada por OpenAI: <strong>gpt-realtime-2.1 · marin</strong>. No es una persona. Puede equivocarse y no está validada para evaluar lectura infantil en castellano o quechua.</p>
        <p className="small muted">La app no guarda audio ni esta conversación. Al conectar, la voz se envía directamente a OpenAI durante tus turnos; el proveedor aplica sus propias condiciones de tratamiento. La prueba se cierra al ocultar esta pestaña o tras tres minutos. No compartas datos personales.</p>

        {!policy && !loadingFailed && <p role="status">Consultando disponibilidad de voz…</p>}
        {loadingFailed && <p role="alert">No se pudo consultar la disponibilidad. Recarga esta página para volver a intentar.</p>}
        {policy && !policy.enabled && <div className="notice stack-sm" role="status"><strong>Voz en la nube no habilitada</strong><p>El despliegue necesita una clave del proveedor, un código privado y una modalidad aprobada de uso. No se ha conectado el micrófono ni se está simulando una conversación.</p><p className="small muted">Puedes continuar con las misiones sin esta demostración.</p></div>}
        {policy?.enabled && !supported && <p role="alert">Necesitas HTTPS y un navegador con WebRTC y permiso de micrófono. Prueba Chrome o Edge actualizados.</p>}
        {policy?.enabled && supported && !active && (
          <div className="stack">
            <div className="field"><label htmlFor="voice-demo-code">Código privado del piloto</label><input id="voice-demo-code" type="password" autoComplete="off" className="input" value={code} minLength={16} maxLength={128} onChange={(event) => setCode(event.target.value)} aria-describedby="voice-demo-code-help" /><span id="voice-demo-code-help" className="small muted">Pídelo al responsable del despliegue; tiene al menos 16 caracteres. No se guarda en este dispositivo.</span></div>
          </div>
        )}
        <p role="status" aria-live="polite"><strong>{LABELS[state]}</strong></p>
        {message && <p role={state === "error" ? "alert" : "status"}>{message}</p>}
        <div className="row">
          {!active && <button type="button" className="btn" disabled={!canStart} onClick={() => void connect()}><Icon name="sound" />Conectar tutor</button>}
          {state === "ready" && <button type="button" className="btn" onClick={() => tutor.current?.beginTurn()}><Icon name="mic" />Empezar mi turno</button>}
          {state === "listening" && <button type="button" className="btn" onClick={() => tutor.current?.endTurn()}>Enviar mi turno</button>}
          {active && <button type="button" className="btn ghost" onClick={() => tutor.current?.stop()}>Cerrar y borrar conversación</button>}
        </div>
        {active && <p className="small muted">Pulsa «Empezar mi turno», habla y pulsa «Enviar mi turno». El micrófono no transmite tu voz mientras responde el tutor. Cada turno se envía a los 30 segundos como máximo.</p>}
      </section>
      {texts.length > 0 && <section className="stack-sm" aria-labelledby="voice-demo-text"><h2 id="voice-demo-text">Lo que dijo el tutor</h2><p className="small muted">Texto temporal, no evidencia de lectura. Se borra al cerrar.</p><ol className="stack">{texts.map((text, index) => <li key={index}>{text}</li>)}</ol></section>}
      <p className="small muted">Sin inferencias de emoción, acento, identidad o salud. Si quieres indicar cómo te sientes, puedes hacerlo tú en la misión. <Link href="/privacidad">Revisar privacidad</Link> · <Link href="/chat">Volver a las misiones</Link></p>
    </div>
  );
}
