import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MultilingualReadingSession, ObservedPassageText, readingDialoguePresentation } from "./MultilingualReadingSession";

afterEach(() => { vi.unstubAllGlobals(); });

describe("adult-only multilingual reading surface", () => {
  it("labels the scripted opening separately from configured local-model turns", () => {
    const view = readingDialoguePresentation({ enabled: true, ready: false, model: "Qwen local" }, null);
    expect(view.heading).toBe("Conversación con modelo local");
    expect(view.questionLabel).toBe("Pregunta de apertura predefinida");
    expect(view.description).toContain("apertura es un guion predefinido");
    expect(view.description).toContain("siguientes turnos usarán el modelo local configurado");
    expect(view.description).toContain("aún no se ha generado");
    expect(view.description).not.toContain("no es un agente de conversación libre");
  });
  it("lets an actual guided reply override configured local-model metadata", () => {
    const view = readingDialoguePresentation({ enabled: true, ready: true, model: "Qwen local" }, { dialogueMode: "guided-reading", model: null });
    expect(view.heading).toBe("Conversación guiada por un guion");
    expect(view.questionLabel).toBe("Respuesta del agente");
    expect(view.description).toContain("no es un agente de conversación libre");
    expect(view.description).not.toContain("Qwen");
  });
  it("uses the actual returned model and mode after a local-model reply", () => {
    const view = readingDialoguePresentation({ enabled: false, ready: false, model: null }, { dialogueMode: "local-llm-reading", model: "Qwen respuesta real" });
    expect(view.heading).toBe("Conversación con modelo local");
    expect(view.questionLabel).toBe("Respuesta del agente");
    expect(view.description).toContain("Qwen respuesta real");
    expect(view.description).toContain("Esta respuesta proviene del modelo local");
    expect(view.description).not.toContain("aún no se ha generado");
  });
  it("does not claim a local model before a reply when one is not configured", () => {
    const view = readingDialoguePresentation(undefined, null);
    expect(view.heading).toBe("Conversación guiada por un guion");
    expect(view.questionLabel).toBe("Pregunta de apertura predefinida");
    expect(view.description).toContain("preguntas programadas");
  });
  it("renders an opt-in form without sending a passage or opening the microphone", () => {
    const request = vi.fn(); const getUserMedia = vi.fn();
    vi.stubGlobal("fetch", request);
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
    const markup = renderToStaticMarkup(createElement(MultilingualReadingSession, { passage: "Rosa fue al río.", title: "La misión", onClose: () => {} }));
    expect(request).not.toHaveBeenCalled(); expect(getUserMedia).not.toHaveBeenCalled();
    expect(markup).toContain("Demo adulta no comercial");
    expect(markup).toContain("solo voz adulta o sintética");
    expect(markup).toContain("según el modelo realmente habilitado");
    expect(markup).toContain('type="password"');
    expect(markup).toContain('value="quy_Latn"'); expect(markup).toContain('value="ayr_Latn"');
    expect(markup).not.toContain('value="quz_Latn"'); expect(markup).not.toContain('value="spa_Latn"');
    expect(markup).not.toContain("Comenzar lectura con micrófono");
  });
  it("does not color skipped words or imply a fully read prefix", () => {
    const markup = renderToStaticMarkup(createElement(ObservedPassageText, { passage: "Rosaqa tutapayta mayuman rirqa.", language: "quy_Latn", observed: [2, 3] }));
    expect(markup).toMatch(/data-observed="false">Rosaqa/);
    expect(markup).toMatch(/data-observed="false">tutapayta/);
    expect(markup).toMatch(/data-observed="true">mayuman/);
    expect(markup).toMatch(/data-observed="true">rirqa\./);
    expect(markup).toContain('lang="quy"');
  });
  it("does not create observed marks from elapsed time or missing evidence", () => {
    const markup = renderToStaticMarkup(createElement(ObservedPassageText, { passage: "Jach’a jawira.", language: "ayr_Latn", observed: [] }));
    expect(markup).not.toContain('data-observed="true"');
    expect(markup).toContain('lang="ayr"');
    expect(markup).not.toContain("diff");
  });
});
