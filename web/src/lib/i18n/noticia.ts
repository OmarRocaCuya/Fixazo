import type { NoticiaPublica } from "@/lib/periodico/tipos";

/** Only published content. Never pass learner answers, access codes, or private rubrics. */
export function collectNoticiaTexts(noticia: NoticiaPublica): string[] {
  const texts = [noticia.seccion, noticia.titular, noticia.bajada];
  for (const mirada of noticia.miradas ?? []) if (mirada.texto) texts.push(mirada.texto);
  for (const paso of noticia.pasos) {
    if (paso.tipo === "fragmento") texts.push(paso.titular, paso.texto);
    else {
      texts.push(paso.etiqueta, paso.titulo);
      if (paso.habilidad) texts.push(paso.habilidad);
      if (paso.tipo === "opciones") texts.push(...paso.opciones, paso.bien, paso.otra);
      else texts.push(...paso.pistas);
    }
  }
  return [...new Set(texts.filter(Boolean))];
}
