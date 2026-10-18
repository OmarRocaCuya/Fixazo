"use client";
import { TranslatedText } from "@/components/i18n/LanguageProvider";

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
const Days = ({ n }: { n: number }) => <>{n} <TranslatedText text={n === 1 ? "día" : "días"} /></>;
function StreakMessage({ r }: { r: Racha }) {
  if (r.estado === "seguir") return <><TranslatedText text="Lee una noticia hoy para llegar a" /> {r.dias + 1}</>;
  return <TranslatedText text={textoRacha(r)} />;
}

export function RachaChip() {
  const r = useRacha();
  if (!r || (r.estado === "ninguna" && r.mejor === 0)) return null;
  const gris = r.estado === "pausa" || r.estado === "recuperar" || r.estado === "ninguna";
  return (
    <span className={`pd-racha${gris ? " gris" : ""}`} title={textoRacha(r)} aria-label={`Racha: ${r.estado === "ninguna" ? "sin racha" : plural(r.dias)}. ${textoRacha(r)}`}>
      🔥 {r.estado === "ninguna" ? <TranslatedText text="Empieza otra racha" /> : <><Days n={r.dias} />{r.estado === "pausa" ? <> · <TranslatedText text="en pausa" /></> : r.estado === "recuperar" ? <> · <TranslatedText text="lee" /> {r.faltanHoy === 2 ? "2" : <TranslatedText text="1 más" />} <TranslatedText text="hoy" /></> : null}</>}
    </span>
  );
}

export function RachaSemana() {
  const r = useRacha();
  if (!r) return null;
  return (
    <section className="pd-card">
      <h2><TranslatedText text="Tu racha" /></h2>
      <p className="pd-racha-num">🔥 <Days n={r.dias} /></p>
      <p className="muted"><StreakMessage r={r} />.</p>
      <div className="pd-semana" role="img" aria-label={`Esta semana leíste ${r.semana.filter((d) => d.leyo).length} de 7 días`}>
        {r.semana.map((d, k) => (
          <span key={k} className={d.leyo ? "leyo" : d.gracia ? "gracia" : d.futuro ? "futuro" : ""} title={d.gracia ? "Día libre" : undefined}>{d.dia}</span>
        ))}
      </div>
      <p className="muted small"><TranslatedText text="Cuenta los días en que terminas al menos una noticia. Tienes un día libre por semana" />{r.mejor > r.dias ? <>. <TranslatedText text="Tu mejor racha:" /> <Days n={r.mejor} /></> : null}.</p>
    </section>
  );
}
