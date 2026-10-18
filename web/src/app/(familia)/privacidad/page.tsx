"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Permissions } from "@/lib/types";
import { notifyStore, useStore } from "@/lib/useStore";
import { getStore } from "@/lib/storage";
import { deletePeriodicoData, exportPeriodicoData } from "@/lib/periodico/privacidad";
import { PermissionRows } from "@/components/PermissionRows";
import { NOT_MEASURED } from "@/lib/guardrails";

export default function PrivacyPage() {
  const store = useStore();
  if (!store) return <div className="skeleton" style={{ height: 420 }} />;
  return <Privacy initial={store.loadConsent()?.permissions ?? { voice: true, process: true, mood: true }} alias={store.loadProfile()?.alias ?? "tu hijo"} />;
}

const REVOKE_NOTE: Record<keyof Permissions, string> = {
  voice: "Desde la siguiente sesión no se usará el micrófono: la sesión se hará escribiendo.",
  process: "Desde la siguiente sesión no se calcularán pausas, tiempos ni palabras de duda. Los informes nuevos no las tendrán.",
  mood: "Desde la siguiente sesión no se mostrarán las caritas.",
};

function Privacy({ initial, alias }: { initial: Permissions; alias: string }) {
  const router = useRouter();
  const [perms, setPerms] = useState(initial);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  function change(p: Permissions) {
    const s = getStore();
    const prev = s.loadConsent();
    s.saveConsent({ version: prev?.version ?? "1.0", acceptedAt: prev?.acceptedAt ?? new Date().toISOString(), permissions: p });
    const revoked = (Object.keys(p) as Array<keyof Permissions>).find((k) => perms[k] && !p[k]);
    setPerms(p);
    setMsg(revoked ? REVOKE_NOTE[revoked] : "Permiso activado. Aplica desde la siguiente sesión.");
    notifyStore();
  }

  function download() {
    const periodico = exportPeriodicoData();
    const exported = JSON.stringify({ ...JSON.parse(getStore().exportAll()), periodico }, null, 2);
    const blob = new Blob([exported], { type: "application/json" });
    if (!periodico.complete) setMsg("La exportación incluye los datos accesibles. No se pudo leer todo el almacenamiento del periódico; el archivo lo indica.");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nawinchay-datos-${new Date().toISOString().slice(0, 10)}.json`;
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
    router.push("/consentimiento");
  }

  return (
    <div className="page" style={{ maxWidth: 760 }}>
      <div className="stack-sm">
        <span className="eyebrow">Privacidad</span>
        <h1>Tus datos y los de {alias}</h1>
        <p className="muted">El perfil, los informes y el avance del periódico se guardan en este dispositivo, sin cuentas. La transcripción por voz y la IA opcional pueden usar servicios externos.</p>
      </div>

      <section className="card stack">
        <h2>Permisos</h2>
        <PermissionRows value={perms} onChange={change} />
        {msg && (
          <p className="notice info" role="status">
            {msg}
          </p>
        )}
      </section>

      <section className="card stack-sm">
        <h2>Cómo cuidamos el audio</h2>
        <p className="small">Las señales acústicas se calculan en el navegador. La app no almacena grabaciones de audio.</p>
        <p className="small">
          El reconocimiento del navegador puede enviar audio a su proveedor. Whisper local descarga archivos del modelo al prepararlo, pero procesa la voz en este dispositivo. Si prefieres evitar ambos, escribe la transcripción.
          Si se configura el juez de IA, las respuestas escritas se envían al proveedor de IA; sin clave se usan reglas.
        </p>
        <p className="small">Deepgram y la demo de voz conversacional envían audio al proveedor elegido solo tras autorización específica y código de acceso. El permiso general de voz no los activa. El código y los tokens permanecen en memoria, fuera de los informes y exportaciones. La retención externa depende del acuerdo y la configuración del responsable del despliegue.</p>
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
        <div className="row">
          <button type="button" className="btn ghost" onClick={download}>
            Descargar datos
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
            <p className="small">Se borran el perfil, el consentimiento, las misiones, los informes, el chat y los datos del periódico (resultados, avance e identificador local antiguo) de este dispositivo. No se borran datos de otras aplicaciones. No se puede deshacer.</p>
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
