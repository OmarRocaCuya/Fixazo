"use client";

import { useState } from "react";
import { TranslatedText, useLanguage } from "@/components/i18n/LanguageProvider";
import type { StudyAnalysis, StudyExcerpt } from "@/lib/aprendizaje/workspace";
import type { StudyFormat } from "./copy";
import StudyMap from "./StudyMap";
import styles from "./learning-workspace.module.css";

export interface StudyResultsProps {
  analysis: StudyAnalysis;
  format: StudyFormat;
  onShowEvidence: (excerpt: StudyExcerpt) => void;
}

function StudyPrompt({ analysis, conceptId, kind, fallback }: { analysis: StudyAnalysis; conceptId: string; kind: "card" | "question"; fallback: string }) {
  const concept = analysis.concepts.find((item) => item.id === conceptId);
  if (!concept) return <>{fallback}</>;
  // Translate only the fixed question frame, never the learner's concept.
  return kind === "card"
    ? <><TranslatedText text="¿Qué dice el texto sobre" />{" «"}{concept.label}{"»?"}</>
    : <><TranslatedText text="Explica con tus palabras lo que el texto dice sobre" />{" «"}{concept.label}{"» "}<TranslatedText text="y contrástalo con la cita." /></>;
}

export default function StudyResults({ analysis, format, onShowEvidence }: StudyResultsProps) {
  const { t } = useLanguage();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  if (format === "map") return <StudyMap analysis={analysis} onShowEvidence={onShowEvidence} />;

  if (format === "ideas") return <div className={styles.resultContent}>
    <h3><TranslatedText text="Fragmentos para repasar" /></h3>
    {analysis.ideas.length === 0 ? <p className={styles.help}><TranslatedText text="No hay fragmentos disponibles para este texto." /></p> : <ol className={styles.ideaList}>
      {analysis.ideas.map((excerpt, index) => <li key={excerpt.id}>
        <span className={styles.ideaNumber} aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
        <div><blockquote>{excerpt.text}</blockquote><button type="button" className={styles.textButton} onClick={() => onShowEvidence(excerpt)}><TranslatedText text="Ver en la fuente" /><span aria-hidden="true"> ↗</span></button></div>
      </li>)}
    </ol>}
  </div>;

  if (format === "cards") return <div className={styles.resultContent}>
    <p className={styles.help}><TranslatedText text="Abre una tarjeta para contrastar tu recuerdo con el texto original." /></p>
    <div className={styles.studyList}>
      {analysis.cards.map((card, index) => <details className={styles.studyCard} key={card.id}>
        <summary><span className={styles.ideaNumber} aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><span><StudyPrompt analysis={analysis} conceptId={card.conceptId} kind="card" fallback={card.prompt} /></span><span className={styles.revealMark} aria-hidden="true">+</span></summary>
        <div className={styles.cardAnswer}><blockquote>{card.answer.text}</blockquote><button type="button" className={styles.textButton} onClick={() => onShowEvidence(card.answer)}><TranslatedText text="Ver en la fuente" /><span aria-hidden="true"> ↗</span></button></div>
      </details>)}
      {analysis.cards.length === 0 && <p className={styles.help}><TranslatedText text="No hay fragmentos disponibles para este texto." /></p>}
    </div>
  </div>;

  return <div className={styles.resultContent}>
    <p className={styles.help}><TranslatedText text="Responde y vuelve a la evidencia cuando lo necesites." /></p>
    <p className={styles.finePrint}><TranslatedText text="Escribe con tus palabras; esta actividad no califica tu respuesta." /></p>
    <ol className={styles.questionList}>
      {analysis.questions.map((question, index) => <li key={question.id}>
        <h3><span className={styles.ideaNumber} aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><span><StudyPrompt analysis={analysis} conceptId={question.conceptId} kind="question" fallback={question.prompt} /></span></h3>
        <label className={styles.answerLabel} htmlFor={`study-answer-${question.id}`}><TranslatedText text="Tu explicación" /></label>
        <textarea id={`study-answer-${question.id}`} className={styles.answerInput} rows={3} maxLength={2000} aria-label={`${t("Tu explicación")} ${index + 1}`} value={answers[question.id] ?? ""} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))} />
        <details className={styles.questionEvidence}><summary><TranslatedText text="Consultar fragmento" /></summary><blockquote>{question.evidence.text}</blockquote><button type="button" className={styles.textButton} onClick={() => onShowEvidence(question.evidence)}><TranslatedText text="Ver en la fuente" /><span aria-hidden="true"> ↗</span></button></details>
      </li>)}
    </ol>
    {analysis.questions.length === 0 && <p className={styles.help}><TranslatedText text="No hay fragmentos disponibles para este texto." /></p>}
  </div>;
}
