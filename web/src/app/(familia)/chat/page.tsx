"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Mission } from "@/lib/types";
import { notifyStore, useStore } from "@/lib/useStore";
import { getStore, type ChatMessage } from "@/lib/storage";
import { SAMPLE_ES, SAMPLE_QU } from "@/lib/mission/samples";
import { Icon } from "@/components/ui";
import { MissionSheet } from "@/components/MissionSheet";

const CHIP_SAMPLE_ES = "Misión de ejemplo en castellano";
const CHIP_SAMPLE_QU = "Misión de ejemplo en quechua";
const CHIP_PASTE = "Pegar un texto";
const CHIP_NOW = "Ahora, con mi celular";
const CHIP_LATER = "Hoy a las 7 p. m.";
const CHIP_VIEW = "Ver la lectura y las preguntas";
const CHIP_REPORT = "Ver el informe";

const uid = () => `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const now = () => new Date().toISOString();

function greeting(alias: string): ChatMessage {
  return {
    id: "greeting",
    who: "asistente",
    text: `Hola. Soy Fixazo. Pega aquí la lectura de la tarea de ${alias} y armo una misión de 8 minutos para hacerla con voz. También puedes probar con una misión de ejemplo.`,
    chips: [CHIP_SAMPLE_ES, CHIP_SAMPLE_QU, CHIP_PASTE],
    at: "",
  };
}

function missionSummary(m: Mission, alias: string, warnings: string[] = []): string {
  const lang = m.lang === "qu" ? "quechua (textos en validación)" : "castellano";
  return [
    `Listo. Armé la misión «${m.title}» en ${lang} para ${alias}. Son 4 pasos, unos 8 minutos:`,
    "1. Elige una carita: cómo llega.",
    "2. Lee en voz alta, hasta 1 minuto.",
    "3. Tres preguntas: qué dice, por qué pasó y qué opina.",
    "4. Un dato nuevo para pensar y cierre.",
    "No le daré las respuestas: le haré preguntas para que piense.",
    ...warnings,
  ].join("\n");
}

export default function ChatPage() {
  const store = useStore();
  if (!store) return <div className="skeleton" style={{ height: 420 }} />;
  return <Chat />;
}

function Chat() {
  const router = useRouter();
  const store = useStore();
  const profile = store?.loadProfile() ?? null;
  const consent = store?.loadConsent() ?? null;
  const paused = store?.loadPaused() ?? null;
  const reminder = store?.loadReminder() ?? null;
  const saved = store?.loadChat() ?? [];
  const alias = profile?.alias ?? "tu hijo";
  const messages = [greeting(alias), ...saved];
  const current = store?.currentMission() ?? null;

  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [llm, setLlm] = useState(false);
  const [sheet, setSheet] = useState<Mission | null>(null);
  const [entiendo, setEntiendo] = useState(false);
  const [dictating, setDictating] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const draftRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    fetch("/api/mission")
      .then((r) => r.json())
      .then((j: { llm?: boolean }) => setLlm(!!j.llm))
      .catch(() => setLlm(false));
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [saved.length, busy]);

  function push(...msgs: Omit<ChatMessage, "id" | "at">[]) {
    const s = getStore();
    s.saveChat([...s.loadChat(), ...msgs.map((m) => ({ ...m, id: uid(), at: now() }))]);
    notifyStore();
  }

  function adoptMission(m: Mission, warnings: string[] = []) {
    const s = getStore();
    s.saveMission(m);
    s.setCurrentMission(m.id);
    push({ who: "asistente", text: missionSummary(m, alias, warnings), missionId: m.id, chips: [CHIP_NOW, CHIP_LATER, CHIP_VIEW] });
  }

  async function createFromText(text: string) {
    setBusy("Armando la misión…");
    try {
      const res = await fetch("/api/mission", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, grade: profile?.grade ?? 4 }),
      });
      const j = (await res.json()) as { mission?: Mission; error?: string; warnings?: string[] };
      if (!res.ok || !j.mission) push({ who: "asistente", text: j.error ?? "No pude armar la misión. Intenta con otro texto." });
      else adoptMission(j.mission, j.warnings ?? []);
    } catch {
      push({ who: "asistente", text: "Sin conexión. Te avisaremos cuando vuelva la señal; mientras tanto puedes usar una misión de ejemplo.", chips: [CHIP_SAMPLE_ES] });
    } finally {
      setBusy(null);
    }
  }

  async function onPhoto(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      push({ who: "asistente", text: "La foto pesa más de 10 MB. Toma otra con menos resolución." });
      return;
    }
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) {
      push({ who: "asistente", text: "Esa foto no la puedo leer (formato HEIC u otro). Envíala como JPG o PNG." });
      return;
    }
    push({ who: "familia", text: `📷 Foto: ${file.name}` });
    setBusy("Leyendo tu foto…");
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result).split(",")[1] ?? "");
        fr.onerror = () => reject(fr.error);
        fr.readAsDataURL(file);
      });
      const res = await fetch("/api/mission", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image: { data, mediaType: file.type }, grade: profile?.grade ?? 4 }),
      });
      const j = (await res.json()) as { mission?: Mission; error?: string };
      if (!res.ok || !j.mission) push({ who: "asistente", text: j.error ?? "No pude leer la foto. Toma otra con más luz, sin sombras y con toda la página." });
      else adoptMission(j.mission);
    } catch {
      push({ who: "asistente", text: "No pude enviar la foto. Revisa tu conexión e intenta otra vez." });
    } finally {
      setBusy(null);
    }
  }

  function send() {
    const text = draft.trim();
    if (!text || busy) return;
    setDraft("");
    push({ who: "familia", text });
    const words = text.split(/\s+/).length;
    if (/(c[oó]mo va|progreso|avance)/i.test(text) && words < 12) {
      const n = getStore().listReports().length;
      push({
        who: "asistente",
        text: n ? `Tengo ${n} informe(s) guardados de ${alias}. Míralos en Progreso.` : `Todavía no hay sesiones de ${alias}. Cuando haga la primera, te cuento cómo va.`,
      });
      return;
    }
    if (/(respuesta|resuelve|hazle la tarea|dime qué responde)/i.test(text) && words < 25) {
      push({ who: "asistente", text: "No hago la tarea ni doy las respuestas de la lectura. Mi trabajo es hacerle preguntas para que piense con su propia voz." });
      return;
    }
    void createFromText(text);
  }

  function onChip(chip: string, m: ChatMessage) {
    const mission = (m.missionId && getStore().getMission(m.missionId)) || current;
    switch (chip) {
      case CHIP_SAMPLE_ES:
        push({ who: "familia", text: CHIP_SAMPLE_ES });
        adoptMission({ ...SAMPLE_ES, grade: profile?.grade ?? SAMPLE_ES.grade });
        break;
      case CHIP_SAMPLE_QU:
        push({ who: "familia", text: CHIP_SAMPLE_QU });
        adoptMission(SAMPLE_QU, ["Nota: los textos en quechua son borradores; falta validarlos con un hablante."]);
        break;
      case CHIP_PASTE:
        draftRef.current?.focus();
        break;
      case CHIP_NOW:
        if (mission) {
          getStore().setCurrentMission(mission.id);
          notifyStore();
        }
        router.push("/sesion");
        break;
      case CHIP_LATER: {
        const d = new Date();
        d.setHours(19, 0, 0, 0);
        getStore().saveReminder(d.toISOString());
        push({ who: "familia", text: CHIP_LATER }, { who: "asistente", text: "Listo. Guardé un recordatorio para hoy a las 7 p. m. en este dispositivo.", chips: [CHIP_NOW] });
        break;
      }
      case CHIP_VIEW:
        if (mission) setSheet(mission);
        break;
      case CHIP_REPORT:
        router.push(m.reportId ? `/informe?id=${encodeURIComponent(m.reportId)}` : "/informe");
        break;
    }
  }

  function toggleDictation() {
    type Rec = { lang: string; interimResults: boolean; onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onend: () => void; start: () => void; stop: () => void };
    const w = window as unknown as { webkitSpeechRecognition?: new () => Rec; SpeechRecognition?: new () => Rec };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    if (dictating) {
      recRef.current?.stop();
      return;
    }
    const rec = new Ctor();
    rec.lang = "es-PE";
    rec.interimResults = false;
    rec.onresult = (e) => {
      const t = Array.from(e.results).map((r) => r[0].transcript).join(" ");
      setDraft((d) => `${d} ${t}`.trim());
    };
    rec.onend = () => setDictating(false);
    recRef.current = rec;
    setDictating(true);
    rec.start();
  }

  const lastAsstIdx = messages.map((m) => m.who).lastIndexOf("asistente");

  return (
    <div className="chat-layout">
      <section className="chat-col" aria-label="Conversación">
        <div className="spread">
          <h1>Chat con Fixazo</h1>
          <button type="button" className="chip" onClick={() => setEntiendo((v) => !v)} aria-expanded={entiendo}>
            <Icon name="book" /> Entiendo
          </button>
        </div>

        <div className="thread" aria-live="polite">
          {!consent && (
            <p className="notice">
              Antes de la primera sesión, revisa los permisos. <Link href="/consentimiento">Ir al consentimiento</Link>
            </p>
          )}
          {paused && (
            <div className="card warn tight spread">
              <span>Tienes una misión en pausa. Puedes retomarla dentro de 24 horas.</span>
              <Link className="btn" href="/sesion">
                Retomar
              </Link>
            </div>
          )}
          {reminder && <p className="small muted">Recordatorio guardado: {new Date(reminder).toLocaleString("es-PE", { hour: "numeric", minute: "2-digit", day: "numeric", month: "short" })}</p>}
          {messages.map((m, i) => (
            <div key={m.id} className={`bubble ${m.who === "asistente" ? "asst" : "fam"}`}>
              <span className="who">{m.who === "asistente" ? "Fixazo" : "Tú"}</span>
              <p style={{ whiteSpace: "pre-line" }}>{m.text}</p>
              {m.chips && i === lastAsstIdx && (
                <div className="chips" style={{ marginTop: 6 }}>
                  {m.chips.slice(0, 3).map((c) => (
                    <button key={c} type="button" className="chip" onClick={() => onChip(c, m)}>
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
          {busy && (
            <div className="bubble asst" role="status">
              <span className="who">Fixazo</span>
              <span className="row" style={{ gap: 10 }}>
                {busy}
                <span className="typing" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
              </span>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <div className="composer-box">
            <label htmlFor="composer" className="sr-only">
              Mensaje
            </label>
            <textarea
              id="composer"
              ref={draftRef}
              rows={2}
              value={draft}
              placeholder="Escribe o pega aquí el texto de la lectura…"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <button type="button" className={`btn ${dictating ? "danger" : "subtle"}`} aria-label={dictating ? "Detener dictado" : "Dictar por voz"} onClick={toggleDictation} aria-pressed={dictating}>
              <Icon name="mic" />
            </button>
            <button type="submit" className="btn" disabled={!draft.trim() || !!busy}>
              Enviar
            </button>
          </div>
          <div className="chips">
            <button
              type="button"
              className="chip"
              disabled={!llm || !!busy}
              title={llm ? "Subir una foto de la tarea" : "Para leer fotos se necesita ANTHROPIC_API_KEY"}
              onClick={() => fileRef.current?.click()}
            >
              <Icon name="photo" /> Foto {llm ? "" : "(requiere clave de IA)"}
            </button>
            <button type="button" className="chip" disabled title="Próximamente">
              PDF (próximamente)
            </button>
            <button type="button" className="chip" disabled={!!busy} onClick={() => onChip(CHIP_SAMPLE_ES, messages[0])}>
              Ejemplo en castellano
            </button>
            <button type="button" className="chip" disabled={!!busy} onClick={() => onChip(CHIP_SAMPLE_QU, messages[0])}>
              Ejemplo en quechua
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              aria-label="Subir foto de la tarea"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void onPhoto(f);
              }}
            />
          </div>
        </form>
      </section>

      <aside className={`entiendo-panel card stack${entiendo ? " open" : ""}`} aria-label="Traer de Entiendo">
        <h2>Traer de Entiendo</h2>
        <p className="small muted">Usa un material de tu espacio en Entiendo para armar la misión. La integración todavía no está conectada.</p>
        {[
          { type: "Super Podcast", title: "El ciclo del agua", use: "Escuchar y explicar" },
          { type: "Debate", title: "¿Ir solo o acompañado?", use: "Fuente del dato nuevo" },
          { type: "Examen con retroalimentación", title: "Comprensión: Rosa y el puquio", use: "Preguntas orales" },
        ].map((c) => (
          <div key={c.title} className="entiendo-card">
            <span className="tag blue">{c.type}</span>
            <strong>{c.title}</strong>
            <span className="small muted">Uso sugerido: {c.use}</span>
          </div>
        ))}
        <button type="button" className="btn ghost" disabled>
          Conectar Entiendo
        </button>
        <p className="small muted">Mientras tanto, pega el texto o sube el mismo material como foto.</p>
      </aside>

      {sheet && <MissionSheet mission={sheet} onClose={() => setSheet(null)} />}
    </div>
  );
}
