"use client";
// Botón "Buscar una noticia nueva". Modo rápido: revela la siguiente noticia reservada (generada de antemano por
// el mismo pipeline) mostrando sus pasos. Modo en vivo: corre el pipeline real en el servidor (1 a 2 minutos).
import Link from "next/link";
import { useEffect, useState } from "react";
import type { NoticiaPublica } from "@/lib/periodico/tipos";
import { leerReveladas, reiniciarReveladas, revelar, useReveladas, type Reservada } from "./Reveladas";

export interface ReservadaDemo extends Reservada {
  titularOriginal: string;
  preguntas: string[];
}

const PASOS = [
  ["buscar", "Buscar en 19 medios confiables"],
  ["filtrar", "Filtrar: apta para jóvenes, en español, no opinión"],
  ["elegir", "Elegir la noticia"],
  ["pareja", "Buscar el mismo hecho en otro medio"],
  ["extraer", "Extraer el texto"],
  ["generar", "Elegir fragmentos y escribir 8 preguntas"],
  ["validar", "Validar citas y cifras con código"],
] as const;

type Evento = { paso: string; texto?: string; noticia?: NoticiaPublica | null; guardada?: boolean; fuentes?: Array<{ medio: string }> };
interface Resultado { id: string; seccion: string; titular: string; bajada: string; medios: string[]; preguntas: string[]; jugable: boolean }

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

function pasosDe(r: ReservadaDemo): Evento[] {
  const [a, b] = r.medios;
  return [
    { paso: "buscar", texto: "Buscando noticias de IA de las últimas 24 horas en 19 medios confiables…" },
    { paso: "filtrar", texto: "Se descartan opinión, comunicados y temas no aptos para jóvenes" },
    { paso: "elegir", texto: `${a}: «${r.titularOriginal.slice(0, 90)}»` },
    { paso: "pareja", texto: b && b !== a ? `El mismo hecho en ${b}` : "Se usará otra voz dentro de la misma nota" },
    { paso: "extraer", texto: "Texto completo extraído" },
    { paso: "generar", texto: "Claude Haiku eligió fragmentos textuales y escribió 8 preguntas" },
    { paso: "validar", texto: "Citas literales y cifras comprobadas en el texto" },
  ];
}

export default function GenerarDemo({ reservadas }: { reservadas: ReservadaDemo[] }) {
  const reveladasRaw = useReveladas();
  const [enVivo, setEnVivo] = useState(false);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [corriendo, setCorriendo] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/periodico/generar", { cache: "no-store" }).then((r) => r.json()).then((d) => setEnVivo(d.enabled === true)).catch(() => setEnVivo(false));
  }, []);
  useEffect(() => {
    if (!corriendo) return;
    const t0 = Date.now();
    const id = setInterval(() => setSegundos(Math.round((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(id);
  }, [corriendo]);

  const quedan = reservadas.filter((r) => !reveladasRaw.includes(`"${r.id}"`));

  async function rapido() {
    const sig = reservadas.find((r) => !leerReveladas().includes(r.id));
    if (!sig) return;
    setEventos([]); setResultado(null); setError(""); setSegundos(0); setCorriendo(true);
    for (const e of pasosDe(sig)) {
      setEventos((xs) => [...xs, e]);
      await esperar(850);
    }
    revelar(sig.id);
    setResultado({ id: sig.id, seccion: sig.seccion, titular: sig.titular, bajada: sig.bajada, medios: sig.medios, preguntas: sig.preguntas, jugable: true });
    setCorriendo(false);
  }

  async function vivo() {
    setEventos([]); setResultado(null); setError(""); setSegundos(0); setCorriendo(true);
    try {
      const r = await fetch("/api/periodico/generar", { method: "POST" });
      if (!r.ok || !r.body) {
        const d = await r.json().catch(() => ({}));
        setError(d.texto ?? "No se pudo empezar. Prueba de nuevo.");
        return;
      }
      const lector = r.body.pipeThrough(new TextDecoderStream()).getReader();
      let resto = "";
      for (;;) {
        const { value, done } = await lector.read();
        if (done) break;
        resto += value;
        const lineas = resto.split("\n");
        resto = lineas.pop() ?? "";
        for (const l of lineas) {
          if (!l.trim()) continue;
          const e = JSON.parse(l) as Evento;
          setEventos((xs) => [...xs, e]);
          if (e.paso === "error" || e.paso === "nada") setError(e.texto ?? "No salió ninguna noticia.");
          if (e.paso === "fin" && e.noticia) {
            const n = e.noticia;
            setResultado({
              id: n.id, seccion: n.seccion, titular: n.titular, bajada: n.bajada,
              medios: [...new Set((e.fuentes ?? []).map((f) => f.medio))],
              preguntas: n.pasos.filter((p) => p.tipo !== "fragmento").map((p) => ("titulo" in p ? p.titulo : "")),
              jugable: e.guardada === true,
            });
          }
        }
      }
    } catch {
      setError("Se cortó la conexión. Prueba de nuevo.");
    } finally {
      setCorriendo(false);
    }
  }

  const ultimoDe = (paso: string) => [...eventos].reverse().find((e) => e.paso === paso);
  const actual = eventos.at(-1)?.paso;

  return (
    <div className="pd-wrap pd-angosto">
      <div className="pd-top">
        <Link className="pd-marca" href="/">Fixazo</Link>
        <Link className="pd-insights" href="/">Ir a la portada</Link>
      </div>
      <header className="pd-noticia-cabeza">
        <div className="eyebrow">Así se arma una noticia</div>
        <h1>Buscar una noticia nueva</h1>
        <p className="muted">El sistema busca una noticia de hoy, la compara con otro medio y escribe las preguntas.</p>
      </header>

      <div className="row">
        {quedan.length > 0 && (
          <button type="button" className="btn primary" disabled={corriendo} onClick={() => void rapido()}>
            {corriendo ? "Buscando…" : "Buscar una noticia nueva"}
          </button>
        )}
        {(quedan.length === 0 || resultado) && enVivo && (
          <button type="button" className="btn ghost" disabled={corriendo} onClick={() => void vivo()}>
            {corriendo ? `Buscando… ${segundos} s` : "Buscar en vivo (1 a 2 minutos)"}
          </button>
        )}
      </div>
      {quedan.length === 0 && !enVivo && !resultado && <p className="pd-aviso">Por ahora no hay noticias nuevas.</p>}

      {eventos.length > 0 && (
        <ol className="pd-pasos-vivo">
          {PASOS.map(([clave, nombre]) => {
            const e = ultimoDe(clave);
            const estado = e ? (actual === clave && corriendo ? "ahora" : "hecho") : "";
            return (
              <li key={clave} className={estado}>
                <b>{nombre}</b>
                {e?.texto && <span>{e.texto}</span>}
              </li>
            );
          })}
        </ol>
      )}

      {error && !resultado && <p className="pd-retro" role="status">{error}</p>}

      {resultado && (
        <section className="pd-card pd-principal pd-nueva" aria-live="polite">
          <div className="eyebrow">{resultado.seccion} · recién encontrada</div>
          <h2>{resultado.titular}</h2>
          <p className="pd-bajada">{resultado.bajada}</p>
          <p className="muted small">{resultado.medios.join(" y ")}</p>
          <ol className="pasos-lista">
            {resultado.preguntas.map((t, k) => <li key={k}>{t}</li>)}
          </ol>
          {resultado.jugable ? (
            <div className="row">
              <Link className="btn primary" href={`/noticia/${resultado.id}`}>Leer y responder</Link>
              <Link className="btn ghost" href="/">Verla en la portada</Link>
            </div>
          ) : (
            <p className="muted small">Vista previa: en este servidor la noticia en vivo no se guarda.</p>
          )}
        </section>
      )}

      <p className="pd-pie">
        <button type="button" className="btn ghost" onClick={() => { reiniciarReveladas(); setResultado(null); setEventos([]); }}>Reiniciar demo</button>
      </p>
    </div>
  );
}
