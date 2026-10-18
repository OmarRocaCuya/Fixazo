"use client";

import { useState } from "react";
import { TranslatedText, useLanguage } from "@/components/i18n/LanguageProvider";
import type { StudyAnalysis, StudyExcerpt } from "@/lib/aprendizaje/workspace";
import styles from "./learning-workspace.module.css";

export interface StudyMapProps {
  analysis: StudyAnalysis;
  onShowEvidence: (excerpt: StudyExcerpt) => void;
}

/** One source and its literal concepts, not a fabricated semantic network. */
export default function StudyMap({ analysis, onShowEvidence }: StudyMapProps) {
  const { t } = useLanguage();
  const concepts = analysis.concepts.slice(0, 6);
  const [selectedId, setSelectedId] = useState(concepts[0]?.id ?? "");
  const selected = concepts.find((concept) => concept.id === selectedId) ?? concepts[0];

  if (!selected) return <p className={styles.emptyCopy}><TranslatedText text="No encontramos conceptos suficientes para dibujar un mapa. Puedes revisar los fragmentos en Ideas clave o ampliar la fuente." /></p>;

  return <div className={styles.mapContent}>
    <p className={styles.help}><TranslatedText text="Selecciona un concepto para ver el fragmento que lo respalda." /></p>
    <div className={styles.graph} aria-label={t("Conceptos de esta fuente")}>
      <svg className={styles.connections} viewBox="0 0 800 360" preserveAspectRatio="none" aria-hidden="true">
        {concepts.map((concept, index) => {
          const x = index < 3 ? 135 : 665;
          const y = 62 + (index % 3) * 118;
          return <path key={concept.id} d={`M 400 180 Q ${x < 400 ? 285 : 515} 180 ${x} ${y}`} />;
        })}
      </svg>
      <div className={styles.mapRoot}>
        <span className={styles.smallLabel}><TranslatedText text="Fuente" /></span>
        <strong>{analysis.title}</strong>
      </div>
      <ol className={styles.mapNodes} aria-label={t("Conceptos de esta fuente")}>
        {concepts.map((concept, index) => <li key={concept.id} style={{ gridColumn: index < 3 ? 1 : 3, gridRow: (index % 3) + 1 }}>
          <button type="button" className={styles.mapNode} aria-pressed={selected.id === concept.id} onClick={() => setSelectedId(concept.id)}>
            <span className={styles.nodeNumber} aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
            <span>{concept.label}</span>
          </button>
        </li>)}
      </ol>
    </div>
    <section className={styles.evidence} aria-label={t("Fragmento de la fuente")} aria-live="polite">
      <div className={styles.evidenceHeading}>
        <span className={styles.smallLabel}><TranslatedText text="Fragmento de la fuente" /></span>
        <strong>{selected.label}</strong>
      </div>
      <blockquote>{selected.excerpt.text}</blockquote>
      <button type="button" className={styles.textButton} onClick={() => onShowEvidence(selected.excerpt)}><TranslatedText text="Ver en la fuente" /><span aria-hidden="true"> ↗</span></button>
    </section>
    <p className={styles.finePrint}><TranslatedText text="Las conexiones agrupan conceptos de la misma fuente; no indican causas ni relaciones comprobadas entre ellos." /></p>
  </div>;
}
