"use client";
// Racha de lectura en la portada y en Mis insights. Se calcula de fixazo:resultados, sin guardar nada nuevo.
import { useMemo, useSyncExternalStore } from "react";
import { suscribirProgreso, type ResultadoNoticia } from "@/lib/periodico/progreso";
import { calcularRacha, textoRacha, type Racha } from "@/lib/periodico/racha";

function crudo(): string {
  try {
    return localStorage.getItem("fixazo:resultados") ?? "";
  } catch {
    return "";
  }
}

export function fechasTerminadas(raw: string): string[] {
  try {
    return Object.values(JSON.parse(raw || "{}") as Record<string, ResultadoNoticia>).filter((r) => !r.enCurso).map((r) => r.fecha);
  } catch {
    return [];
  }
}

/** null en el servidor: la racha vive en el navegador. */
export function useRacha(): Racha | null {
  const raw = useSyncExternalStore(suscribirProgreso, crudo, () => null);
  return useMemo(() => (raw === null ? null : calcularRacha(fechasTerminadas(raw))), [raw]);
}

const plural = (n: number) => `${n} ${n === 1 ? "día" : "días"}`;

export function RachaChip() {
  const r = useRacha();
  if (!r || (r.estado === "ninguna" && r.mejor === 0)) return null;
  const extra = r.estado === "pausa" ? " · en pausa" : r.estado === "recuperar" ? ` · lee ${r.faltanHoy === 2 ? "2" : "1 más"} hoy` : "";
  const gris = r.estado === "pausa" || r.estado === "recuperar" || r.estado === "ninguna";
  return (
    <span className={`pd-racha${gris ? " gris" : ""}`} title={textoRacha(r)} aria-label={`Racha: ${r.estado === "ninguna" ? "sin racha" : plural(r.dias)}. ${textoRacha(r)}`}>
      🔥 {r.estado === "ninguna" ? "Empieza otra racha" : `${plural(r.dias)}${extra}`}
    </span>
  );
}

export function RachaSemana() {
  const r = useRacha();
  if (!r) return null;
  return (
    <section className="pd-card">
      <h2>Tu racha</h2>
      <p className="pd-racha-num">🔥 {plural(r.dias)}</p>
      <p className="muted">{textoRacha(r)}.</p>
      <div className="pd-semana" role="img" aria-label={`Esta semana leíste ${r.semana.filter((d) => d.leyo).length} de 7 días`}>
        {r.semana.map((d, k) => (
          <span key={k} className={d.leyo ? "leyo" : d.gracia ? "gracia" : d.futuro ? "futuro" : ""} title={d.gracia ? "Día libre" : undefined}>{d.dia}</span>
        ))}
      </div>
      <p className="muted small">Cuenta los días en que terminas al menos una noticia. Tienes un día libre por semana{r.mejor > r.dias ? `. Tu mejor racha: ${plural(r.mejor)}` : ""}.</p>
    </section>
  );
}
