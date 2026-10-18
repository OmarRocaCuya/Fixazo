"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { notifyStore, useStore } from "@/lib/useStore";
import { getStore } from "@/lib/storage";
import { deletePeriodicoData, exportPeriodicoData } from "@/lib/periodico/privacidad";
import { NOT_MEASURED } from "@/lib/guardrails";
import { EXPERIMENTAL_EMOTION_DESC, EXPERIMENTAL_EMOTION_TITLE } from "@/lib/experimental-emotion";

// Informational only: the MVP has no consent or permission gate. The browser
// asks for the microphone when audio is started. Export and deletion remain.
export default function PrivacyPage() {
  const store = useStore();
  if (!store) return <div className="skeleton" style={{ height: 420 }} />;
  return <Privacy alias={store.loadProfile()?.alias ?? "tu hijo"} />;
}

function Privacy({ alias }: { alias: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  function deleteEmotionEstimates() {
    const n = getStore().stripExperimentalAffect();
    notifyStore();
    setMsg(n ? `Se borraron las estimaciones experimentales guardadas de ${n} informe(s).` : "No había estimaciones experimentales guardadas.");
  }

  function download() {
    const periodico = exportPeriodicoData();
    const exported = JSON.stringify({ ...JSON.parse(getStore().exportAll()), periodico }, null, 2);
    const blob = new Blob([exported], { type: "application/json" });
    if (!periodico.complete) setMsg("La exportación incluye los datos accesibles. No se pudo leer todo el almacenamiento del periódico; el archivo lo indica.");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fixazo-datos-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function deleteAll() {
    getStore().deleteAllData();
    const periodico = deletePeriodicoData();
    notifyStore();
    if (!periodico.complete) {
      setMsg("Se intentaron borrar los datos de lectura y del periódico, pero el navegador bloqueó parte del almacenamiento del periódico. No podemos confirmar el borrado completo. Puedes reintentar o borrar los datos de este sitio desde tu navegador.");
      return;
    }
    router.push("/");
  }

  return (
    <div className="page" style={{ maxWidth: 760 }}>
      <div className="stack-sm">
        <span className="eyebrow">Privacidad</span>
        <h1>Tus datos y los de {alias}</h1>
        <p className="muted">El perfil, los informes y el avance del periódico se guardan en este dispositivo, sin cuentas. La transcripción por voz y la IA opcional pueden usar servicios externos.</p>
      </div>

      <section className="card stack-sm">
        <span className="row" style={{ gap: 8 }}>
          <h2>{EXPERIMENTAL_EMOTION_TITLE}</h2>
          <span className="tag maize">Experimental</span>
        </span>
        <p className="small">{EXPERIMENTAL_EMOTION_DESC}</p>
        <p className="small muted">En el periódico y en la lectura por voz, el navegador pide el micrófono solo cuando pulsas Iniciar audio; nunca se activa al abrir una noticia.</p>
      </section>

      <section className="card stack-sm">
        <h2>Cómo cuidamos el audio</h2>
        <p className="small">Las señales acústicas se calculan en el navegador. La app no almacena grabaciones de audio.</p>
        <p className="small">
          El reconocimiento del navegador puede enviar audio a su proveedor. Whisper local descarga archivos del modelo al prepararlo, pero procesa la voz en este dispositivo. Si prefieres evitar ambos, escribe la transcripción.
          Si se configura el juez de IA, las respuestas escritas se envían al proveedor de IA; sin clave se usan reglas.
        </p>
        <p className="small">Deepgram y la demo de voz conversacional envían audio al proveedor elegido solo con el código de acceso del despliegue. El código y los tokens permanecen en memoria, fuera de los informes y exportaciones. La retención externa depende del acuerdo y la configuración del responsable del despliegue.</p>
        <h3 style={{ marginTop: 8 }}>Lo que no medimos</h3>
        <ul className="stack-sm" style={{ margin: 0, paddingLeft: 20 }}>
          {NOT_MEASURED.map((n) => (
            <li key={n} className="small">
              {n}
            </li>
          ))}
        </ul>
      </section>

      <section className="card stack">
        <h2>Tus datos</h2>
        <p className="small">La descarga y el borrado incluyen los resultados, el avance y el identificador local antiguo del periódico, además de los datos de lectura.</p>
        {msg && (
          <p className="notice info" role="status">
            {msg}
          </p>
        )}
        <div className="row">
          <button type="button" className="btn ghost" onClick={download}>
            Descargar datos
          </button>
          <button type="button" className="btn ghost" onClick={deleteEmotionEstimates}>
            Borrar estimaciones experimentales
          </button>
          {!confirming && (
            <button type="button" className="btn danger" onClick={() => setConfirming(true)}>
              Borrar todos los datos de {alias}
            </button>
          )}
        </div>
        {confirming && (
          <div className="card no tight stack-sm" role="alertdialog" aria-labelledby="del-title">
            <strong id="del-title">¿Seguro?</strong>
            <p className="small">Se borran el perfil, las misiones, los informes, el chat y los datos del periódico (resultados, avance e identificador local antiguo) de este dispositivo. No se borran datos de otras aplicaciones. No se puede deshacer.</p>
            <div className="row">
              <button type="button" className="btn danger" onClick={deleteAll}>
                Sí, borrar todo
              </button>
              <button type="button" className="btn subtle" onClick={() => setConfirming(false)} autoFocus>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
