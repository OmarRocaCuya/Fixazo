import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { QuizAudioPanel } from "./QuizAudioPanel";

describe("quiz audio admission", () => {
  it("renders manual use and explicit foreground controls without capturing or requesting on mount", () => {
    const request = vi.fn(), getUserMedia = vi.fn(), transcript = vi.fn(), access = vi.fn();
    vi.stubGlobal("fetch", request); vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
    try {
      const html = renderToStaticMarkup(createElement(QuizAudioPanel, { stepId: "pregunta-1", onTranscript: transcript, onAccessChange: access }));
      expect(request).not.toHaveBeenCalled(); expect(getUserMedia).not.toHaveBeenCalled();
      expect(transcript).not.toHaveBeenCalled(); expect(access).not.toHaveBeenCalled();
      expect(html).toContain("Iniciar micrófono del quiz"); expect(html).toContain("Pausar micrófono");
      expect(html).toContain("Código privado de la demo"); expect(html).not.toContain("Soy adulto");
      expect(html).toContain("solo al pulsar Iniciar");
      expect(html).toContain("tú las confirmas"); expect(html).toContain("10 minutos");
      expect(html).toContain("No se infieren emociones"); expect(html).toContain("no se reactiva solo");
      expect(html).not.toContain('checked=""');
    } finally { vi.unstubAllGlobals(); }
  });
});
