"use client";
import { TranslatedText } from "@/components/i18n/LanguageProvider";

// Noticias reservadas para la demo: las generó el mismo pipeline de antemano y aparecen en la portada
// cuando se aprieta "Buscar una noticia nueva" en /generar. Lo revelado se guarda en este navegador.
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";

export interface Reservada {
  id: string;
  seccion: string;
  titular: string;
  bajada: string;
  creada: string;
  minutos: number;
  medios: string[];
  miradas: Array<{ medio: string; texto: string | null }>;
}

const CLAVE = "fixazo:reveladas";
const EVENTO = "fixazo:reveladas";

function crudo(): string {
  try {
    return localStorage.getItem(CLAVE) ?? "[]";
  } catch {
    return "[]";
  }
}
export function leerReveladas(): string[] {
  try {
    return JSON.parse(crudo());
  } catch {
    return [];
  }
}
export function revelar(id: string) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify([...new Set([...leerReveladas(), id])]));
    dispatchEvent(new Event(EVENTO));
  } catch {
    /* sin almacenamiento: la noticia igual se puede abrir desde /generar */
  }
}
export function reiniciarReveladas() {
  try {
    localStorage.removeItem(CLAVE);
    dispatchEvent(new Event(EVENTO));
  } catch {
    /* nada que reiniciar */
  }
}
function suscribir(cb: () => void) {
  addEventListener("storage", cb);
  addEventListener(EVENTO, cb);
  return () => {
    removeEventListener("storage", cb);
    removeEventListener(EVENTO, cb);
  };
}
export const useReveladas = () => useSyncExternalStore(suscribir, crudo, () => "[]");

// Pasos del pipeline real, mostrados rápido en una barra mini.
const PASOS = ["Buscando en 19 medios confiables", "Filtrando: apta para jóvenes y no opinión", "Comparando con otro medio", "Extrayendo el texto", "Escribiendo 8 preguntas", "Validando citas y cifras"];
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function Reveladas({ reservadas }: { reservadas: Reservada[] }) {
  const raw = useReveladas();
  const [paso, setPaso] = useState<number | null>(null);
  const [recien, setRecien] = useState<string | null>(null);

  useEffect(() => {
    if (!recien) return;
    const reducir = matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(`n-${recien}`)?.scrollIntoView({ block: "center", behavior: reducir ? "auto" : "smooth" });
  }, [recien, raw]);
  let ids: string[] = [];
  try {
    ids = JSON.parse(raw);
  } catch {
    /* lista vacía */
  }
  // La última revelada, primero.
  const visibles = ids.map((id) => reservadas.find((r) => r.id === id)).filter((r): r is Reservada => Boolean(r)).reverse();
  const pendientes = reservadas.filter((r) => !ids.includes(r.id));

  async function buscar() {
    const sig = pendientes[0];
    if (!sig || paso !== null) return;
    for (let k = 0; k < PASOS.length; k++) {
      setPaso(k);
      await esperar(600);
    }
    revelar(sig.id);
    setPaso(null);
    setRecien(sig.id);
  }

  return (
    <section className="pd-reveladas" aria-label="Recién encontradas">
      {pendientes.length > 0 && (
        <div className="pd-buscar">
          <button type="button" className="btn primary" disabled={paso !== null} onClick={() => void buscar()}><TranslatedText text="Buscar una noticia nueva" /></button>
          {paso !== null && (
            <div className="pd-progreso" role="status" aria-live="polite">
              <div className="pd-progreso-pista"><div className="pd-progreso-barra" style={{ width: `${((paso + 1) / PASOS.length) * 100}%` }} /></div>
              <span><TranslatedText text={PASOS[paso]} />…</span>
            </div>
          )}
        </div>
      )}
      {visibles.map((n) => (
        <Link key={n.id} id={`n-${n.id}`} className="pd-card pd-principal pd-nueva" href={`/noticia/${n.id}`}>
          <div className="eyebrow"><TranslatedText text={n.seccion} /> <TranslatedText text="· recién encontrada" /></div>
          <h2><TranslatedText text={n.titular} /></h2>
          <p className="pd-bajada"><TranslatedText text={n.bajada} /></p>
          {n.miradas.length > 0 && (
            <div className="pd-miradas" aria-label="Cómo lo cuenta cada medio o voz">
              {n.miradas.map((x, k) => (
                <div key={k} className={`pd-mirada ${k ? "b" : "a"}`}>
                  <div className="pd-mirada-medio">{x.medio}</div>
                  {x.texto ? <div className="pd-mirada-cita">«<TranslatedText text={x.texto} />»</div> : <div className="pd-mirada-cita sin-cita"><TranslatedText text="Otra voz en la misma nota" /></div>}
                </div>
              ))}
            </div>
          )}
          <div className="pd-meta"><span className="pd-chip nueva"><TranslatedText text="Nueva" /></span><span>{n.minutos} <TranslatedText text="min" /></span></div>
          <span className="pd-leer"><TranslatedText text="Leer y responder" /></span>
        </Link>
      ))}
    </section>
  );
}
