import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { analyzeDocument, createStudyDocument } from "@/lib/aprendizaje/workspace";
import LearningWorkspace, { draftHasChanges, importedTextIsReadable } from "./LearningWorkspace";
import { LEARNING_UI_TEXTS, VALIDATION_COPY } from "./copy";
import StudyMap from "./StudyMap";
import StudyResults from "./StudyResults";

const translationCalls = vi.hoisted(() => [] as string[]);
vi.mock("@/components/i18n/LanguageProvider", () => ({
  TranslatedText: ({ text }: { text: string }) => { translationCalls.push(text); return text; },
  useLanguage: () => ({ t: (text: string) => { translationCalls.push(text); return text; } }),
  usePublicTranslations: (texts: readonly string[]) => { translationCalls.push(...texts); },
}));

const source = "Los humedales conservan agua durante los meses secos. La vegetación de los humedales protege el suelo de la erosión. Las comunidades cuidan el agua con acuerdos compartidos. La erosión disminuye cuando las raíces mantienen el suelo firme.";
const document = createStudyDocument({ title: "Humedales y comunidades", text: source }, 1234);
const analysis = analyzeDocument(document);

beforeEach(() => { translationCalls.length = 0; });

describe("learning workspace source-first contract", () => {
  it("places a real editable source before format selection and results, outside the chat", () => {
    const html = renderToStaticMarkup(createElement(LearningWorkspace));
    expect(html).toContain('id="study-source-title"');
    expect(html).toContain('id="study-source-text"');
    expect(html).toContain('type="file"');
    expect(html).toContain('accept=".txt,.md,text/plain,text/markdown"');
    expect(html).toContain('maxLength="50000"');
    expect(html.indexOf('id="study-source-text"')).toBeLessThan(html.indexOf("Convertir a"));
    expect(html.indexOf("Convertir a")).toBeLessThan(html.indexOf('id="study-result-title"'));
    expect(html).toContain("PDF e imágenes todavía no están disponibles.");
    expect(html).toContain("No se envía a servicios externos.");
    expect(html).not.toContain('class="thread"');
    expect(html).not.toContain("<dialog");
    expect(html).not.toContain("Enviar mensaje");
    expect(html).toContain("Cargando fuentes de este dispositivo…");
  });

  it("keeps every validation error in controlled public UI copy", () => {
    for (const copy of Object.values(VALIDATION_COPY)) expect(LEARNING_UI_TEXTS).toContain(copy);
  });

  it("does not treat a saved unchanged source as a disposable draft", () => {
    expect(draftHasChanges({ id: document.id, title: document.title, text: document.text }, [document])).toBe(false);
    expect(draftHasChanges({ id: document.id, title: "Otro título", text: document.text }, [document])).toBe(true);
    expect(draftHasChanges({ id: document.id, title: document.title, text: `${document.text}\n` }, [document])).toBe(true);
    expect(draftHasChanges({ id: null, title: "", text: "" }, [])).toBe(false);
    expect(draftHasChanges({ id: null, title: "", text: "Nueva fuente" }, [])).toBe(true);
  });

  it("rejects disguised binary files without rejecting accented plain text", () => {
    expect(importedTextIsReadable("Agua, maíz y educación.\r\n\tUn nuevo párrafo.")).toBe(true);
    expect(importedTextIsReadable("data\x00binary")).toBe(false);
    expect(importedTextIsReadable("texto\u001bcontrol")).toBe(false);
    expect(importedTextIsReadable("contenido\ufffdilegible")).toBe(false);
  });
});

describe("source-backed study results", () => {
  it("draws native selectable concepts with source-only connections and literal evidence", () => {
    const html = renderToStaticMarkup(createElement(StudyMap, { analysis, onShowEvidence: () => {} }));
    const shown = analysis.concepts.slice(0, 6);
    expect(shown.length).toBeGreaterThan(0);
    expect(html.match(/<path\b/g)).toHaveLength(shown.length);
    expect(html.match(/d="M 400 180 Q/g)).toHaveLength(shown.length);
    expect(html).toContain('aria-pressed="true"');
    for (const concept of shown) expect(html).toContain(concept.label);
    expect(html).toContain(shown[0].excerpt.text);
    expect(document.text.slice(shown[0].excerpt.start, shown[0].excerpt.end)).toBe(shown[0].excerpt.text);
    expect(html).toContain("no indican causas ni relaciones comprobadas");
    expect(html).toContain("Ver en la fuente");
    expect(html).not.toContain("<canvas");
  });

  it("does not invent a map for a source without enough concepts", () => {
    const html = renderToStaticMarkup(createElement(StudyMap, { analysis: { ...analysis, concepts: [] }, onShowEvidence: () => {} }));
    expect(html).toContain("No encontramos conceptos suficientes");
    expect(html).not.toContain("<svg");
  });

  it.each(["map", "ideas", "cards", "questions"] as const)("keeps private %s content out of public translation requests", (format) => {
    const html = renderToStaticMarkup(createElement(StudyResults, { analysis, format, onShowEvidence: () => {} }));
    expect(html).toContain(format === "questions" ? analysis.questions[0].prompt : format === "cards" ? analysis.cards[0].prompt : format === "ideas" ? analysis.ideas[0].text : analysis.concepts[0].label);
    expect(translationCalls.length).toBeGreaterThan(0);
    for (const text of translationCalls) expect(LEARNING_UI_TEXTS).toContain(text);
    expect(translationCalls).not.toContain(document.title);
    expect(translationCalls).not.toContain(document.text);
    expect(translationCalls).not.toContain(analysis.concepts[0].label);
    expect(translationCalls).not.toContain(analysis.ideas[0].text);
  });

  it("makes recall cards explicitly reveal the exact original evidence", () => {
    const html = renderToStaticMarkup(createElement(StudyResults, { analysis, format: "cards", onShowEvidence: () => {} }));
    expect(html.match(/<details\b/g)).toHaveLength(analysis.cards.length);
    for (const card of analysis.cards) expect(html).toContain(card.answer.text);
    expect(html).toContain("contrastar tu recuerdo con el texto original");
  });

  it("keeps practice responses local and ungraded, without a fake AI submit", () => {
    const html = renderToStaticMarkup(createElement(StudyResults, { analysis, format: "questions", onShowEvidence: () => {} }));
    expect(html.match(/<textarea\b/g)).toHaveLength(analysis.questions.length);
    expect(html).toContain("esta actividad no califica tu respuesta");
    expect(html).not.toContain("Evaluar respuesta");
    expect(html).not.toContain("type=\"submit\"");
  });

  it("escapes source content as text rather than rendering uploaded markup", () => {
    const dangerous = '<script>alert("private")</script> Texto con contenido de prueba.';
    const excerpt = { id: "test", start: 0, end: dangerous.length, text: dangerous };
    const html = renderToStaticMarkup(createElement(StudyResults, { analysis: { ...analysis, ideas: [excerpt] }, format: "ideas", onShowEvidence: () => {} }));
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });
});
