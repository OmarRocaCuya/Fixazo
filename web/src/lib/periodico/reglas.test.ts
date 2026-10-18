import { describe, expect, it } from "vitest";
import { agregarCorridas, citaValida, guardia, normalizar, revisarTexto, validarCriterios } from "./reglas";
import type { Criterio } from "./tipos";

const criterios: Criterio[] = [
  { id: "quien_gana", nombre: "Quién gana", descripcion: "", ejemploCumple: "", ejemploNoCumple: "", repregunta: "¿Quién habla?" },
  { id: "otra_mirada", nombre: "La otra mirada", descripcion: "", ejemploCumple: "", ejemploNoCumple: "", repregunta: "¿Y el otro?" },
];

describe("reglas del periódico", () => {
  it("normaliza tildes, signos y mayúsculas", () => {
    expect(normalizar("¡Da un poco de MIEDO, ¿no?!")).toBe("da un poco de miedo no");
  });

  it("solo acepta citas que están literal en la respuesta del alumno", () => {
    const t = "El primero es de una agencia que vende anuncios, le conviene.";
    expect(citaValida("es de una agencia que vende anuncios", t)).toBe(true);
    expect(citaValida("piensa en la privacidad", t)).toBe(false);
    expect(citaValida("", t)).toBe(false);
  });

  it("no gasta IA en respuestas cortas o que piden la solución", () => {
    expect(revisarTexto("no sé, dime tú")).toBe("pide");
    expect(revisarTexto("porque sí")).toBe("corta");
    expect(revisarTexto("porque uno vende anuncios y el otro piensa en los usuarios")).toBeNull();
  });

  it("descarta criterios sin cita literal y los marca dudosos", () => {
    const r = validarCriterios(
      [
        { id: "quien_gana", cumple: true, cita: "es de una agencia" },
        { id: "otra_mirada", cumple: true, cita: "piensa en los datos" },
      ],
      criterios,
      "El primero es de una agencia que vende anuncios.",
    );
    expect(r.map((c) => [c.id, c.cumple, c.dudoso])).toEqual([["quien_gana", true, false], ["otra_mirada", false, true]]);
  });

  it("la guardia bloquea la retroalimentación que revela la respuesta", () => {
    const prohibido = ["agencia", "privacidad"];
    expect(guardia("¿Quién habla en el primer texto?", prohibido, "porque piensan distinto")).toBe(true);
    expect(guardia("El primero es una agencia.", prohibido, "porque piensan distinto")).toBe(false);
    expect(guardia("Bien: dices que es una agencia.", prohibido, "es una agencia")).toBe(true);
    expect(guardia("", prohibido, "")).toBe(false);
  });

  it("con 3 corridas: gana la mayoría con cita literal y marca dudoso si no son unánimes", () => {
    const texto = "El primero es de una agencia que vende anuncios y el segundo piensa en los usuarios.";
    const corrida = (a: boolean, b: boolean) => ({
      retro: "",
      criterios: [
        { id: "quien_gana", cumple: a, cita: a ? "es de una agencia" : "" },
        { id: "otra_mirada", cumple: b, cita: b ? "piensa en los usuarios" : "" },
      ],
    });
    const r = agregarCorridas([corrida(true, true), corrida(true, false), corrida(true, true)], criterios, texto);
    expect(r.map((c) => [c.id, c.cumple, c.dudoso])).toEqual([["quien_gana", true, false], ["otra_mirada", true, true]]);
    const inventada = agregarCorridas([{ retro: "", criterios: [{ id: "quien_gana", cumple: true, cita: "habla de privacidad" }] }], criterios, texto);
    expect(inventada).toEqual([]);
    expect(agregarCorridas([], criterios, texto)).toEqual([]);
    expect(agregarCorridas([corrida(false, false)], criterios, texto)).toEqual([]);
  });
});
