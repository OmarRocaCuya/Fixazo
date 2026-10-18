"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Grade, Lang, Permissions, Profile } from "@/lib/types";
import { notifyStore, useStore } from "@/lib/useStore";
import { getStore } from "@/lib/storage";
import { PermissionRows } from "@/components/PermissionRows";

const CONSENT_VERSION = "1.0";

export default function ConsentPage() {
  const store = useStore();
  if (!store) return <div className="skeleton" style={{ maxWidth: 760, margin: "0 auto", height: 480 }} />;
  return <ConsentForm initialProfile={store.loadProfile()} initialPerms={store.loadConsent()?.permissions ?? null} />;
}

const GRADES: Grade[] = [3, 4, 5, 6];
const LANGS: Array<{ v: Lang; label: string }> = [
  { v: "es", label: "Castellano" },
  { v: "qu", label: "Quechua" },
];

function ConsentForm({ initialProfile, initialPerms }: { initialProfile: Profile | null; initialPerms: Permissions | null }) {
  const router = useRouter();
  const [alias, setAlias] = useState(initialProfile?.alias ?? "");
  const [grade, setGrade] = useState<Grade>(initialProfile?.grade ?? 4);
  const [homeLang, setHomeLang] = useState<Lang>(initialProfile?.homeLang ?? "qu");
  const [readingLang, setReadingLang] = useState<Lang>(initialProfile?.readingLang ?? "es");
  const [perms, setPerms] = useState<Permissions>(initialPerms ?? { voice: true, process: true, mood: true });
  const cleanAlias = alias.trim().split(/\s+/)[0] ?? "";
  const ready = cleanAlias.length >= 2;

  function accept() {
    if (!ready) return;
    const s = getStore();
    s.saveProfile({ alias: cleanAlias, grade, homeLang, readingLang });
    s.saveConsent({ version: CONSENT_VERSION, acceptedAt: new Date().toISOString(), permissions: perms });
    notifyStore();
    router.push("/chat");
  }

  return (
    <div className="card consent stack" style={{ gap: 24 }}>
      <div className="stack-sm">
        <span className="eyebrow">Paso 1 de 2 · Familia</span>
        <h1>Antes de empezar con {cleanAlias || "tu hijo"}</h1>
        <p className="muted">
          Tú decides qué se escucha durante la sesión. La app no guarda grabaciones. La transcripción del navegador puede procesar la voz en servidores externos.
        </p>
      </div>

      <div className="stack">
        <div className="field">
          <label htmlFor="alias">Alias del niño o niña</label>
          <input
            id="alias"
            className="input"
            value={alias}
            maxLength={24}
            autoComplete="off"
            placeholder="Por ejemplo: Yeni"
            onChange={(e) => setAlias(e.target.value)}
            aria-describedby="alias-help"
          />
          <span id="alias-help" className="small muted">
            Solo un nombre o apodo. No pedimos apellidos, foto, DNI ni fecha de nacimiento.
          </span>
        </div>
        <div className="field">
          <span className="label" id="grade-l">Grado</span>
          <div className="chips" role="group" aria-labelledby="grade-l">
            {GRADES.map((g) => (
              <button key={g} type="button" className="chip" aria-pressed={grade === g} onClick={() => setGrade(g)}>
                {g}.º
              </button>
            ))}
          </div>
        </div>
        <div className="row" style={{ alignItems: "start", gap: 24 }}>
          <div className="field">
            <span className="label" id="home-l">Lengua de casa</span>
            <div className="chips" role="group" aria-labelledby="home-l">
              {LANGS.map((l) => (
                <button key={l.v} type="button" className="chip" aria-pressed={homeLang === l.v} onClick={() => setHomeLang(l.v)}>
                  {l.label}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <span className="label" id="read-l">Lengua de lectura</span>
            <div className="chips" role="group" aria-labelledby="read-l">
              {LANGS.map((l) => (
                <button key={l.v} type="button" className="chip" aria-pressed={readingLang === l.v} onClick={() => setReadingLang(l.v)}>
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="stack-sm">
        <h2>Permisos</h2>
        <PermissionRows value={perms} onChange={setPerms} />
      </div>

      <div className="row actions">
        <button type="button" className="btn" disabled={!ready} onClick={accept}>
          {perms.voice ? "Aceptar y continuar" : "Guardar sin sesiones de voz"}
        </button>
        <details>
          <summary className="btn ghost" style={{ listStyle: "none" }}>
            Leer cómo cuidamos los datos
          </summary>
          <div className="card tight stack-sm" style={{ marginTop: 12 }}>
            <p className="small">• Las señales acústicas se calculan en el navegador. La app no graba ni almacena el audio.</p>
            <p className="small">
              • Para transcribir en castellano usamos el reconocimiento de voz del navegador, que puede enviar audio a su proveedor. Si prefieres
              no usar ese servicio, desactiva la voz y transcribe manualmente lo que dice el niño.
            </p>
            <p className="small">• Perfil, misiones e informes se guardan solo en este dispositivo. Puedes borrarlos en Privacidad.</p>
            <p className="small">• No detectamos emociones, no guardamos huellas de voz, no juzgamos el acento y no medimos la salud.</p>
          </div>
        </details>
      </div>
      {!ready && <p className="small muted">Escribe un alias para continuar.</p>}
    </div>
  );
}
