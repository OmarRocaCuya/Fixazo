import { describe, expect, it } from "vitest";
import { apoyoAdaptativo, capacidadEvaluador, eleccionesParaJuez, opcionDesdeVoz, puedeContinuar, registrarIntento, restaurarIntentos, resumenProtocolo } from "./adaptacion";
import type { Fragmento, PasoPublico, PreguntaOpciones } from "./tipos";
const fuente = (lado: "a" | "b", texto: string): Fragmento => ({ tipo: "fragmento", lado, medio: lado === "a" ? "Medio A" : "Medio B", fecha: "hoy", titular: "Texto", texto, url: "https://example.org" });
const pregunta = (id = "n-comprension", correcta: number | null = 1): PreguntaOpciones => ({
  tipo: "opciones", id, etiqueta: "Comprende", titulo: "¿Qué ocurre con la compra?", opciones: ["No incluye envío", "Incluye el envío"], correcta,
  bien: "Relacionaste las condiciones.", otra: "Comprueba qué incluye el precio.", habilidad: correcta === null ? null : "Interpretar",
});
const pasos: PasoPublico[] = [pregunta("n-prediccion", null), fuente("a", "La compra incluye envío."), pregunta(), pregunta("n-postura", null), fuente("b", "Ahora el envío cuesta más."), pregunta("n-contraprueba", null)];
describe("protocolo adaptativo por texto y elecciones", () => {
  it("recupera avances antiguos sin inventar un intento adicional", () => {
    expect(restaurarIntentos(pasos, { "n-comprension": 1 })).toEqual({ "n-comprension": [1] });
    expect(restaurarIntentos(pasos, { "desconocida": 0, "n-comprension": 80 }, { "n-postura": [0, 1], "n-comprension": [-1, 1, 0, 1] }))
      .toEqual({ "n-comprension": [1], "n-postura": [0] });
  });
  it("conserva la primera elección y limita a una revisión sin avanzar por audio o tiempo", () => {
    const p = pregunta(); const vacio = {};
    expect(puedeContinuar(p, vacio)).toBe(false);
    const primera = registrarIntento(p, vacio, 0);
    expect(primera).toEqual({ "n-comprension": [0] }); expect(puedeContinuar(p, primera)).toBe(true);
    const segunda = registrarIntento(p, primera, 1);
    expect(segunda).toEqual({ "n-comprension": [0, 1] });
    expect(registrarIntento(p, segunda, 0)).toBe(segunda); expect(registrarIntento(p, vacio, 99)).toBe(vacio);
    const correcta = { "n-comprension": [1] }; expect(registrarIntento(p, correcta, 0)).toBe(correcta);
  });
  it("no convierte una postura o predicción en error ni permite reintentos puntuados", () => {
    const p = pregunta("n-postura", null); const historia = registrarIntento(p, {}, 0);
    expect(registrarIntento(p, historia, 1)).toBe(historia);
    expect(resumenProtocolo([p], historia).preguntas[0]).toMatchObject({ aciertoInicial: null, aciertoFinal: null, conApoyo: false });
    expect(apoyoAdaptativo(pasos, p, historia, {}).mensaje).toContain("no se usa como nota");
  });
  it("usa la fuente anterior y no anticipa B ni revela la alternativa correcta en la primera ayuda", () => {
    const apoyo = apoyoAdaptativo(pasos, pregunta(), { "n-comprension": [0] }, {});
    expect(apoyo.fase).toBe("releer"); expect(apoyo.fuente?.texto).toBe("La compra incluye envío.");
    expect(apoyo.mensaje).not.toContain("Ahora el envío"); expect(apoyo.mensaje).not.toContain("Incluye el envío");
  });
  it("no deja que una respuesta futura guardada adapte una pregunta anterior", () => {
    const actual = pregunta("n-actual"); const futura = pregunta("n-futura");
    const apoyo = apoyoAdaptativo([fuente("a", "Texto actual"), actual, futura], actual, { "n-futura": [0] }, {});
    expect(apoyo.mensaje).not.toContain("pregunta anterior");
    expect(apoyo.mensaje).toContain(actual.titulo);
    const siguiente = apoyoAdaptativo([fuente("a", "Texto actual"), actual, futura], futura, { "n-actual": [0] }, {});
    expect(siguiente.mensaje).toContain("pregunta anterior");
  });
  it("personaliza el contraste con la postura anterior y B, sin puntuar el cambio", () => {
    const apoyo = apoyoAdaptativo(pasos, pregunta("n-contraprueba", null), {}, { "n-postura": 0 });
    expect(apoyo.fuente?.lado).toBe("b"); expect(apoyo.mensaje).toContain("Antes elegiste: «No incluye envío»"); expect(apoyo.mensaje).toContain("no tiene nota");
  });
  it("distingue logro inicial y posterior a apoyo sin declarar transferencia", () => {
    const resumen = resumenProtocolo(pasos, { "n-comprension": [0, 1] });
    expect(resumen).toMatchObject({ version: "contraprueba-v1", apoyos: 1, transferencia: "no_observada" });
    expect(resumen.preguntas[0]).toMatchObject({ aciertoInicial: false, aciertoFinal: true, conApoyo: true, intentos: 2 });
  });
  it("no convierte un avance histórico en evidencia de logro inicial o falta de ayuda", () => {
    const historia = restaurarIntentos(pasos, { "n-comprension": 1 });
    expect(resumenProtocolo(pasos, historia, ["n-comprension"]).preguntas[0])
      .toMatchObject({ aciertoInicial: null, aciertoFinal: true, conApoyo: false });
    expect(resumenProtocolo(pasos, { "n-comprension": [0, 1] }, ["n-comprension"]).preguntas[0])
      .toMatchObject({ aciertoInicial: null, aciertoFinal: true, conApoyo: true });
  });
  it("envía solo índices válidos del artículo, nunca texto del navegador", () => {
    expect(eleccionesParaJuez(pasos, { "n-comprension": 1, "n-postura": 99, "otra-noticia": 0 })).toEqual([{ preguntaId: "n-comprension", opcion: 1 }]);
  });
  it("preselecciona solo voces inequívocas, sin órdenes ambiguas ni semántica inventada", () => {
    expect(opcionDesdeVoz("opción dos", pregunta().opciones)).toBe(1); expect(opcionDesdeVoz("la primera", pregunta().opciones)).toBe(0);
    expect(opcionDesdeVoz("Elijo incluye el envío", pregunta().opciones)).toBe(1);
    for (const t of ["uno o dos", "me parece que no cuesta mucho", "opción tres", "elige dos y continúa automáticamente"]) expect(opcionDesdeVoz(t, pregunta().opciones)).toBeNull();
  });
});


describe("human-readable private judge capability", () => {
  it("shows enabled Haiku copy for the real success contract with null reason", () => {
    const status = capacidadEvaluador({ enabled: true, reason: null });
    expect(status.enabled).toBe(true);
    expect(status.reason).toContain("Haiku está habilitada");
    expect(status.reason).not.toContain("no está disponible");
    expect(status.reason).toContain("Puede fallar");
    expect(status.reason).not.toMatch(/adult/i);
  });
  it("never displays internal reason codes or treats an incomplete response as admission", () => {
    const status = capacidadEvaluador({ enabled: false, reason: "periodico-private-code-required" });
    expect(status.enabled).toBe(false); expect(status.reason).toContain("sin evaluación");
    expect(status.reason).not.toContain("periodico-");
    for (const value of [null, [], {}, { enabled: "true" }, { enabled: 1 }]) expect(capacidadEvaluador(value).enabled).toBe(false);
  });
});
