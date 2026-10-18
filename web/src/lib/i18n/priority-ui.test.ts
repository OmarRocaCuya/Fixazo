import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import seed from "./public-translations.json";
import provenance from "./public-translations.provenance.json";
import { PRIORITY_UI_TEXTS } from "./priority-ui";
import { LANGUAGE_UI_TEXTS, PUBLIC_UI_TEXTS } from "./ui-texts";
import { PublicTranslationStore } from "./translation-store";

const dictionaries: Record<"quy" | "ayr", Record<string, string>> = seed;
const origins = provenance.entries as Record<"quy" | "ayr", Record<string, { origin: string; humanReviewed: boolean; researchOnly: boolean; provider?: string }>>;

function currentScreenSources(): string[] {
  const sources = new Set<string>(LANGUAGE_UI_TEXTS);
  const files = ["components/i18n/LanguagesPage.tsx", "components/i18n/LanguageSelector.tsx", "components/FamilyShell.tsx", "components/periodico/QuizAudioPanel.tsx", "components/periodico/VoiceMascot.tsx", "lib/browser/quiz-microphone.ts"];
  for (const file of files) {
    const source = ts.createSourceFile(file, readFileSync(join(process.cwd(), "src", file), "utf8"), ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const values = (node: ts.Node) => {
      if (ts.isStringLiteral(node)) sources.add(node.text);
      else if (ts.isConditionalExpression(node)) { values(node.whenTrue); values(node.whenFalse); }
      else if (ts.isAsExpression(node) || ts.isParenthesizedExpression(node)) values(node.expression);
    };
    const visit = (node: ts.Node) => {
      if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(source) === "TranslatedText") {
        for (const attribute of node.attributes.properties) if (ts.isJsxAttribute(attribute) && attribute.name.getText(source) === "text" && attribute.initializer) {
          if (ts.isJsxExpression(attribute.initializer)) { if (attribute.initializer.expression) values(attribute.initializer.expression); }
          else values(attribute.initializer);
        }
      }
      if (ts.isCallExpression(node)) {
        const name = ts.isIdentifier(node.expression) ? node.expression.text : ts.isPropertyAccessExpression(node.expression) ? node.expression.name.text : "";
        if (name === "t" && node.arguments[0]) values(node.arguments[0]);
        if (["emit", "pause", "fail"].includes(name) && node.arguments[name === "emit" ? 1 : 0]) values(node.arguments[name === "emit" ? 1 : 0]);
      }
      if (ts.isPropertyAssignment(node) && ["message", "label"].includes(node.name.getText(source))) values(node.initializer);
      if (ts.isParameter(node) && node.name.getText(source) === "message" && node.initializer) values(node.initializer);
      if (ts.isVariableDeclaration(node) && ["MASCOT_TEXT", "SHELL_TEXTS"].includes(node.name.getText(source)) && node.initializer) {
        const all = (child: ts.Node) => { if (ts.isStringLiteral(child)) sources.add(child.text); else ts.forEachChild(child, all); };
        all(node.initializer);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return [...sources];
}

describe("deterministic current-screen public dictionaries", () => {
  it("uses native selector, heading and warning drafts without the rejected Spanish provider fragments", () => {
    expect(dictionaries.quy.Idioma).toBe("Simi"); expect(dictionaries.ayr.Idioma).toBe("Aru");
    const sources = ["Texto y voz, en tu idioma", "Revisa la transcripción. La traducción asistida y la emoción de la mascota son experimentales; no son una evaluación."];
    for (const language of ["quy", "ayr"] as const) for (const source of sources) {
      expect(dictionaries[language][source]).not.toMatch(/Idioma|Traducción|asistida|experimental|evaluar|animalia/iu);
      expect(origins[language][source].origin).toBe("AI-drafted");
      expect(origins[language][source].humanReviewed).toBe(false);
      expect("provider" in origins[language][source]).toBe(false);
    }
  });
  it.each(["quy", "ayr"] as const)("covers full /lenguas, expanded help, microphone statuses, shell and condor in %s without inference", async (language) => {
    vi.useFakeTimers();
    try {
      const sources = currentScreenSources();
      const missing = sources.filter((source) => !Object.hasOwn(dictionaries[language], source));
      expect(missing).toEqual([]);
      const translate = vi.fn();
      const store = new PublicTranslationStore(translate, seed);
      store.register(sources); store.setLanguage(language); await store.flush();
      expect(store.getSnapshot().translationStatus).toBe("ready");
      expect(translate).not.toHaveBeenCalled();
      expect(sources.every((source) => store.t(source).trim())).toBe(true);
    } finally { vi.clearAllTimers(); vi.useRealTimers(); }
  });
  it("keeps every seed source public and records truthful unreviewed provenance", () => {
    const allowed = new Set(PUBLIC_UI_TEXTS);
    expect(provenance.humanReviewed).toBe(false); expect(provenance.researchOnly).toBe(true);
    for (const language of ["quy", "ayr"] as const) {
      for (const source of PRIORITY_UI_TEXTS) {
        expect(allowed.has(source), source).toBe(true);
        expect(dictionaries[language][source].trim(), source).not.toBe("");
        const record = origins[language][source];
        expect(record.humanReviewed).toBe(false); expect(record.researchOnly).toBe(true);
        if (record.origin === "AI-drafted") expect("provider" in record).toBe(false);
        if (source === dictionaries[language][source]) expect(["min", "Entiendo"]).toContain(source);
      }
    }
  });
});
