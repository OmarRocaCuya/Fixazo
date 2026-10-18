import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MultilingualReadingSession, ObservedPassageText } from "./MultilingualReadingSession";

afterEach(() => { vi.unstubAllGlobals(); });

describe("adult-only multilingual reading surface", () => {
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
