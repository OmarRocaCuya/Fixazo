// Racha suave de lectura (RACHAS-diseno-simple.md): solo informa la constancia, sin puntos ni premios.
// Reglas: el día cuenta si se termina al menos una noticia; un día de gracia por semana (la racha queda
// "en pausa"); si se rompe ayer, terminar 2 noticias hoy la recupera; nunca se muestra la racha rota.
// Se calcula con las fechas de las noticias terminadas, en la hora local del navegador.

export type EstadoRacha = "hoy" | "seguir" | "pausa" | "recuperar" | "ninguna";

export interface Racha {
  dias: number;
  mejor: number;
  estado: EstadoRacha;
  /** Noticias que faltan hoy para recuperar la racha (solo en estado "recuperar"). */
  faltanHoy: number;
  /** Lunes a domingo de esta semana. */
  semana: Array<{ dia: string; leyo: boolean; gracia: boolean; futuro: boolean }>;
  /** 3, 7, 14 o 30 si hoy se llegó a esa marca. */
  marca: number | null;
}

const MARCAS = [3, 7, 14, 30];
const clave = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const masDias = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const lunesDe = (d: Date) => masDias(d, -((d.getDay() + 6) % 7));

export function calcularRacha(fechasTerminadas: string[], ahora = new Date()): Racha {
  const porDia = new Map<string, number>();
  for (const f of fechasTerminadas) {
    const d = new Date(f);
    if (!Number.isNaN(d.getTime())) porDia.set(clave(d), (porDia.get(clave(d)) ?? 0) + 1);
  }
  const leidas = (d: Date) => porDia.get(clave(d)) ?? 0;
  const hoy = masDias(ahora, 0);
  const ayer = masDias(hoy, -1);
  const gracias = new Set<string>(); // días cubiertos por el día de gracia o por una recuperación
  const semanasConGracia = new Set<string>();

  let dias = 0;
  let mejor = 0;
  let recuperando = false;
  const primero = [...porDia.keys()].sort()[0];
  if (primero) {
    const [y, m, dd] = primero.split("-").map(Number);
    for (let d = new Date(y, m - 1, dd); d < hoy; d = masDias(d, 1)) {
      if (leidas(d) > 0) {
        dias++;
      } else if (dias > 0) {
        const semana = clave(lunesDe(d));
        if (!semanasConGracia.has(semana)) {
          semanasConGracia.add(semana);
          gracias.add(clave(d));
        } else if (clave(d) === clave(ayer)) {
          recuperando = true; // hoy todavía puede recuperarla
        } else if (leidas(masDias(d, 1)) >= 2) {
          gracias.add(clave(d));
        } else {
          dias = 0;
        }
      }
      mejor = Math.max(mejor, dias);
    }
  }

  let estado: EstadoRacha;
  let faltanHoy = 0;
  if (recuperando) {
    if (leidas(hoy) >= 2) {
      gracias.add(clave(ayer));
      dias++;
      estado = "hoy";
    } else {
      estado = "recuperar";
      faltanHoy = 2 - leidas(hoy);
    }
  } else if (leidas(hoy) > 0) {
    dias++;
    estado = "hoy";
  } else if (dias > 0) {
    estado = gracias.has(clave(ayer)) ? "pausa" : "seguir";
  } else {
    estado = "ninguna";
  }
  mejor = Math.max(mejor, dias);

  const lunes = lunesDe(hoy);
  const semana = Array.from({ length: 7 }, (_, k) => {
    const d = masDias(lunes, k);
    return { dia: "LMMJVSD"[k], leyo: leidas(d) > 0, gracia: gracias.has(clave(d)), futuro: d > hoy };
  });
  return { dias, mejor, estado, faltanHoy, semana, marca: estado === "hoy" && MARCAS.includes(dias) ? dias : null };
}

/** Frase corta para acompañar el número. */
export function textoRacha(r: Racha): string {
  switch (r.estado) {
    case "hoy": return "Ya sumaste hoy";
    case "seguir": return `Lee una noticia hoy para llegar a ${r.dias + 1}`;
    case "pausa": return "Ayer usaste tu día libre de la semana. Lee una noticia hoy para seguir";
    case "recuperar": return r.faltanHoy === 2 ? "Termina 2 noticias hoy para recuperarla" : "Termina 1 noticia más hoy para recuperarla";
    default: return r.mejor > 0 ? "Empieza otra racha hoy" : "Termina una noticia para empezar tu racha";
  }
}
