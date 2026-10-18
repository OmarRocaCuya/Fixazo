import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { QuizAudioHelp, QuizAudioPanel } from "./QuizAudioPanel";

describe("quiz audio admission", () => {
  it("renders manual use and explicit foreground controls without capturing or requesting on mount", () => {
    const request = vi.fn(), getUserMedia = vi.fn(), transcript = vi.fn(), access = vi.fn();
    vi.stubGlobal("fetch", request); vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
    try {
      const html = renderToStaticMarkup(createElement(QuizAudioPanel, { stepId: "pregunta-1", onTranscript: transcript, onAccessChange: access }));
      expect(request).not.toHaveBeenCalled(); expect(getUserMedia).not.toHaveBeenCalled();
      expect(transcript).not.toHaveBeenCalled(); expect(access).not.toHaveBeenCalled();
      expect(html).toContain("Iniciar micrófono del quiz"); expect(html).toContain("Pausar micrófono");
      expect(html).not.toContain("Código privado de la demo"); expect(html).not.toContain("Soy adulto");
      expect(html).toContain("Cómo funciona el micrófono");
      expect(html).toContain("Se envía audio para transcribir y estimar emoción. No se guarda la grabación.");
      for (const technical of ["solo al pulsar Iniciar", "tú las confirmas", "10 minutos", "estimación experimental de emociones", "No se infieren identidad", "no se reactiva solo"]) expect(html).not.toContain(technical);
      expect(html).not.toContain('checked=""');
    } finally { vi.unstubAllGlobals(); }
  });
  it("mounts all four unchanged technical explanations only when help is expanded", () => {
    expect(renderToStaticMarkup(createElement(QuizAudioHelp, { expanded: false }))).toBe("");
    const html = renderToStaticMarkup(createElement(QuizAudioHelp, { expanded: true }));
    expect(html.match(/<p(?: |>|\b)/g)).toHaveLength(4);
    for (const technical of ["solo al pulsar Iniciar", "tú las confirmas", "10 minutos", "estimación experimental de emociones", "No se infieren identidad", "no se reactiva solo", "Al cambiar de pregunta se descarta"]) expect(html).toContain(technical);
  });
});
