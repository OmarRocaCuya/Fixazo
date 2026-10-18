"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Permissions } from "@/lib/types";
import { notifyStore, useStore } from "@/lib/useStore";
import { getStore } from "@/lib/storage";
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
    const blob = new Blob([getStore().exportAll()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nawinchay-datos-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function deleteAll() {
    getStore().deleteAllData();
    notifyStore();
    router.push("/consentimiento");
  }

  return (
    <div className="page" style={{ maxWidth: 760 }}>
      <div className="stack-sm">
        <span className="eyebrow">Privacidad</span>
        <h1>Tus datos y los de {alias}</h1>
        <p className="muted">El perfil y los informes se guardan en este dispositivo, sin cuentas. La transcripción por voz y la IA opcional pueden usar servicios externos.</p>
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
        <p className="small">Las señales acústicas se calculan en el navegador. La app no graba ni almacena el audio.</p>
        <p className="small">
          El reconocimiento del navegador puede enviar audio a su proveedor. Si prefieres evitarlo, desactiva el permiso de voz y usa la transcripción manual.
          Si se configura el juez de IA, las respuestas escritas se envían al proveedor de IA; sin clave se usan reglas.
        </p>
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
            <p className="small">Se borran el perfil, el consentimiento, las misiones, los informes y el chat de este dispositivo. No se puede deshacer.</p>
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
