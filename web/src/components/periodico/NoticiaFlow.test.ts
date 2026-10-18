import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BloqueOpciones, BloqueVoz, type RevisionVoz } from "./NoticiaFlow";

describe("newspaper voice question admission", () => {
  const p = { tipo: "voz" as const, id: "voz", etiqueta: "Explica", titulo: "¿Por qué?", habilidad: "Usar evidencia", pistas: ["Busca una razón"] };
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
  it("restores the in-memory draft, feedback and evaluated count for a supported reread", () => {
    const revisionVoz: RevisionVoz = {
      preguntaId: p.id, texto: "Mi explicación con evidencia", porVoz: true, intentos: 1,
      retro: { texto: "Falta relacionar la fuente.", bien: false, evaluada: true }, finalizada: false,
    };
    const render = () => renderToStaticMarkup(createElement(BloqueVoz, { p, noticiaId: "n", onFin: () => {}, revisionVoz, onVolverAlTexto: () => {} }));
    for (const html of [render(), render()]) {
      expect(html).toContain("Mi explicación con evidencia");
      expect(html).toContain("Falta relacionar la fuente.");
      expect(html).toContain("1 de 2 intentos evaluados");
      expect(html).toContain("Volver al texto");
    }
  });
  it.each([{ bien: true, evaluada: true }, { bien: false, evaluada: false }])("does not offer feedback reread for correct or unavailable evaluations: %s", (retro) => {
    const html = renderToStaticMarkup(createElement(BloqueVoz, {
      p, noticiaId: "n", onFin: () => {}, onVolverAlTexto: () => {},
      revisionVoz: { preguntaId: p.id, texto: "Borrador", porVoz: false, intentos: retro.evaluada ? 1 : 0, retro: { texto: "Retroalimentación", ...retro }, finalizada: false },
    }));
    expect(html).not.toContain("Volver al texto");
  });
  it("does not restore another question's draft or attempts", () => {
    const html = renderToStaticMarkup(createElement(BloqueVoz, {
      p, noticiaId: "n", onFin: () => {}, onVolverAlTexto: () => {},
      revisionVoz: { preguntaId: "otra", texto: "No debe filtrarse", porVoz: false, intentos: 1, retro: { texto: "Otro resultado", bien: false, evaluada: true }, finalizada: false },
    }));
    expect(html).not.toContain("No debe filtrarse");
    expect(html).not.toContain("intentos evaluados");
    expect(html).not.toContain("Volver al texto");
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
  it("offers an explicit reread only after an active, evaluated incorrect choice", () => {
    const fuente = { tipo: "fragmento" as const, lado: "a" as const, medio: "Fuente", fecha: "Hoy", titular: "Fuente", texto: "Evidencia que no se despliega automáticamente.", url: "https://example.com" };
    function withChoice(intentos: number[], correcta: number | null = p.correcta, activa = true) {
      return renderToStaticMarkup(createElement(BloqueOpciones, {
        p: { ...p, correcta }, intentos, activa, apoyo: { ...apoyo, fuente }, borrador: null,
        onElegir: () => {}, onContinuar: () => {}, onVolverAlTexto: () => {},
      }));
    }
    expect(withChoice([0])).toContain("Volver al texto");
    expect(withChoice([0])).not.toContain(fuente.texto);
    expect(withChoice([0, 0])).toContain("Volver al texto");
    for (const html of [withChoice([]), withChoice([1]), withChoice([0], null), withChoice([0], 1, false)]) expect(html).not.toContain("Volver al texto");
  });
});
