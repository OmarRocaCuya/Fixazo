import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BloqueVoz } from "./NoticiaFlow";

describe("newspaper voice question admission", () => {
  it("keeps manual reading usable without an enabled judge and never captures or submits on render", () => {
    const request = vi.fn(); const getUserMedia = vi.fn();
    vi.stubGlobal("fetch", request); vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
    try {
      const html = renderToStaticMarkup(createElement(BloqueVoz, {
        p: { tipo: "voz", id: "voz", etiqueta: "Explica", titulo: "¿Por qué?", habilidad: "Usar evidencia", pistas: ["Busca una razón"] },
        noticiaId: "ejemplo", onFin: () => {},
      }));
      expect(request).not.toHaveBeenCalled(); expect(getUserMedia).not.toHaveBeenCalled();
      expect(html).toContain("Continuar sin evaluación");
      expect(html).toContain("demo solo para adultos");
      expect(html).toContain("micrófono es opcional");
      expect(html).not.toContain("Pedir evaluación de mi respuesta");
      expect(html).not.toContain("Para practicar");
      expect(html).not.toContain('aria-label="Empezar a hablar"');
    } finally { vi.unstubAllGlobals(); }
  });
});
