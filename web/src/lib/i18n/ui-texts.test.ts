import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { LEARNING_UI_TEXTS } from "@/components/aprendizaje/copy";
import { PUBLIC_UI_TEXTS } from "./ui-texts";

const SOURCE_PATHS = [
  "components/i18n/LanguageProvider.tsx", "components/i18n/LanguageSelector.tsx", "components/i18n/LanguagesPage.tsx",
  "components/FamilyShell.tsx", "components/periodico/NavPeriodico.tsx", "components/periodico/EstadoNoticia.tsx",
  "components/aprendizaje/LearningWorkspace.tsx", "components/aprendizaje/StudyMap.tsx", "components/aprendizaje/StudyResults.tsx",
  "components/periodico/LecturaNoticia.tsx", "components/periodico/NoticiaFlow.tsx", "components/periodico/QuizAudioPanel.tsx",
  "components/periodico/VoiceMascot.tsx", "components/periodico/Reveladas.tsx", "components/periodico/Racha.tsx",
  "lib/browser/quiz-microphone.ts", "lib/periodico/racha.ts",
  "app/page.tsx", "app/noticia/[id]/page.tsx", "app/insights/page.tsx", "app/(familia)/chat/page.tsx",
] as const;

/** Read AST literals, not quote-pair regexes: object properties and multiline
 * JSX must not swallow an actual message or admit class names as UI text. */
function renderedLiterals(path: string, text: string): Set<string> {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const result = new Set<string>();
  const literals = (node: ts.Node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) result.add(node.text);
    else if (ts.isConditionalExpression(node)) { literals(node.whenTrue); literals(node.whenFalse); }
    else if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) literals(node.expression);
  };
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const name = ts.isIdentifier(node.expression) ? node.expression.text : ts.isPropertyAccessExpression(node.expression) ? node.expression.name.text : "";
      if (name === "t" && node.arguments[0]) literals(node.arguments[0]);
      // QuizAudioPanel renders state.message and capability.message directly.
      if ((path.endsWith("QuizAudioPanel.tsx") || path.endsWith("quiz-microphone.ts")) && ["pause", "fail", "emit"].includes(name)) {
        const argument = node.arguments[name === "emit" ? 1 : 0];
        if (argument) literals(argument);
      }
    }
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(source) === "TranslatedText") {
      for (const attribute of node.attributes.properties) {
        if (!ts.isJsxAttribute(attribute) || attribute.name.getText(source) !== "text" || !attribute.initializer) continue;
        if (ts.isJsxExpression(attribute.initializer)) { if (attribute.initializer.expression) literals(attribute.initializer.expression); }
        else literals(attribute.initializer);
      }
    }
    if ((path.endsWith("QuizAudioPanel.tsx") || path.endsWith("quiz-microphone.ts")) && ts.isPropertyAssignment(node) && node.name.getText(source) === "message") literals(node.initializer);
    if (path.endsWith("quiz-microphone.ts") && ts.isParameter(node) && node.name.getText(source) === "message" && node.initializer) literals(node.initializer);
    // These closed public dictionaries feed dynamic JSX or are registered as a
    // whole. Learner drafts/answers and arbitrary dynamic data are not included.
    if (ts.isVariableDeclaration(node) && ["MASCOT_TEXT", "PASOS", "TEXTO"].includes(node.name.getText(source)) && node.initializer) {
      const values = (value: ts.Node) => {
        if (ts.isStringLiteral(value)) result.add(value.text);
        else if (ts.isPropertyAssignment(value)) values(value.initializer);
        else ts.forEachChild(value, values);
      };
      values(node.initializer);
    }
    if (path.endsWith("NavPeriodico.tsx") && ts.isPropertyAssignment(node) && node.name.getText(source) === "label") literals(node.initializer);
    // Racha's seguir sentence contains a number and is assembled from translated
    // pieces in JSX; the other return values are fixed public status messages.
    if (path.endsWith("lib/periodico/racha.ts") && ts.isReturnStatement(node) && node.expression) literals(node.expression);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return result;
}

describe("public UI translation allowlist contract", () => {
  it("registers the learning workspace's closed static copy and honest entry points", () => {
    expect(LEARNING_UI_TEXTS.length).toBeGreaterThan(0);
    for (const text of LEARNING_UI_TEXTS) expect(PUBLIC_UI_TEXTS).toContain(text);
    for (const text of [
      "Transformaciones",
      "Trabaja con tu propio texto fuera del chat. Crea un mapa de aprendizaje y consulta sus evidencias.",
      "Abrir Transformaciones",
      "No importa materiales ni se conecta con cuentas de otras plataformas.",
    ]) expect(PUBLIC_UI_TEXTS).toContain(text);
    // Arbitrary source/title/draft values never enter this closed interface set.
    for (const privateText of ["Mi fuente privada: 9382", "Borrador personal del estudiante 73", "Respuesta privada: 1902"]) expect(PUBLIC_UI_TEXTS).not.toContain(privateText);
  });
  it("allows the newspaper methodology and optional floating insights labels", () => {
    for (const text of [
      "Metodología de lectura",
      "Practica con las preguntas y vuelve al texto cuando lo necesites. Tu avance se conserva en este navegador.",
      "Retomar metodología",
      "La metodología está en pausa mientras consultas los insights.",
      "La metodología está en pausa para que puedas releer el artículo.",
      "Insights de esta lectura",
      "Cerrar insights",
      "Ayudas adaptadas al tipo de texto, con citas y enlaces a las fuentes.",
      "No hay apoyos disponibles para esta noticia. Puedes releer el texto original.",
    ]) expect(PUBLIC_UI_TEXTS).toContain(text);
  });
  it("contains every actual rendered public literal, including dynamic mic messages and conditional JSX", () => {
    const allowed = new Set(PUBLIC_UI_TEXTS);
    const missing: string[] = [];
    for (const path of SOURCE_PATHS) {
      for (const text of renderedLiterals(path, readFileSync(join(process.cwd(), "src", path), "utf8"))) {
        if (!allowed.has(text)) missing.push(`${path}: ${text}`);
      }
    }
    expect(missing).toEqual([]);
  });
  it("recognizes the initial microphone message even beside status and timer literals", () => {
    const source = 'const INITIAL = {status: "idle", remainingSeconds: 0, message: "Micrófono apagado. Puedes completar el quiz escribiendo o tocando las opciones."};';
    expect([...renderedLiterals("QuizAudioPanel.tsx", source)]).toEqual(["Micrófono apagado. Puedes completar el quiz escribiendo o tocando las opciones."]);
  });
  it("includes both literal branches and registered mascot statuses, not implementation fragments", () => {
    const source = 'const MASCOT_TEXT = ["Escuchando", "Estimación de voz"] as const; const view = <TranslatedText text={active ? "Iniciar" : "Pausar"} />; t(hidden ? "Mostrar" : "Ocultar");';
    expect([...renderedLiterals("VoiceMascot.tsx", source)]).toEqual(["Escuchando", "Estimación de voz", "Iniciar", "Pausar", "Mostrar", "Ocultar"]);
    for (const accidental of ["use client", ", remainingSeconds: 0, message: ", "pd-bloque pd-pregunta", "muted small", "btn primary", "btn ghost"]) expect(PUBLIC_UI_TEXTS).not.toContain(accidental);
  });
});
