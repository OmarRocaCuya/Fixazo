import type { Report } from "@/lib/types";

export interface FamilySummary {
  title: string;
  text: string;
  filename: string;
}

const labels = { obtiene: "Qué dice el texto", infiere: "Razones e inferencias", reflexiona: "Opinión con evidencia" } as const;

/** Allowlist projection: never stringify a report or attach its private evidence. */
export function buildVoiceFamilySummary(report: Report): FamilySummary {
  const lines = Object.entries(labels).map(([key, label]) => {
    const result = report.levels[key as keyof typeof labels];
    const value = result.status === "no_observable" || result.level === "NO" ? "No observable (no es un 0)" : `${result.level}/3`;
    return `- ${label}: ${value}`;
  });
  return {
    title: "Resumen de lectura · Fixazo",
    filename: "nawinchay-resumen-lectura.txt",
    text: [
      "Fixazo · Resumen de lectura",
      report.review?.status === "revisado" ? "Evidencia revisada por una persona." : "Informe provisional: pendiente de revisión humana.",
      ...lines,
      "Los resultados corresponden a esta actividad; no son un diagnóstico ni una medida de emociones.",
      "Para acompañar: vuelvan al texto y busquen una razón que apoye la respuesta.",
      "Resumen sin nombre, transcripciones ni audio.",
    ].join("\n"),
  };
}

export type NativeShareResult = "opened" | "cancelled" | "unavailable" | "failed";
export interface NativeSharePort { share?: (data: { title: string; text: string }) => Promise<void> }

/** Calling this is an explicit user action; there is no request on mount. */
export async function shareFamilySummary(summary: FamilySummary, port: NativeSharePort): Promise<NativeShareResult> {
  if (!port.share) return "unavailable";
  try {
    await port.share({ title: summary.title, text: summary.text });
    return "opened"; // Never means that a recipient received it.
  } catch (error) {
    return error && typeof error === "object" && "name" in error && error.name === "AbortError" ? "cancelled" : "failed";
  }
}

export async function copyFamilySummary(summary: FamilySummary, writeText?: (text: string) => Promise<void>): Promise<"copied" | "unavailable" | "failed"> {
  if (!writeText) return "unavailable";
  try { await writeText(summary.text); return "copied"; } catch { return "failed"; }
}

/** No recipient/phone is collected; WhatsApp still requires choosing and sending. */
export function familyWhatsappHref(summary: FamilySummary): string {
  return `https://wa.me/?text=${encodeURIComponent(summary.text)}`;
}

export function completedReportHref(phase: string, reportId: string | null | undefined): string | null {
  return phase === "finished" && reportId ? `/informe?id=${encodeURIComponent(reportId)}` : null;
}

