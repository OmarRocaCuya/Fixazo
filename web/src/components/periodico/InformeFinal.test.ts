import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InformeFinal } from "./InformeFinal";
import type { ResultadoNoticia } from "@/lib/periodico/progreso";

describe("visible end-of-quiz report", () => {
  it("shows educational outcomes, next steps and safe sharing without a missing voice evaluation becoming failure", () => {
    const result: ResultadoNoticia = { noticiaId: "n1", titular: "Lectura", fecha: "2026-10-18", habilidades: { "Usar evidencia": true }, postura: "No exportar postura", seguridad: "No exportar seguridad", decision: null, voz: null };
    const html = renderToStaticMarkup(createElement(InformeFinal, { resultado: result }));
    expect(html).toContain("informe final");
    expect(html).toContain("Usar evidencia");
    expect(html).toContain("Sin evaluación de la explicación");
    expect(html).toContain("Compartir con un familiar");
    expect(html).not.toContain("No exportar postura"); expect(html).not.toContain("No exportar seguridad");
    expect(html).not.toContain("Para seguir practicando");
    expect(html).not.toContain("Cómo sonabas al responder"); // nothing invented without voice data
  });
  it("summarizes experimental emotion estimates and voice metrics from quiz voice answers", () => {
    const result: ResultadoNoticia = { noticiaId: "n1", titular: "Lectura", fecha: "2026-10-18", habilidades: {}, postura: null, seguridad: null, decision: null, voz: null,
      emociones: [{ pasoId: "p1", etiqueta: "neutral", confianza: "baja", fuente: "voz-emotion2vec", score: 0.5 }, { pasoId: "p2", etiqueta: "sin datos suficientes", confianza: "baja", fuente: "sin-modelo", score: null }],
      audioQuiz: { respuestas: 2, palabras: 14, pausasLargas: 1, segundosHablando: 16 } };
    const html = renderToStaticMarkup(createElement(InformeFinal, { resultado: result }));
    expect(html).toContain("Cómo sonabas al responder"); expect(html).toContain("Experimental");
    expect(html).toContain("neutral"); expect(html).toContain("Pausas largas");
    expect(html).not.toContain("sin datos suficientes");
  });
});

