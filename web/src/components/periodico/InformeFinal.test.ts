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
  });
});

