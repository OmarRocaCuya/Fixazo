import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BloqueOpciones, BloqueVoz } from "./NoticiaFlow";

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
      expect(html).toContain("La evaluación por IA es una demo");
      expect(html).not.toContain("solo para adultos");
      expect(html.toLowerCase()).not.toContain("código privado");
      expect(html).toContain("micrófono es opcional");
      expect(html).not.toContain("Pedir evaluación de mi respuesta");
      expect(html).not.toContain("Para practicar");
      expect(html).not.toContain('aria-label="Empezar a hablar"');
    } finally { vi.unstubAllGlobals(); }
  });
});


describe("newspaper multiple-choice confirmation and support", () => {
  const p = {
    tipo: "opciones" as const, id: "n-comprension", etiqueta: "Comprende", titulo: "¿Qué incluye?",
    opciones: ["Solo precio", "Precio y envío"], correcta: 1, bien: "Relacionaste condiciones.", otra: "Mira el precio.", habilidad: "Interpretar",
  };
  const apoyo = { fase: "releer" as const, fuente: null, postura: null, mensaje: "Comprueba tu elección con este texto." };
  function render(intentos: number[], borrador: { preguntaId: string; opcion: number | null } | null = null) {
    return renderToStaticMarkup(createElement(BloqueOpciones, { p, intentos, activa: true, apoyo, borrador, onElegir: () => {}, onContinuar: () => {} }));
  }
  it("does not reveal the correct option after the first incorrect selection", () => {
    const html = render([0]);
    expect(html).not.toContain('pd-op correcta');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("Continuar con mi elección actual");
    expect(html.indexOf("Solo precio")).toBeLessThan(html.indexOf("Precio y envío"));
  });
  it("reveals authored feedback only after a correct selection or the bounded second attempt", () => {
    expect(render([1])).toContain('pd-op correcta');
    expect(render([0, 0])).toContain('pd-op correcta');
    expect(render([0, 0])).toContain("2 de 2 elecciones");
  });
  it("keeps a spoken preselection a draft, with zero attempts and Continue disabled", () => {
    const html = render([], { preguntaId: p.id, opcion: 1 });
    expect(html).toContain("Confirmar esta opción de voz");
    expect(html).toContain("0 de 2 elecciones");
    expect(html).toContain('disabled="">Continuar');
    expect(html).not.toContain('aria-pressed="true"');
    expect(html).not.toContain('pd-op correcta');
  });
  it("never treats an ambiguous voice as an answer or changes option order", () => {
    const html = render([], { preguntaId: p.id, opcion: null });
    expect(html).toContain("No pude identificar una sola opción");
    expect(html).not.toContain("Confirmar esta opción de voz");
    expect(html).toContain('disabled="">Continuar');
  });
});
