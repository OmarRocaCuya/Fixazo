"use client";
// Nueva / Hecha según el progreso guardado en este navegador.
import { useSyncExternalStore } from "react";
import { leerResultados } from "@/lib/periodico/progreso";

export default function EstadoNoticia({ id }: { id: string }) {
  const hecha = useSyncExternalStore(() => () => undefined, () => Boolean(leerResultados()[id]), () => false);
  return <span className={`pd-chip ${hecha ? "hecha" : "nueva"}`}>{hecha ? "Hecha ✓" : "Nueva"}</span>;
}
