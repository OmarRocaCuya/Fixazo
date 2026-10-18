"use client";
import { TranslatedText, useLanguage } from "@/components/i18n/LanguageProvider";
import dynamic from "next/dynamic";
import { useEffect, useId, useMemo, useReducer, useRef, useState } from "react";
import type { Bloque, EnrichedDocument } from "@reader-enricher/types";
import type { Fragmento, NoticiaPublica } from "@/lib/periodico/tipos";
import LecturaInteractiva from "./LecturaInteractiva";
import type { RevisionVoz } from "./NoticiaFlow";
import { blockAnchor, safeSourceUrl } from "./lectura-model";
import { useLecturaVoz, type ActiveWord } from "./use-lectura-voz";
import styles from "./lectura-interactiva.module.css";

const NoticiaFlow = dynamic(() => import("./NoticiaFlow"), { loading: () => <p role="status"><TranslatedText text="Cargando comprensión…" /></p>, ssr: false });

/** Each support citation targets the one original article, never a second copy. */
function AnclasOriginales({ blocks }: { blocks: Bloque[] }) {
  return blocks.map((block) => <span key={block.id} id={blockAnchor(block.id)} tabIndex={-1} className={styles.originalAnchor} />);
}

function FragmentoOriginal({ fragment, blocks, activeWord }: { fragment: Fragmento; blocks: Bloque[]; activeWord: ActiveWord }) {
  if (activeWord) {
    let cursor = 0;
    for (const block of blocks.filter((item) => item.rol === "cuerpo")) {
      const offset = fragment.texto.indexOf(block.texto, cursor);
      if (offset < 0) continue;
      cursor = offset + block.texto.length;
      if (block.id !== activeWord.bloqueId) continue;
      const from = offset + activeWord.inicio;
      const to = offset + activeWord.fin;
      return <>{fragment.texto.slice(0, from)}<mark className={styles.currentWord}>{fragment.texto.slice(from, to)}</mark>{fragment.texto.slice(to)}</>;
    }
  }
  return <TranslatedText text={fragment.texto} />;
}

export function TextoOriginal({ noticia, documento, activeWord = null }: { noticia: NoticiaPublica; documento?: EnrichedDocument | null; activeWord?: ActiveWord }) {
  const fragments = noticia.pasos.filter((step): step is Fragmento => step.tipo === "fragmento");
  return <div className={styles.original}>
    {fragments.map((fragment, index) => {
      const url = safeSourceUrl(fragment.url);
      const blocks = documento?.bloques.filter((block) => block.fragmento === index) ?? [];
      return <section key={index} className={styles.sourceBlock} data-side={fragment.lado}>
        <AnclasOriginales blocks={blocks.filter((block) => block.rol === "titular")} />
        <div className={styles.source}>{fragment.medio} · {fragment.fecha}</div>
        <h2 className={styles.sourceTitle}><TranslatedText text={fragment.titular} /></h2>
        <AnclasOriginales blocks={blocks.filter((block) => block.rol === "cuerpo")} />
        <blockquote className={styles.prose}><FragmentoOriginal fragment={fragment} blocks={blocks} activeWord={activeWord} /></blockquote>
        {url ? <a className={styles.sourceLink} href={url} target="_blank" rel="noopener noreferrer"><TranslatedText text="Leer la nota en" />{" "}{fragment.medio} ↗</a> : <p className={styles.note}><TranslatedText text="Enlace de la fuente no disponible." /></p>}
      </section>;
    })}
  </div>;
}

export interface VistaLectura {
  apoyosAbiertos: boolean;
  metodologiaActiva: boolean;
}

export const vistaInicial: VistaLectura = { apoyosAbiertos: false, metodologiaActiva: true };

export function cambiarVista(vista: VistaLectura, accion: "abrir-apoyos" | "cerrar-apoyos" | "releer" | "retomar-metodologia"): VistaLectura {
  if (accion === "abrir-apoyos") return { ...vista, apoyosAbiertos: true };
  if (accion === "cerrar-apoyos") return vista.apoyosAbiertos ? { ...vista, apoyosAbiertos: false } : vista;
  if (accion === "releer") return { apoyosAbiertos: false, metodologiaActiva: false };
  return { ...vista, metodologiaActiva: true };
}

function Reader({ noticia, documento }: { noticia: NoticiaPublica; documento: EnrichedDocument | null }) {
  const { language } = useLanguage();
  const [vista, dispatch] = useReducer(cambiarVista, vistaInicial);
  // Kept only for this open article: rereading must not reset evaluated attempts.
  const [revisionVoz, setRevisionVoz] = useState<RevisionVoz | null>(null);
  const tituloLectura = useRef<HTMLHeadingElement>(null);
  const pestañaApoyos = useRef<HTMLButtonElement>(null);
  const tituloApoyos = useRef<HTMLHeadingElement>(null);
  const apoyosId = useId();
  const tituloApoyosId = useId();
  const metodologiaVisible = vista.metodologiaActiva && !vista.apoyosAbiertos;
  const body = useMemo(() => documento?.bloques.filter((block) => block.rol === "cuerpo") ?? [], [documento]);
  const voice = useLecturaVoz(body);
  const cerrarApoyos = () => {
    dispatch("cerrar-apoyos");
    pestañaApoyos.current?.focus({ preventScroll: true });
  };
  const consultarFuente = (blockId: string) => {
    dispatch("releer");
    const target = document.getElementById(blockAnchor(blockId));
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: "start", behavior: "instant" });
  };
  const volverAlTexto = () => {
    // Unmount the quiz before rereading; its cleanup stops capture and the judge.
    dispatch("releer");
    tituloLectura.current?.focus({ preventScroll: true });
    tituloLectura.current?.scrollIntoView({ block: "start", behavior: "instant" });
  };
  useEffect(() => {
    if (!vista.apoyosAbiertos) return;
    tituloApoyos.current?.focus({ preventScroll: true });
    tituloApoyos.current?.scrollIntoView({ block: "nearest", behavior: "instant" });
  }, [vista.apoyosAbiertos]);
  return <article className={styles.reader}>
    <header className={styles.header}>
      <p className={styles.articleMeta}><TranslatedText text={noticia.seccion} /> <span>·</span> {noticia.minutos} <TranslatedText text="min de lectura" /></p>
      <AnclasOriginales blocks={documento?.bloques.filter((block) => block.fragmento === null && block.rol === "titular") ?? []} />
      <h1 ref={tituloLectura} tabIndex={-1}><TranslatedText text={noticia.titular} /></h1>
      <AnclasOriginales blocks={documento?.bloques.filter((block) => block.fragmento === null && block.rol === "bajada") ?? []} />
      <p className={styles.dek}><TranslatedText text={noticia.bajada} /></p>
    </header>
    <div className={styles.originalAudio}>
      <button type="button" className={styles.listenButton} onClick={() => { if (voice.playing) voice.stop(); else { dispatch("releer"); voice.start(); } }} disabled={!voice.available || !body.length}><span aria-hidden="true">{voice.playing ? "■" : "▶"}</span><TranslatedText text={voice.playing ? "Detener lectura" : "Escuchar lectura"} /></button>
      <p className={styles.audioNotice} role="status"><TranslatedText text={voice.available ? voice.notice : "Voz no disponible en este navegador. Puedes leer todo el texto."} /></p>
    </div>
    <TextoOriginal noticia={noticia} documento={documento} activeWord={language === "es" ? voice.activeWord : null} />
    <div className={styles.insightsLauncher}>
      <button ref={pestañaApoyos} className={styles.insightsTab} type="button" aria-controls={apoyosId} aria-expanded={vista.apoyosAbiertos} onClick={() => { if (vista.apoyosAbiertos) cerrarApoyos(); else { if (voice.playing) voice.stop(); dispatch("abrir-apoyos"); } }}>
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v15M3 4l6 1a4 4 0 0 1 3 2 4 4 0 0 1 3-2l6-1v14l-6 1a4 4 0 0 0-3 2 4 4 0 0 0-3-2l-6-1z" /></svg>
        <TranslatedText text="Insights de esta lectura" />
      </button>
    </div>
    <section id={apoyosId} className={styles.insightsPanel} aria-labelledby={tituloApoyosId} hidden={!vista.apoyosAbiertos} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); cerrarApoyos(); } }}>
      {vista.apoyosAbiertos && <>
        <header className={styles.insightsHeader}>
          <div><h2 ref={tituloApoyos} id={tituloApoyosId} tabIndex={-1}><TranslatedText text="Insights de esta lectura" /></h2><p><TranslatedText text="Solo insights y ayudas: el artículo permanece arriba, sin superposiciones." /></p></div>
          <button className={styles.closeButton} type="button" onClick={cerrarApoyos}><TranslatedText text="Cerrar insights" /><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m6 6 12 12M18 6 6 18" /></svg></button>
        </header>
        {documento ? <>
          {language !== "es" && <p className={styles.note}><TranslatedText text="Los apoyos conservan las citas y palabras de la fuente en español para no alterar sus referencias. Vuelve al texto para leer la traducción." /></p>}
          <LecturaInteractiva documento={documento} onConsultarFuente={consultarFuente} />
        </> : <p className={styles.note} role="status"><TranslatedText text="No hay apoyos disponibles para esta noticia. Puedes releer el texto original." /></p>}
      </>}
    </section>
    <section className={styles.methodology} aria-label="Metodología de lectura">
      <header className={styles.methodologyHeader}>
        <h2><TranslatedText text="Metodología de lectura" /></h2>
        <p><TranslatedText text="Practica con las preguntas y vuelve al texto cuando lo necesites. Tu avance se conserva en este navegador." /></p>
      </header>
      {metodologiaVisible ? <NoticiaFlow noticia={noticia} embedded onVolverAlTexto={volverAlTexto} revisionVoz={revisionVoz} onRevisionVozChange={setRevisionVoz} /> : <div className={styles.methodologyPaused}>
        <p role="status"><TranslatedText text={vista.apoyosAbiertos ? "La metodología está en pausa mientras consultas los insights." : "La metodología está en pausa para que puedas releer el artículo."} /></p>
        {!vista.apoyosAbiertos && <button className={styles.resumeButton} type="button" onClick={() => dispatch("retomar-metodologia")}><TranslatedText text="Retomar metodología" /></button>}
      </div>}
    </section>

  </article>;
}

export default function LecturaNoticia(props: { noticia: NoticiaPublica; documento: EnrichedDocument | null }) {
  // A new article resets transient UI and cancels any previous narration.
  return <Reader key={props.noticia.id} {...props} />;
}
