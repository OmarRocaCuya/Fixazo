"use client";
// Cuenta el interés en Plus sin pedir datos: un clic por navegador, registrado en los logs del servidor.
import { useState, useSyncExternalStore } from "react";

const CLAVE = "fixazo:plus-interes";
const ya = () => {
  try {
    return localStorage.getItem(CLAVE) === "1";
  } catch {
    return false;
  }
};

export default function MeInteresa() {
  const marcado = useSyncExternalStore(() => () => undefined, ya, () => false);
  const [enviado, setEnviado] = useState(false);

  async function marcar() {
    setEnviado(true);
    try {
      localStorage.setItem(CLAVE, "1");
    } catch {
      /* sin almacenamiento igual se cuenta */
    }
    await fetch("/api/plus/interes", { method: "POST" }).catch(() => undefined);
  }

  const listo = enviado || marcado;
  return (
    <div className="pd-plus-cta">
      <button type="button" className="btn primary" disabled={listo} onClick={() => void marcar()}>
        {listo ? "¡Gracias! Lo tomamos en cuenta" : "Me interesa"}
      </button>
      <p className="muted small">No pedimos ni guardamos datos personales: solo contamos cuántas familias quieren Plus.</p>
    </div>
  );
}
