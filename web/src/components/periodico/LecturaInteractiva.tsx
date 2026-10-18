"use client";

import type { ReactNode } from "react";
import { TranslatedText } from "@/components/i18n/LanguageProvider";
import type { Bloque, Cita, ComparadaData, DatosData, DialogoData, EnrichedDocument, Fuente, PancartaData, PiramideData, TimelineData } from "@reader-enricher/types";
import { blockAnchor, validSource } from "./lectura-model";
import styles from "./lectura-interactiva.module.css";

const W_LABELS = { que: "Qué ocurrió", quien: "Quién participa", cuando: "Cuándo", donde: "Dónde", porque: "Por qué" } as const;
const GENRES = { cronica: "Crónica", opinion: "Opinión", informativa: "Informativa", datos: "Datos", entrevista: "Entrevista", comparada: "Dos miradas" } as const;
const DESCRIPTIONS = {
  timeline: "Momentos clave",
  pancarta: "Ideas y argumentos",
  piramide: "Lo esencial y su contexto",
  datos: "Cifras destacadas",
  dialogo: "Voces de la entrevista",
  comparada: "Puntos para contrastar",
} as const;

type SupportProps = { document: EnrichedDocument; onConsultarFuente?: (blockId: string) => void };
type CitationProps = Pick<SupportProps, "onConsultarFuente"> & { blocks: Bloque[] };

/** An excerpt, not a rewritten summary. Never print whole paragraph collections. */
export function citaBreve(text: string, limit = 220): string {
  return text.length > limit ? `${text.slice(0, limit - 1).replace(/[\uD800-\uDBFF]$/u, "").trimEnd()}…` : text;
}

type ContextualQuote = Cita & { recorteInicio?: boolean; recorteFin?: boolean };

/** A shared entity is a pointer to evidence, not itself a useful comparison. */
export function citaContextual(quote: Cita | null, blocks: Bloque[]): ContextualQuote | null {
  if (!quote || !validSource(blocks, quote.fuente)) return null;
  const block = blocks.find((item) => item.id === quote.fuente.bloqueId)!;
  const text = block.texto;
  let sentenceStart = 0;
  let sentenceEnd = text.length;
  for (const boundary of text.matchAll(/[.!?…]+(?=\s|$)|\n+/gu)) {
    const end = boundary.index + boundary[0].length;
    if (end <= quote.fuente.inicio) sentenceStart = end;
    else if (end >= quote.fuente.fin) { sentenceEnd = end; break; }
  }
  while (sentenceStart < sentenceEnd && /\s/u.test(text[sentenceStart])) sentenceStart++;
  while (sentenceEnd > sentenceStart && /\s/u.test(text[sentenceEnd - 1])) sentenceEnd--;
  const sentence = text.slice(sentenceStart, sentenceEnd);
  if ((sentence.match(/[\p{L}\p{N}]+/gu) ?? []).length < 5) return null;

  // Keep the named span in view even inside a very long sentence; do not print
  // the entire block to recover its context. Reserve room for both ellipses.
  let inicio = sentenceStart;
  let fin = sentenceEnd;
  if (fin - inicio > 218) {
    inicio = Math.max(sentenceStart, quote.fuente.inicio - 70);
    if (inicio > sentenceStart) {
      const space = text.indexOf(" ", inicio);
      if (space >= inicio && space < quote.fuente.inicio) inicio = space + 1;
    }
    fin = Math.min(sentenceEnd, inicio + 218);
    if (fin < sentenceEnd) {
      const space = text.lastIndexOf(" ", fin);
      if (space > inicio && space >= fin - 30 && space >= Math.min(quote.fuente.fin, fin - 30)) fin = space;
    }
    if (/[\uD800-\uDBFF]/u.test(text[fin - 1] ?? "")) fin--;
  }
  return {
    texto: text.slice(inicio, fin), fuente: { bloqueId: block.id, inicio, fin },
    recorteInicio: inicio > sentenceStart, recorteFin: fin < sentenceEnd,
  };
}

function SourceLink({ source, blocks, onConsultarFuente, children = <TranslatedText text="Ver en el texto" /> }: CitationProps & { source: Fuente; children?: ReactNode }) {
  return validSource(blocks, source) ? <a className={styles.citationLink} href={`#${blockAnchor(source.bloqueId)}`} onClick={onConsultarFuente ? (event) => { event.preventDefault(); onConsultarFuente(source.bloqueId); } : undefined}>{children} <span aria-hidden="true">↗</span></a> : null;
}

function Quote({ quote, blocks, onConsultarFuente }: CitationProps & { quote: ContextualQuote | null }) {
  if (!quote || !validSource(blocks, quote.fuente)) return null;
  const block = blocks.find((item) => item.id === quote.fuente.bloqueId)!;
  const excerpt = block.texto.slice(quote.fuente.inicio, quote.fuente.fin);
  return <div className={styles.quote}><blockquote>{citaBreve(`${quote.recorteInicio ? "…" : ""}${excerpt}${quote.recorteFin ? "…" : ""}`)}</blockquote><SourceLink source={quote.fuente} blocks={blocks} onConsultarFuente={onConsultarFuente}>{block.medio ?? <TranslatedText text="Fuente en el texto" />}</SourceLink></div>;
}

function EmptySupport() {
  return <p className={styles.note}><TranslatedText text="No hay citas suficientes para este apoyo." /></p>;
}

/** Six compact lenses over grounded evidence, with no ReadingBlock/body renderer. */
function GenreInsights({ document, onConsultarFuente }: SupportProps) {
  const citation = { blocks: document.bloques, onConsultarFuente };
  switch (document.layout.id) {
    case "timeline": {
      const data = document.layout.data as TimelineData;
      return data.eventos.length ? <ol className={styles.timeline}>{data.eventos.slice(0, 3).map((event, index) => <li key={event.id}>
        <div className={styles.eventHeading}><span className={styles.eventNumber}>{String(index + 1).padStart(2, "0")}</span><h4>{event.ancla ? citaBreve(event.ancla.texto, 80) : <TranslatedText text="En el relato" />}</h4></div>
        <Quote quote={event.resumen} {...citation} />
      </li>)}</ol> : <EmptySupport />;
    }
    case "pancarta": {
      const data = document.layout.data as PancartaData;
      return data.tesis || data.argumentos.length ? <>
        {data.tesis && <section className={styles.banner}><p className={styles.eyebrow}><TranslatedText text="La idea central · opinión" /></p><Quote quote={data.tesis} {...citation} /><p><TranslatedText text="Es una postura de la fuente, no una conclusión del lector." /></p></section>}
        {data.argumentos.length ? <section className={styles.argumentList}><h4><TranslatedText text="Cómo sostiene su idea" /></h4>{data.argumentos.slice(0, 3).map((argument, index) => <div key={argument.id} className={styles.argument}><span>{String(index + 1).padStart(2, "0")}</span><Quote quote={argument.cita} {...citation} /></div>)}</section> : null}
      </> : <EmptySupport />;
    }
    case "piramide": {
      const data = document.layout.data as PiramideData;
      return data.lead || data.niveles.length ? <>
        <Quote quote={data.lead} {...citation} />
        <ul className={styles.pyramid}>{data.niveles.slice(0, 3).map((level) => {
          const block = document.bloques.find((item) => level.bloqueIds.includes(item.id) && item.rol === "cuerpo");
          return block ? <li key={level.importancia}><span className={styles.eventNumber}>0{level.importancia}</span><SourceLink source={{ bloqueId: block.id, inicio: 0, fin: block.texto.length }} {...citation}>{level.etiqueta}</SourceLink></li> : null;
        })}</ul>
      </> : <EmptySupport />;
    }
    case "datos": {
      const data = document.layout.data as DatosData;
      return data.destacadas.length ? <div className={styles.stats}>{data.destacadas.slice(0, 4).map((figure) => <div key={figure.id}><strong>{citaBreve(figure.texto, 80)}</strong><p>{citaBreve(figure.etiqueta)}</p><SourceLink source={figure.fuente} {...citation} /></div>)}</div> : <EmptySupport />;
    }
    case "dialogo": {
      const data = document.layout.data as DialogoData;
      return data.turnos.length ? <div className={styles.dialogue}>{data.turnos.slice(0, 3).map((turn) => <section key={turn.id} data-role={turn.rol}><h4>{citaBreve(turn.hablante, 80)}</h4><Quote quote={turn.cita} {...citation} /></section>)}</div> : <EmptySupport />;
    }
    case "comparada": {
      const data = document.layout.data as ComparadaData;
      const points = data.puntos.flatMap((point) => {
        const a = citaContextual(point.a, document.bloques);
        const b = citaContextual(point.b, document.bloques);
        // Do not turn a repeated name, missing source, or identical passage into
        // an apparent contrast. The existing fallback is more honest.
        if (!a || !b || a.texto.trim().toLocaleLowerCase("es") === b.texto.trim().toLocaleLowerCase("es")) return [];
        return [{ ...point, a, b }];
      }).slice(0, 3);
      return points.length ? <div className={styles.comparisonPoints}><p className={styles.note}><TranslatedText text="Son correspondencias de fragmentos, no una verificación de que ambas fuentes afirmen lo mismo." /></p>{points.map((point) => <section key={point.id}><h4>{citaBreve(point.tema, 100)}</h4><div className={styles.comparison}><Quote quote={point.a} {...citation} /><Quote quote={point.b} {...citation} /></div></section>)}</div> : <EmptySupport />;
    }
  }
}

function Visuals({ document, onConsultarFuente }: SupportProps) {
  const { cifras, timeline } = document.capas.visuales;
  const citation = { blocks: document.bloques, onConsultarFuente };
  if (!cifras.length && !timeline.length) return <p className={styles.note}><TranslatedText text="No hay cifras comparables ni fechas explícitas para crear un visual fiable." /></p>;
  return <div className={styles.visuals}>
    {cifras.slice(0, 3).map((chart) => <figure key={chart.id} className={styles.chart}>
      <figcaption><TranslatedText text="Cifras en" /> {chart.unidad}</figcaption>
      <ul>{chart.barras.slice(0, 5).map((bar) => <li key={bar.id}>
        <div className={styles.barLabel}><span>{citaBreve(bar.etiqueta)}</span><strong>{citaBreve(bar.texto, 80)}</strong></div>
        <meter className={styles.meter} min={0} max={1} value={bar.proporcion} aria-label={`${bar.etiqueta}: ${bar.texto}`} />
        <SourceLink source={bar.fuente} {...citation} />
      </li>)}</ul>
      <p className={styles.note}><TranslatedText text="Solo se comparan cifras con la misma unidad; revisa su contexto en la fuente." /></p>
    </figure>)}
    {timeline.length ? <ol className={styles.miniTimeline}>{timeline.slice(0, 3).map((event) => <li key={event.id}><strong>{citaBreve(event.fecha.texto, 80)}</strong><Quote quote={event.evento} {...citation} /></li>)}</ol> : null}
  </div>;
}

function ContextSupport({ document, onConsultarFuente }: SupportProps) {
  const entries = Object.entries(document.capas.cincoW) as Array<[keyof typeof W_LABELS, Cita | null]>;
  const citation = { blocks: document.bloques, onConsultarFuente };
  return <section className={styles.contextSupport} aria-label="Claves y ayudas de lectura">
    <section className={styles.fiveW}><p className={styles.eyebrow}><TranslatedText text="En cinco claves" /></p><h3><TranslatedText text="Ubícate en la noticia" /></h3><dl>{entries.map(([key, quote]) => <div key={key}><dt><TranslatedText text={W_LABELS[key]} /></dt><dd>{quote ? <Quote quote={quote} {...citation} /> : <span className={styles.note}><TranslatedText text="No se indica de forma explícita." /></span>}</dd></div>)}</dl><p className={styles.note}><TranslatedText text="Citas del texto; no un resumen verificado." /></p></section>
    <details className={styles.details}><summary><TranslatedText text="Glosario" /> <span>{document.capas.glosario.length}</span></summary>{document.capas.glosario.length ? <dl className={styles.referenceList}>{document.capas.glosario.map((item) => <div key={item.id}><dt>{item.termino}</dt><dd>{citaBreve(item.definicion)}{item.ejemplo ? <p><TranslatedText text="Ejemplo:" /> {citaBreve(item.ejemplo)}</p> : null}<SourceLink source={item.fuente} {...citation} /></dd></div>)}</dl> : <p className={styles.note}><TranslatedText text="No se generaron definiciones para esta lectura. No se inventan significados sin información disponible." /></p>}</details>
    <details className={styles.details}><summary><TranslatedText text="Quién es quién" /> <span>{document.capas.entidades.length}</span></summary><ul className={styles.referenceList}>{document.capas.entidades.map((entity) => <li key={entity.id}><strong>{entity.texto}</strong><span>{entity.etiqueta || entity.tipo}</span>{entity.contexto ? <p>{citaBreve(entity.contexto)}</p> : null}<SourceLink source={entity.fuente} {...citation} /></li>)}</ul>{!document.capas.entidades.length ? <p className={styles.note}><TranslatedText text="No hay entidades anotadas." /></p> : null}</details>
    <details className={styles.details}><summary><TranslatedText text="Cómo se preparó esta lectura" /></summary><p className={styles.note}><TranslatedText text={document.meta.ia ? "Las ayudas se prepararon con IA y pueden contener errores. Contrástalas con las fuentes." : "Presentación preparada con reglas locales, sin análisis por IA. Las ayudas son limitadas."} /></p><p className={styles.note}><TranslatedText text={document.meta.generoFuente === "forzado" ? "El género es una selección editorial; no es una clasificación definitiva." : "El género es una propuesta automática; no es una clasificación definitiva."} /></p>{document.meta.avisos.length ? <ul className={styles.noticeList}>{document.meta.avisos.map((notice, index) => <li key={index}>{notice}</li>)}</ul> : null}</details>
  </section>;
}

export default function LecturaInteractiva({ documento, onConsultarFuente }: { documento: EnrichedDocument; onConsultarFuente?: (blockId: string) => void }) {
  return <div className={styles.enriched}>
    <section className={styles.intro} aria-label="Ayudas adaptadas al texto">
      <p className={styles.eyebrow}><TranslatedText text={GENRES[documento.genero]} /></p>
      <h3><TranslatedText text={DESCRIPTIONS[documento.layout.id]} /></h3>
      <GenreInsights document={documento} onConsultarFuente={onConsultarFuente} />
      <p className={styles.note}><TranslatedText text="Consulta el pasaje completo en el artículo." /></p>
    </section>
    <div className={styles.contentStack}>
      <ContextSupport document={documento} onConsultarFuente={onConsultarFuente} />
      <details className={styles.details}><summary><TranslatedText text="Ver la noticia en cifras y fechas" /></summary><Visuals document={documento} onConsultarFuente={onConsultarFuente} /></details>
    </div>
  </div>;
}
