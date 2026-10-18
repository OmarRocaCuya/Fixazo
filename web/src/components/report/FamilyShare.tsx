"use client";
import { useState } from "react";
import { copyFamilySummary, familyWhatsappHref, shareFamilySummary, type FamilySummary } from "@/lib/report/family-share";

export function FamilyShare({ summary }: { summary: FamilySummary }) {
  const [message, setMessage] = useState("");

  async function share() {
    const result = await shareFamilySummary(summary, {
      share: typeof navigator !== "undefined" && navigator.share ? (data) => navigator.share(data) : undefined,
    });
    setMessage({
      opened: "Se cerró el panel de compartir. La app no puede confirmar la entrega al familiar.",
      cancelled: "Compartir cancelado. No se confirma ningún envío desde la app.",
      unavailable: "Este navegador no ofrece compartir. Puedes copiar, descargar o abrir WhatsApp.",
      failed: "No se pudo abrir compartir. Puedes copiar, descargar o abrir WhatsApp.",
    }[result]);
  }

  async function copy() {
    const result = await copyFamilySummary(summary, typeof navigator !== "undefined" && navigator.clipboard?.writeText ? (text) => navigator.clipboard.writeText(text) : undefined);
    setMessage(result === "copied" ? "Resumen copiado. Tú decides dónde pegarlo y enviarlo." : "No se pudo copiar. Puedes seleccionar la vista previa o descargar el resumen.");
  }

  function download() {
    try {
      const url = URL.createObjectURL(new Blob([summary.text], { type: "text/plain;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url; link.download = summary.filename; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage("Se solicitó la descarga del resumen. No se envió a un familiar.");
    } catch { setMessage("No se pudo descargar. Puedes seleccionar el texto de la vista previa."); }
  }

  return <section className="card stack" aria-label="Compartir resumen con un familiar">
    <h2>Compartir con un familiar</h2>
    <p className="small">Opcional. Revisa este resumen antes de compartirlo. No incluye nombre, respuestas textuales, audio, emociones ni opiniones personales. No guardamos el contacto del familiar ni enviamos nada automáticamente.</p>
    <div className="stack-sm">
      <h3>Vista previa del resumen</h3>
      <pre className="small" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontFamily: "inherit", margin: 0 }}>{summary.text}</pre>
    </div>
    <div className="row" style={{ flexWrap: "wrap" }}>
      <button type="button" className="btn primary" onClick={() => void share()}>Elegir cómo compartir</button>
      <button type="button" className="btn ghost" onClick={() => void copy()}>Copiar resumen</button>
      <button type="button" className="btn ghost" onClick={download}>Descargar resumen</button>
      <a className="btn ghost" href={familyWhatsappHref(summary)} target="_blank" rel="noopener noreferrer" onClick={() => setMessage("WhatsApp se abrirá con este resumen. Elige destinatario y confirma el envío allí; la app no comprueba la entrega.")}>Abrir WhatsApp y elegir familiar</a>
    </div>
    <p className="small muted">Al abrir WhatsApp o elegir otra aplicación, el resumen pasa a ese servicio. Puedes cancelar antes de enviarlo.</p>
    <p className="small" role="status" aria-live="polite">{message}</p>
  </section>;
}

