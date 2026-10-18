import { describe, expect, it } from "vitest";
import { calcularRacha, textoRacha } from "./racha";

// Domingo 18 de octubre de 2026, hora local. La semana empieza el lunes 12.
const HOY = new Date(2026, 9, 18, 20);
const dia = (d: number, h = 10) => new Date(2026, 9, d, h).toISOString();

describe("calcularRacha", () => {
  it("sin noticias terminadas no hay racha", () => {
    const r = calcularRacha([], HOY);
    expect(r).toMatchObject({ dias: 0, mejor: 0, estado: "ninguna", marca: null });
    expect(textoRacha(r)).toBe("Termina una noticia para empezar tu racha");
  });

  it("cuenta días seguidos con al menos una noticia y marca los 3 días", () => {
    const r = calcularRacha([dia(16), dia(17), dia(18), dia(18, 11)], HOY);
    expect(r).toMatchObject({ dias: 3, estado: "hoy", marca: 3 });
    expect(r.semana.map((s) => s.leyo)).toEqual([false, false, false, false, true, true, true]);
  });

  it("si todavía no leyó hoy, la racha sigue viva", () => {
    const r = calcularRacha([dia(16), dia(17)], HOY);
    expect(r).toMatchObject({ dias: 2, estado: "seguir" });
    expect(textoRacha(r)).toBe("Lee una noticia hoy para llegar a 3");
  });

  it("un día sin leer usa el día de gracia de la semana y la racha queda en pausa", () => {
    const r = calcularRacha([dia(15), dia(16)], HOY);
    expect(r).toMatchObject({ dias: 2, estado: "pausa" });
    expect(r.semana[5]).toMatchObject({ dia: "S", gracia: true });
    expect(calcularRacha([dia(15), dia(16), dia(18)], HOY)).toMatchObject({ dias: 3, estado: "hoy" });
  });

  it("solo hay un día de gracia por semana; el segundo hueco se recupera con 2 noticias hoy", () => {
    const fechas = [dia(13), dia(15), dia(16)]; // falta el 14 (gracia) y el 17
    expect(calcularRacha(fechas, HOY)).toMatchObject({ dias: 3, estado: "recuperar", faltanHoy: 2 });
    expect(calcularRacha([...fechas, dia(18)], HOY)).toMatchObject({ estado: "recuperar", faltanHoy: 1 });
    expect(calcularRacha([...fechas, dia(18), dia(18, 12)], HOY)).toMatchObject({ dias: 4, estado: "hoy" });
  });

  it("si no la recuperó, empieza de nuevo pero guarda la mejor racha", () => {
    // Del 5 al 9 leyó 5 días; el 10 usa la gracia; el 11 y el 12 no lee y el 12 no hubo 2 noticias.
    const fechas = [dia(5), dia(6), dia(7), dia(8), dia(9), dia(17)];
    const r = calcularRacha(fechas, HOY);
    expect(r).toMatchObject({ dias: 1, mejor: 5, estado: "seguir" });
    expect(textoRacha(calcularRacha([dia(5), dia(6)], HOY))).toBe("Empieza otra racha hoy");
  });

  it("cambia de semana: la gracia se renueva cada lunes", () => {
    // Domingo 11 sin leer (gracia de la semana del 5), lunes 12 lee, martes 13 sin leer (gracia nueva).
    const r = calcularRacha([dia(9), dia(10), dia(12), dia(14), dia(15), dia(16), dia(17), dia(18)], HOY);
    expect(r).toMatchObject({ dias: 8, estado: "hoy", marca: null });
  });
});
