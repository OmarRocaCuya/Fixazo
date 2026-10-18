"use client";

import { Fragment, useId, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Bloque, Cita, ComparadaData, DatosData, DialogoData, EnrichedDocument, Fuente, PancartaData, PiramideData, TimelineData } from "@reader-enricher/types";
import { blockAnchor, remainingBodyBlocks, safeSourceUrl, textSegments, validSource } from "./lectura-model";
import { useLecturaVoz } from "./use-lectura-voz";
import type { ActiveWord } from "./use-lectura-voz";
import styles from "./lectura-interactiva.module.css";

const W_LABELS = { que: "Qué ocurrió", quien: "Quién participa", cuando: "Cuándo", donde: "Dónde", porque: "Por qué" } as const;
const GENRES = { cronica: "Crónica", opinion: "Opinión", informativa: "Informativa", datos: "Datos", entrevista: "Entrevista", comparada: "Dos miradas" } as const;
const DESCRIPTIONS = {
  timeline: "Sigue el recorrido de los hechos. Cada momento conserva el texto de su fuente.",
  pancarta: "Una idea en primer plano; después, sus argumentos y el texto completo.",
  piramide: "Lo esencial primero. Luego, los detalles y el contexto de la noticia.",
  datos: "Lee las cifras junto a su contexto. Los gráficos usan datos presentes en el texto.",
  dialogo: "Recorre las voces de la entrevista y consulta el texto completo debajo.",
  comparada: "Lee las dos voces lado a lado, sin confundir quién dice qué.",
} as const;

function SourceLink({ source, blocks, children = "Ver en el texto" }: { source: Fuente; blocks: Bloque[]; children?: ReactNode }) {
  return validSource(blocks, source) ? <a className={styles.citationLink} href={`#${blockAnchor(source.bloqueId)}`}>{children} <span aria-hidden="true">↗</span></a> : null;
}

function Quote({ quote, blocks }: { quote: Cita | null; blocks: Bloque[] }) {
  if (!quote || !validSource(blocks, quote.fuente)) return null;
  const block = blocks.find((item) => item.id === quote.fuente.bloqueId)!;
  return <div className={styles.quote}><blockquote>{quote.texto}</blockquote><SourceLink source={quote.fuente} blocks={blocks}>{block.medio ?? "Fuente en el texto"}</SourceLink></div>;
}

function Highlight({ text, start, word }: { text: string; start: number; word: ActiveWord }) {
  if (!word || word.fin <= start || word.inicio >= start + text.length) return text;
  const from = Math.max(0, word.inicio - start);
  const to = Math.min(text.length, word.fin - start);
  return <>{text.slice(0, from)}<mark className={styles.currentWord}>{text.slice(from, to)}</mark>{text.slice(to)}</>;
}

function AnnotatedText({ block, document, activeWord }: { block: Bloque; document: EnrichedDocument; activeWord: ActiveWord }) {
  const [open, setOpen] = useState<string | null>(null);
  const id = useId();
  const spans = useMemo(() => document.spans.filter((span) => span.bloqueId === block.id), [document.spans, block.id]);
  const segments = useMemo(() => textSegments(block.texto, spans), [block.texto, spans]);
  const word = activeWord?.bloqueId === block.id ? activeWord : null;
  return <>{segments.map((segment) => {
    const span = segment.span;
    const glossary = span?.tipo === "glosario" ? document.capas.glosario.find((item) => item.id === span.refId) : null;
    const entity = span?.tipo === "entidad" ? document.capas.entidades.find((item) => item.id === span.refId) : null;
    const content = <Highlight text={segment.text} start={segment.inicio} word={word} />;
    if (!span || (!glossary && !entity)) return <Fragment key={segment.inicio}>{content}</Fragment>;
    const panelId = `${id}-${segment.inicio}`;
    return <span key={segment.inicio} className={styles.annotationWrap}>
      <button type="button" className={glossary ? styles.glossaryWord : styles.entityWord} aria-expanded={open === panelId} aria-controls={panelId} onClick={() => setOpen(open === panelId ? null : panelId)} onKeyDown={(event) => { if (event.key === "Escape") setOpen(null); }}>{content}</button>
      <span id={panelId} role="note" hidden={open !== panelId} className={styles.annotationPanel}>
        <strong>{glossary?.termino ?? entity?.texto}</strong><span className={styles.annotationLabel}>{glossary ? "Glosario" : entity?.etiqueta || entity?.tipo}</span>
        <span>{glossary?.definicion ?? entity?.contexto ?? "Entidad mencionada en este fragmento. No se añadió contexto externo."}</span>
        {glossary?.ejemplo ? <span>Ejemplo: {glossary.ejemplo}</span> : null}
        <button type="button" onClick={() => setOpen(null)} aria-label={`Cerrar información de ${segment.text}`}>Cerrar</button>
      </span>
    </span>;
  })}</>;
}

function ReadingBlock({ block, document, activeWord }: { block: Bloque; document: EnrichedDocument; activeWord: ActiveWord }) {
  const sourceUrl = safeSourceUrl(block.url);
  return <section className={styles.readingBlock} data-side={block.lado} id={blockAnchor(block.id)} tabIndex={-1}>
    <div className={styles.source}>{block.medio ?? "Texto de la noticia"}{block.fecha ? ` · ${block.fecha}` : ""}</div>
    <p className={styles.prose}><AnnotatedText block={block} document={document} activeWord={activeWord} /></p>
    {sourceUrl ? <a className={styles.sourceLink} href={sourceUrl} target="_blank" rel="noopener noreferrer">Consultar fuente ↗</a> : null}
  </section>;
}

function Visuals({ document }: { document: EnrichedDocument }) {
  const { cifras, timeline } = document.capas.visuales;
  if (!cifras.length && !timeline.length) return <p className={styles.note}>No hay cifras comparables ni fechas explícitas para crear un visual fiable.</p>;
  return <div className={styles.visuals}>
    {cifras.map((chart) => <figure key={chart.id} className={styles.chart}>
      <figcaption>Cifras en {chart.unidad}</figcaption>
      <ul>{chart.barras.map((bar) => <li key={bar.id}>
        <div className={styles.barLabel}><span>{bar.etiqueta}</span><strong>{bar.texto}</strong></div>
        <meter className={styles.meter} min={0} max={1} value={bar.proporcion} aria-label={`${bar.etiqueta}: ${bar.texto}`} />
        <SourceLink source={bar.fuente} blocks={document.bloques} />
      </li>)}</ul>
      <p className={styles.note}>Solo se comparan cifras con la misma unidad; revisa su contexto en la fuente.</p>
    </figure>)}
    {timeline.length && document.layout.id !== "timeline" ? <ol className={styles.miniTimeline}>{timeline.map((event) => <li key={event.id}><strong>{event.fecha.texto}</strong><Quote quote={event.evento} blocks={document.bloques} /></li>)}</ol> : null}
  </div>;
}

function ReadingLayout({ document, activeWord }: { document: EnrichedDocument; activeWord: ActiveWord }) {
  const rendered = new Set<string>();
  const blocks = new Map(document.bloques.map((block) => [block.id, block]));
  const renderBlocks = (ids: string[]) => ids.flatMap((id) => {
    const block = blocks.get(id);
    if (!block || block.rol !== "cuerpo" || rendered.has(id)) return [];
    rendered.add(id);
    return [<ReadingBlock key={id} block={block} document={document} activeWord={activeWord} />];
  });
  let layout: ReactNode;
  // Layout payloads have been validated with the service's matching schema on the server.
  switch (document.layout.id) {
    case "timeline": {
      const data = document.layout.data as TimelineData;
      layout = <ol className={styles.timeline}>{data.eventos.map((event, index) => <li key={event.id}>
        <div className={styles.eventHeading}><span className={styles.eventNumber}>{String(index + 1).padStart(2, "0")}</span><h3>{event.ancla?.texto ?? "En el relato"}</h3></div>
        <Quote quote={event.resumen} blocks={document.bloques} />{renderBlocks(event.bloqueIds)}
      </li>)}</ol>;
      break;
    }
    case "pancarta": {
      const data = document.layout.data as PancartaData;
      layout = <><section className={styles.banner}><span className={styles.eyebrow}>La idea central · opinión</span><Quote quote={data.tesis} blocks={document.bloques} /><p>Es una postura de la fuente, no una conclusión del lector.</p></section>
        {data.argumentos.length ? <section className={styles.argumentList}><h3>Cómo sostiene su idea</h3>{data.argumentos.map((argument, index) => <div key={argument.id} className={styles.argument}><span>{String(index + 1).padStart(2, "0")}</span><Quote quote={argument.cita} blocks={document.bloques} /></div>)}</section> : null}
        {data.citas.length ? <details className={styles.details}><summary>Frases destacadas de la fuente</summary>{data.citas.map((quote, index) => <Quote key={index} quote={quote} blocks={document.bloques} />)}</details> : null}
        <h3 className={styles.sectionHeading}>La lectura completa</h3>{renderBlocks(data.bloqueIds)}</>;
      break;
    }
    case "piramide": {
      const data = document.layout.data as PiramideData;
      layout = <div className={styles.pyramid}>{data.niveles.map((level) => <section key={level.importancia}><h3><span>0{level.importancia}</span> {level.etiqueta}</h3>{renderBlocks(level.bloqueIds)}</section>)}</div>;
      break;
    }
    case "datos": {
      const data = document.layout.data as DatosData;
      layout = <><div className={styles.stats}>{data.destacadas.map((figure) => <div key={figure.id}><strong>{figure.texto}</strong><p>{figure.etiqueta}</p><SourceLink source={figure.fuente} blocks={document.bloques} /></div>)}</div><h3 className={styles.sectionHeading}>Las cifras, en contexto</h3>{renderBlocks(data.bloqueIds)}</>;
      break;
    }
    case "dialogo": {
      const data = document.layout.data as DialogoData;
      layout = <><div className={styles.dialogue}>{data.turnos.map((turn) => <section key={turn.id} data-role={turn.rol}><h3>{turn.hablante}</h3><Quote quote={turn.cita} blocks={document.bloques} /></section>)}</div><h3 className={styles.sectionHeading}>Texto completo de la entrevista</h3></>;
      break;
    }
    case "comparada": {
      const data = document.layout.data as ComparadaData;
      layout = <><div className={styles.comparison}>{data.columnas.map((column) => <section key={column.lado} data-side={column.lado}><header><span className={styles.eyebrow}>Mirada {column.lado.toUpperCase()}</span><h3>{column.medio ?? "Fuente"}</h3>{column.titular ? <p>{column.titular.texto}</p> : null}</header>{renderBlocks(column.bloqueIds)}</section>)}</div>
        {data.puntos.length ? <details className={styles.details}><summary>Puntos para leer en paralelo ({data.puntos.length})</summary><p className={styles.note}>Son correspondencias de fragmentos, no una verificación de que ambas fuentes afirmen lo mismo.</p>{data.puntos.map((point) => <section key={point.id}><h3>{point.tema}</h3><div className={styles.comparison}><Quote quote={point.a} blocks={document.bloques} /><Quote quote={point.b} blocks={document.bloques} /></div></section>)}</details> : null}</>;
      break;
    }
  }
  const remaining = remainingBodyBlocks(document, rendered);
  return <div className={styles.articleBody}>{layout}{remaining.length ? <div className={styles.remaining}>{renderBlocks(remaining.map((block) => block.id))}</div> : null}</div>;
}

function ContextRail({ document }: { document: EnrichedDocument }) {
  const entries = Object.entries(document.capas.cincoW) as Array<[keyof typeof W_LABELS, Cita | null]>;
  return <aside className={styles.contextRail} aria-label="Claves y ayudas de lectura">
    <section className={styles.fiveW}><p className={styles.eyebrow}>En cinco claves</p><h2>Ubícate en la noticia</h2><dl>{entries.map(([key, quote]) => <div key={key}><dt>{W_LABELS[key]}</dt><dd>{quote ? <Quote quote={quote} blocks={document.bloques} /> : <span className={styles.note}>No se indica de forma explícita.</span>}</dd></div>)}</dl><p className={styles.note}>Citas del texto; no un resumen verificado.</p></section>
    <details className={styles.details}><summary>Glosario <span>{document.capas.glosario.length}</span></summary>{document.capas.glosario.length ? <dl className={styles.referenceList}>{document.capas.glosario.map((item) => <div key={item.id}><dt>{item.termino}</dt><dd>{item.definicion}{item.ejemplo ? <p>Ejemplo: {item.ejemplo}</p> : null}<SourceLink source={item.fuente} blocks={document.bloques} /></dd></div>)}</dl> : <p className={styles.note}>No se generaron definiciones para esta lectura. No se inventan significados sin información disponible.</p>}</details>
    <details className={styles.details}><summary>Quién es quién <span>{document.capas.entidades.length}</span></summary><ul className={styles.referenceList}>{document.capas.entidades.map((entity) => <li key={entity.id}><strong>{entity.texto}</strong><span>{entity.etiqueta || entity.tipo}</span>{entity.contexto ? <p>{entity.contexto}</p> : null}<SourceLink source={entity.fuente} blocks={document.bloques} /></li>)}</ul>{!document.capas.entidades.length ? <p className={styles.note}>No hay entidades anotadas.</p> : null}</details>
    <details className={styles.details}><summary>Cómo se preparó esta lectura</summary><p className={styles.note}>{document.meta.ia ? "Las ayudas se prepararon con IA y pueden contener errores. Contrástalas con las fuentes." : "Presentación preparada con reglas locales, sin análisis por IA. Las ayudas son limitadas."}</p><p className={styles.note}>El género es {document.meta.generoFuente === "forzado" ? "una selección editorial" : "una propuesta automática"}; no es una clasificación definitiva.</p>{document.meta.avisos.length ? <ul className={styles.noticeList}>{document.meta.avisos.map((notice, index) => <li key={index}>{notice}</li>)}</ul> : null}</details>
  </aside>;
}

export default function LecturaInteractiva({ documento }: { documento: EnrichedDocument }) {
  const body = useMemo(() => documento.bloques.filter((block) => block.rol === "cuerpo"), [documento.bloques]);
  const voice = useLecturaVoz(body);
  return <div className={styles.enriched}>
    <section className={styles.intro} aria-label="Presentación de lectura">
      <div><p className={styles.eyebrow}>{GENRES[documento.genero]} <span> / </span> {documento.layout.nombre}</p><p>{DESCRIPTIONS[documento.layout.id]}</p></div>
      <div className={styles.audioControl}><button type="button" className={styles.listenButton} onClick={voice.playing ? voice.stop : voice.start} disabled={!voice.available || !body.length}><span aria-hidden="true">{voice.playing ? "■" : "▶"}</span> {voice.playing ? "Detener lectura" : "Escuchar lectura"}</button><p className={styles.audioNotice} role="status">{voice.available ? voice.notice : "Voz no disponible en este navegador. Puedes leer todo el texto."}</p></div>
    </section>
    <p className={styles.annotationHint}><span className={styles.glossarySample}>Subrayado continuo</span>: glosario. <span className={styles.entitySample}>Punteado</span>: personas, lugares y datos. Pulsa una palabra anotada para consultar su información.</p>
    {documento.bloques.filter((block) => block.rol !== "cuerpo").map((block) => <div key={block.id} id={blockAnchor(block.id)} tabIndex={-1} className={styles.sourceHeading}><span className={styles.source}>{block.medio ?? "Cabecera de la noticia"}</span><p>{block.texto}</p></div>)}
    <div className={styles.contentGrid}><div><ReadingLayout document={documento} activeWord={voice.activeWord} /><details className={`${styles.details} ${styles.visualDetails}`}><summary>Ver la noticia en cifras y fechas</summary><Visuals document={documento} /></details></div><ContextRail document={documento} /></div>
    <footer className={styles.readingFooter}><span className={styles.eyebrow}>Fin de la lectura</span><p>Vuelve a una fuente, consulta una palabra o pasa a Comprensión cuando quieras.</p></footer>
  </div>;
}
