"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { EnrichedDocument } from "@reader-enricher/types";
import type { Fragmento, NoticiaPublica } from "@/lib/periodico/tipos";
import LecturaInteractiva from "./LecturaInteractiva";
import { safeSourceUrl } from "./lectura-model";
import styles from "./lectura-interactiva.module.css";

const NoticiaFlow = dynamic(() => import("./NoticiaFlow"), { loading: () => <p role="status">Cargando comprensión…</p>, ssr: false });

export function TextoOriginal({ noticia }: { noticia: NoticiaPublica }) {
  const fragments = noticia.pasos.filter((step): step is Fragmento => step.tipo === "fragmento");
  return <div className={styles.original}>
    <p className={styles.note}>Fragmentos originales, sin anotaciones ni reorganización. Las preguntas están en Comprensión.</p>
    {fragments.map((fragment, index) => {
      const url = safeSourceUrl(fragment.url);
      return <section key={index} className={styles.sourceBlock} data-side={fragment.lado}>
        <div className={styles.source}>{fragment.medio} · {fragment.fecha}</div>
        <h2 className={styles.sourceTitle}>{fragment.titular}</h2>
        <blockquote className={styles.prose}>{fragment.texto}</blockquote>
        {url ? <a className={styles.sourceLink} href={url} target="_blank" rel="noopener noreferrer">Leer la nota en {fragment.medio} ↗</a> : <p className={styles.note}>Enlace de la fuente no disponible.</p>}
      </section>;
    })}
  </div>;
}

function Reader({ noticia, documento }: { noticia: NoticiaPublica; documento: EnrichedDocument | null }) {
  const [mode, setMode] = useState<"lectura" | "comprension">("lectura");
  const [original, setOriginal] = useState(false);
  return <article className={styles.reader}>
    {mode === "lectura" ? <header className={styles.header}>
      <p className={styles.eyebrow}>{noticia.seccion} <span>·</span> {noticia.minutos} min de lectura</p>
      <h1>{noticia.titular}</h1>
      <p className={styles.dek}>{noticia.bajada}</p>
    </header> : null}
    <nav className={styles.modeBar} aria-label="Modo de la noticia">
      <div className={styles.modeButtons}>
        <button type="button" aria-pressed={mode === "lectura"} onClick={() => setMode("lectura")}>Lectura</button>
        <button type="button" aria-pressed={mode === "comprension"} onClick={() => setMode("comprension")}>Comprensión</button>
      </div>
      {mode === "lectura" && documento ? <button className={styles.originalToggle} type="button" aria-pressed={original} onClick={() => setOriginal((value) => !value)}>{original ? "Volver a lectura enriquecida" : "Texto original"}</button> : null}
    </nav>
    {mode === "comprension" ? <section className={styles.comprehension} aria-label="Comprensión de la noticia"><p className={styles.note}>Las preguntas de comprensión siguen aquí. Tu avance se conserva al volver a la lectura.</p><NoticiaFlow noticia={noticia} /></section> : original || !documento ? <>
      {!documento ? <p className={styles.status} role="status">La lectura enriquecida no está disponible para esta noticia. Puedes leer todos los fragmentos originales y acceder a Comprensión.</p> : null}
      <TextoOriginal noticia={noticia} />
    </> : <LecturaInteractiva documento={documento} />}
  </article>;
}

export default function LecturaNoticia(props: { noticia: NoticiaPublica; documento: EnrichedDocument | null }) {
  // A new article resets transient UI and cancels any previous narration.
  return <Reader key={props.noticia.id} {...props} />;
}
