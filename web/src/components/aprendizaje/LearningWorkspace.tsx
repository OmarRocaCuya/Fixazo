"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { TranslatedText, useLanguage, usePublicTranslations } from "@/components/i18n/LanguageProvider";
import {
  analyzeDocument, createStudyDocument, emptyStudyWorkspace, MAX_DOCUMENTS, MAX_SOURCE_CHARS,
  readStudyWorkspace, saveStudyWorkspace, updateStudyDocument, validateStudyFile, validateStudyText,
  type StudyAnalysis, type StudyDocument, type StudyExcerpt, type StudyValidationError, type StudyWorkspace,
} from "@/lib/aprendizaje/workspace";
import { FORMAT_LABELS, LEARNING_UI_TEXTS, VALIDATION_COPY, type StudyFormat } from "./copy";
import StudyResults from "./StudyResults";
import styles from "./learning-workspace.module.css";

type Draft = { id: string | null; title: string; text: string };
type SourceChange = { kind: "new" } | { kind: "open"; id: string };
type WorkspaceNotice = "saved" | "memory-only" | "limit" | null;
const BLANK_DRAFT: Draft = { id: null, title: "", text: "" };
const FORMATS: StudyFormat[] = ["map", "ideas", "cards", "questions"];

export function draftHasChanges(draft: Draft, documents: readonly StudyDocument[]): boolean {
  const stored = documents.find((document) => document.id === draft.id);
  return draft.title !== (stored?.title ?? "") || draft.text !== (stored?.text ?? "");
}

export function importedTextIsReadable(text: string): boolean {
  // Extensions are not proof of plain text. Reject binary controls, not accents or newlines.
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    if (code <= 8 || (code >= 14 && code <= 31) || code === 0xfffd) return false;
  }
  return true;
}

/** Private source text is rendered directly, never registered with public translations. */
export default function LearningWorkspace() {
  const { t } = useLanguage();
  usePublicTranslations(LEARNING_UI_TEXTS);
  const [workspace, setWorkspace] = useState<StudyWorkspace>(emptyStudyWorkspace);
  const [draft, setDraft] = useState<Draft>(BLANK_DRAFT);
  const [analysis, setAnalysis] = useState<StudyAnalysis | null>(null);
  const [format, setFormat] = useState<StudyFormat>("map");
  const [view, setView] = useState<"transformations" | "map">("transformations");
  const [ready, setReady] = useState(false);
  const [readingFile, setReadingFile] = useState(false);
  const [editorOpen, setEditorOpen] = useState(true);
  const [error, setError] = useState<StudyValidationError | null>(null);
  const [notice, setNotice] = useState<WorkspaceNotice>(null);
  const [pendingChange, setPendingChange] = useState<SourceChange | null>(null);
  const sourceInput = useRef<HTMLTextAreaElement>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const fileEpoch = useRef(0);
  const cancelPendingFile = useCallback(() => { fileEpoch.current++; }, []);
  const dirty = draftHasChanges(draft, workspace.documents);
  const currentAnalysis = dirty ? null : analysis;

  useEffect(() => {
    let active = true;
    // Storage is a client-only external system; leave SSR and the first client render identical.
    queueMicrotask(() => {
      if (!active) return;
      const saved = readStudyWorkspace();
      setWorkspace(saved);
      const document = saved.documents.find((item) => item.id === saved.activeDocumentId);
      if (document) {
        setDraft({ id: document.id, title: document.title, text: document.text });
        setAnalysis(analyzeDocument(document));
        setEditorOpen(false);
      }
      setReady(true);
    });
    return () => { active = false; cancelPendingFile(); };
  }, [cancelPendingFile]);

  function persist(next: StudyWorkspace, announce = true) {
    setWorkspace(next);
    const saved = saveStudyWorkspace(next);
    if (announce || !saved) setNotice(saved ? "saved" : "memory-only");
  }

  function applySourceChange(change: SourceChange) {
    fileEpoch.current++;
    setReadingFile(false);
    setPendingChange(null);
    setError(null);
    setNotice(null);
    if (change.kind === "new") {
      setDraft(BLANK_DRAFT);
      setAnalysis(null);
      setEditorOpen(true);
      persist({ ...workspace, activeDocumentId: null }, false);
      requestAnimationFrame(() => sourceInput.current?.focus());
      return;
    }
    const document = workspace.documents.find((item) => item.id === change.id);
    if (!document) return;
    setDraft({ id: document.id, title: document.title, text: document.text });
    setAnalysis(analyzeDocument(document));
    setEditorOpen(false);
    persist({ ...workspace, activeDocumentId: document.id }, false);
  }

  function requestSourceChange(change: SourceChange) {
    if (dirty) setPendingChange(change);
    else applySourceChange(change);
  }

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    const validFile = validateStudyFile(file);
    if (!validFile.ok) { setError(validFile.error); return; }
    const token = ++fileEpoch.current;
    setReadingFile(true);
    setError(null);
    try {
      const text = await file.text();
      if (token !== fileEpoch.current) return;
      if (!importedTextIsReadable(text)) { setError("invalid-file"); return; }
      const validText = validateStudyText(text);
      if (!validText.ok) { setError(validText.error); return; }
      setDraft((current) => ({ ...current, text: validText.text, title: current.title || file.name.replace(/\.(txt|md)$/i, "") }));
      setNotice(null);
      setEditorOpen(true);
    } catch {
      if (token === fileEpoch.current) setError("invalid-file");
    } finally {
      if (token === fileEpoch.current) setReadingFile(false);
    }
  }

  function transform(event: FormEvent) {
    event.preventDefault();
    const valid = validateStudyText(draft.text);
    if (!valid.ok) { setError(valid.error); return; }
    const stored = workspace.documents.find((document) => document.id === draft.id);
    if (!stored && workspace.documents.length >= MAX_DOCUMENTS) { setNotice("limit"); return; }
    const document = stored
      ? updateStudyDocument(stored, { title: draft.title, text: valid.text })
      : createStudyDocument({ title: draft.title, text: valid.text });
    const documents = [document, ...workspace.documents.filter((item) => item.id !== document.id)];
    persist({ version: 1, documents, activeDocumentId: document.id });
    setDraft({ id: document.id, title: document.title, text: document.text });
    setAnalysis(analyzeDocument(document));
    setEditorOpen(false);
    setError(null);
    setPendingChange(null);
    requestAnimationFrame(() => {
      resultHeading.current?.focus({ preventScroll: true });
      resultHeading.current?.scrollIntoView({ block: "start" });
    });
  }

  function showEvidence(excerpt: StudyExcerpt) {
    setEditorOpen(true);
    requestAnimationFrame(() => {
      const input = sourceInput.current;
      if (!input) return;
      input.focus({ preventScroll: true });
      input.setSelectionRange(excerpt.start, excerpt.end);
      input.scrollIntoView({ block: "center" });
    });
  }

  function changeFormat(next: StudyFormat) {
    setFormat(next);
    if (next !== "map") setView("transformations");
  }

  return <div className={`page ${styles.workspace}`}>
    <header className={styles.pageHeader}>
      <div><h1><TranslatedText text={view === "map" ? "Mapa de aprendizaje" : "Transformaciones"} /></h1><p className={styles.intro}><TranslatedText text="De tu texto a una forma de estudiar. Pega una fuente o abre un archivo, elige un formato y explora el resultado." /></p></div>
      <div className={styles.viewSwitch} role="group" aria-label={t("Vistas del espacio de aprendizaje")}>
        <button type="button" aria-pressed={view === "transformations"} onClick={() => setView("transformations")}><TranslatedText text="Transformaciones" /></button>
        <button type="button" aria-pressed={view === "map"} onClick={() => { setView("map"); setFormat("map"); }}><TranslatedText text="Mapa de aprendizaje" /></button>
      </div>
    </header>

    <ol className={styles.flow} aria-label={t("Transformaciones")}>
      {["Fuente", "Formato", "Resultado"].map((label, index) => <li key={label} data-complete={index === 0 ? !!draft.text.trim() : index === 1 ? !!draft.text.trim() : !!currentAnalysis}><span aria-hidden="true">{index + 1}</span><TranslatedText text={label} /></li>)}
    </ol>

    <details className={styles.library} key={view} open={view === "map" ? true : undefined}>
      <summary><span><TranslatedText text="Mis fuentes" /></span><span className={styles.libraryCount}>{workspace.documents.length}/{MAX_DOCUMENTS}</span></summary>
      <div className={styles.libraryBody}>
        <p className={styles.help}><TranslatedText text="Las fuentes se conservan solo en este dispositivo. Puedes exportarlas o borrarlas desde Privacidad." /></p>
        {workspace.documents.length === 0 ? <p className={styles.help}><TranslatedText text="Aún no tienes fuentes guardadas." /></p> : <ul className={styles.sourceList}>
          {workspace.documents.map((document) => <li key={document.id}><button type="button" aria-pressed={draft.id === document.id} disabled={readingFile} onClick={() => requestSourceChange({ kind: "open", id: document.id })}>{document.title}</button></li>)}
        </ul>}
        <Link href="/privacidad" className={styles.textButton}><TranslatedText text="Ver privacidad" /><span aria-hidden="true"> ↗</span></Link>
      </div>
    </details>

    {pendingChange && <div className={styles.pendingNotice} role="alert">
      <p><TranslatedText text="Tienes cambios sin transformar." /></p>
      <div className={styles.inlineActions}><button type="button" className="btn subtle" onClick={() => setPendingChange(null)}><TranslatedText text="Conservar cambios" /></button><button type="button" className={styles.textButton} onClick={() => applySourceChange(pendingChange)}><TranslatedText text="Descartar y continuar" /></button></div>
    </div>}

    <form className={styles.sourceSection} onSubmit={transform}>
      <div className={styles.sectionHeader}>
        <div><span className={styles.smallLabel}><TranslatedText text="Tu fuente" /></span>{!editorOpen && <h2 className={styles.sourceTitle}>{draft.title}</h2>}</div>
        <div className={styles.inlineActions}>
          {!!analysis && <button type="button" className={styles.textButton} onClick={() => setEditorOpen((current) => !current)}><TranslatedText text={editorOpen ? "Ocultar editor" : "Editar fuente"} /><span aria-hidden="true"> {editorOpen ? "−" : "+"}</span></button>}
          <button type="button" className={styles.smallButton} disabled={!ready || readingFile} onClick={() => requestSourceChange({ kind: "new" })}><span aria-hidden="true">+</span><TranslatedText text="Nueva fuente" /></button>
        </div>
      </div>
      {editorOpen && <div className={styles.sourceEditor}>
        <div className={styles.titleField}><label htmlFor="study-source-title"><TranslatedText text="Título de la fuente" /></label><input id="study-source-title" value={draft.title} maxLength={160} disabled={!ready || readingFile} placeholder={t("Ponle un nombre para encontrarla después")} onChange={(event) => { setDraft({ ...draft, title: event.target.value }); setNotice(null); }} /></div>
        <div className={styles.editorLabelRow}><label htmlFor="study-source-text"><TranslatedText text="Texto de la fuente" /></label><label className={`${styles.fileButton}${readingFile || !ready ? ` ${styles.disabled}` : ""}`} htmlFor="study-source-file"><span aria-hidden="true">↥</span><TranslatedText text={readingFile ? "Leyendo archivo…" : "Abrir archivo TXT o MD"} /><input id="study-source-file" type="file" accept=".txt,.md,text/plain,text/markdown" disabled={!ready || readingFile} onChange={(event) => void importFile(event)} /></label></div>
        <textarea id="study-source-text" ref={sourceInput} value={draft.text} maxLength={MAX_SOURCE_CHARS} rows={8} disabled={!ready || readingFile} placeholder={t("Pega aquí el texto que quieres estudiar…")} aria-describedby="study-source-limits study-source-count" onChange={(event) => { setDraft({ ...draft, text: event.target.value }); setError(null); setNotice(null); }} />
        <div className={styles.sourceMeta}><p id="study-source-limits"><TranslatedText text="TXT o MD · hasta 1 MiB y 50.000 caracteres. PDF e imágenes todavía no están disponibles." /></p><span id="study-source-count">{draft.text.length.toLocaleString("es-PE")}/{MAX_SOURCE_CHARS.toLocaleString("es-PE")} <TranslatedText text="caracteres" /></span></div>
        <p className={styles.finePrint}><TranslatedText text="Los archivos originales no se guardan; solo se conserva su texto al transformar." /></p>
      </div>}

      <div className={styles.transformBar}>
        <fieldset className={styles.formatPicker}><legend><TranslatedText text="Convertir a" /></legend><div>{FORMATS.map((item) => <button type="button" key={item} aria-pressed={format === item} onClick={() => changeFormat(item)}><TranslatedText text={FORMAT_LABELS[item]} /></button>)}</div></fieldset>
        <button type="submit" className={`btn ${styles.transformButton}`} disabled={!ready || readingFile || !draft.text.trim()}><TranslatedText text={analysis ? "Actualizar resultado" : "Transformar texto"} /><span aria-hidden="true"> →</span></button>
      </div>
      <p className={styles.privacyNote}><span aria-hidden="true">◈</span><TranslatedText text="Tu texto se organiza en este navegador. No se envía a servicios externos." /></p>
      {error && <p className={styles.error} role="alert"><TranslatedText text={VALIDATION_COPY[error]} /></p>}
      {notice && <p className={notice === "saved" ? styles.saveNotice : styles.error} role="status"><TranslatedText text={notice === "saved" ? "Guardado en este dispositivo." : notice === "memory-only" ? "No se pudo guardar en este dispositivo. Mantén esta pestaña abierta o copia tu texto antes de salir." : "Llegaste al límite de 20 fuentes. Puedes editar una existente o exportar y borrar tus datos desde Privacidad."} /></p>}
      {!ready && <p className={styles.help} role="status"><TranslatedText text="Cargando fuentes de este dispositivo…" /></p>}
    </form>

    <section className={styles.resultSection} aria-labelledby="study-result-title">
      <div className={styles.resultHeader}><div><span className={styles.smallLabel}><TranslatedText text="Resultado" /></span><h2 id="study-result-title" ref={resultHeading} tabIndex={-1}><TranslatedText text={FORMAT_LABELS[format]} /></h2></div>{currentAnalysis && <span className={styles.resultSource}>{currentAnalysis.title}</span>}</div>
      {currentAnalysis ? <StudyResults key={`${currentAnalysis.documentId}-${currentAnalysis.sourceVersion}`} analysis={currentAnalysis} format={format} onShowEvidence={showEvidence} /> : <div className={styles.emptyState}><span className={styles.emptyGlyph} aria-hidden="true">↳</span><h3><TranslatedText text={analysis && dirty ? "La fuente cambió. Transforma de nuevo para actualizar el resultado." : "El resultado aparecerá aquí"} /></h3><p><TranslatedText text="Primero agrega tu texto y elige cómo quieres estudiarlo. Puedes cambiar de formato sin volver a subirlo." /></p></div>}
      <p className={styles.resultFootnote}><TranslatedText text="Organización local y extractiva: las ideas y respuestas son fragmentos de la fuente, no una explicación creada por IA." /></p>
    </section>
  </div>;
}
