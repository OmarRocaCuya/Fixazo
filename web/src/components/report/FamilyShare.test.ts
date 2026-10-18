import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FamilyShare } from "./FamilyShare";

describe("family share disclosure", () => {
  it("shows the exact safe preview and explicit fallbacks without invoking any external API on render", () => {
    const share = vi.fn(), writeText = vi.fn(), request = vi.fn();
    vi.stubGlobal("navigator", { share, clipboard: { writeText } });
    vi.stubGlobal("fetch", request);
    try {
      const html = renderToStaticMarkup(createElement(FamilyShare, { summary: { title: "Resumen", text: "Vista previa mínima", filename: "resumen.txt" } }));
      expect(html).toContain("Vista previa mínima");
      expect(html).toContain("Elegir cómo compartir"); expect(html).toContain("Copiar resumen"); expect(html).toContain("Descargar resumen");
      expect(html).toContain("ni enviamos nada automáticamente");
      expect(html).not.toContain('type="email"'); expect(html).not.toContain('type="tel"');
      expect(share).not.toHaveBeenCalled(); expect(writeText).not.toHaveBeenCalled(); expect(request).not.toHaveBeenCalled();
    } finally { vi.unstubAllGlobals(); }
  });
});

