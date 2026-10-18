"use client";
// Demo en vivo del pipeline: un clic, una noticia nueva, viendo cada paso mientras pasa.
import Link from "next/link";
import { useEffect, useState } from "react";
import type { NoticiaPublica } from "@/lib/periodico/tipos";

const PASOS = [
  ["buscar", "Buscar en 19 medios confiables"],
  ["filtrar", "Filtrar: apta para jóvenes, en español, no opinión"],
  ["elegir", "Elegir la noticia"],
  ["pareja", "Buscar el mismo hecho en otro medio"],
  ["extraer", "Extraer el texto"],
  ["generar", "Elegir fragmentos y escribir 8 preguntas"],
  ["validar", "Validar citas y cifras con código"],
] as const;

type Evento = { paso: string; texto?: string; noticia?: NoticiaPublica | null; guardada?: boolean; fuentes?: Array<{ medio: string; url: string }> };

export default function Generar() {
  const [habilitado, setHabilitado] = useState<boolean | null>(null);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [corriendo, setCorriendo] = useState(false);
  const [segundos, setSegundos] = useState(0);

  useEffect(() => {
    fetch("/api/periodico/generar", { cache: "no-store" }).then((r) => r.json()).then((d) => setHabilitado(d.enabled === true)).catch(() => setHabilitado(false));
  }, []);
  useEffect(() => {
    if (!corriendo) return;
    const t0 = Date.now();
    const id = setInterval(() => setSegundos(Math.round((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(id);
  }, [corriendo]);

  async function generar() {
    setEventos([]); setSegundos(0); setCorriendo(true);
    try {
      const r = await fetch("/api/periodico/generar", { method: "POST" });
      if (!r.ok || !r.body) {
        const d = await r.json().catch(() => ({}));
        setEventos([{ paso: "error", texto: d.texto ?? "No se pudo empezar. Prueba de nuevo." }]);
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
        for (const l of lineas) if (l.trim()) setEventos((e) => [...e, JSON.parse(l) as Evento]);
      }
    } catch {
      setEventos((e) => [...e, { paso: "error", texto: "Se cortó la conexión. Prueba de nuevo." }]);
    } finally {
      setCorriendo(false);
    }
  }

  const ultimoDe = (paso: string) => [...eventos].reverse().find((e) => e.paso === paso);
  const fin = ultimoDe("fin");
  const error = ultimoDe("error") ?? ultimoDe("nada");
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
        <p className="muted">El sistema busca una noticia de hoy, la compara con otro medio y escribe las preguntas. Tarda entre 15 segundos y un par de minutos.</p>
      </header>

      {habilitado === false && <p className="pd-aviso">La búsqueda en vivo no está activada en este servidor.</p>}
      <button type="button" className="btn primary" disabled={!habilitado || corriendo} onClick={() => void generar()}>
        {corriendo ? `Buscando… ${segundos} s` : "Buscar una noticia nueva"}
      </button>

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

      {error && !fin?.noticia && <p className="pd-retro" role="status">{error.texto}</p>}

      {fin?.noticia && (
        <section className="pd-card pd-principal" aria-live="polite">
          <div className="eyebrow">{fin.noticia.seccion} · recién generada · {ultimoDe("listo")?.texto}</div>
          <h2>{fin.noticia.titular}</h2>
          <p className="pd-bajada">{fin.noticia.bajada}</p>
          <p className="muted small">{(fin.fuentes ?? []).map((f) => f.medio).filter((m, k, a) => a.indexOf(m) === k).join(" y ")}</p>
          <ol className="pasos-lista">
            {fin.noticia.pasos.filter((p) => p.tipo !== "fragmento").map((p, k) => <li key={k}>{p.titulo}</li>)}
          </ol>
          {fin.guardada
            ? <Link className="btn primary" href={`/noticia/${fin.noticia.id}`}>Leer y responder</Link>
            : <p className="muted small">Vista previa: en este servidor la noticia no se guarda. Las de la portada se pueden leer y responder completas.</p>}
        </section>
      )}
    </div>
  );
}
