"use client";
// Nueva / En curso / Hecha según el progreso guardado en este navegador.
import { useSyncExternalStore } from "react";
import { leerResultados, suscribirProgreso } from "@/lib/periodico/progreso";

type Estado = "nueva" | "en-curso" | "hecha";
const TEXTO: Record<Estado, string> = { nueva: "Nueva", "en-curso": "En curso", hecha: "Hecha ✓" };

export default function EstadoNoticia({ id }: { id: string }) {
  const estado = useSyncExternalStore<Estado>(
    suscribirProgreso,
    () => {
      const r = leerResultados()[id];
      return !r ? "nueva" : r.enCurso ? "en-curso" : "hecha";
    },
    () => "nueva",
  );
  return <span className={`pd-chip ${estado === "hecha" ? "hecha" : "nueva"}`}>{TEXTO[estado]}</span>;
}
