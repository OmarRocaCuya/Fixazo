// Periódico juvenil: cada noticia alterna fragmentos reales de medios con preguntas.
// Responder (bien o mal) desbloquea lo siguiente. Solo la pregunta de voz la revisa la IA.

export interface Fragmento {
  tipo: "fragmento";
  /** "a" y "b" distinguen los dos medios o las dos voces que se comparan. */
  lado: "a" | "b";
  medio: string;
  fecha: string;
  titular: string;
  texto: string;
  url: string;
}

export interface PreguntaOpciones {
  tipo: "opciones";
  id: string;
  etiqueta: string;
  titulo: string;
  opciones: string[];
  /** null = predicción: no hay respuesta esperada. */
  correcta: number | null;
  bien: string;
  otra: string;
  habilidad: string | null;
}

export interface Criterio {
  id: string;
  nombre: string;
  descripcion: string;
  ejemploCumple: string;
  ejemploNoCumple: string;
  /** Repregunta escrita por nosotros; se usa si la IA falla o su retroalimentación no pasa la guardia. */
  repregunta: string;
}

export interface PreguntaVoz {
  tipo: "voz";
  id: string;
  etiqueta: string;
  titulo: string;
  habilidad: string;
  pistas: string[];
  /** Solo en el servidor. */
  privado: {
    criterios: Criterio[];
    respuestaModelo: string;
    /** Frases que, si aparecen en la retroalimentación sin que el alumno las haya dicho, revelan la respuesta. */
    prohibido: string[];
  };
}

export type Paso = Fragmento | PreguntaOpciones | PreguntaVoz;

export interface Noticia {
  id: string;
  seccion: string;
  titular: string;
  bajada: string;
  minutos: number;
  /** Cómo ve el hecho cada medio o voz; texto textual o null. */
  miradas?: Array<{ medio: string; texto: string | null }>;
  pasos: Paso[];
}

export interface Edicion {
  fecha: string;
  tema: string;
  noticias: Noticia[];
}

export type PreguntaVozPublica = Omit<PreguntaVoz, "privado">;
export type PasoPublico = Fragmento | PreguntaOpciones | PreguntaVozPublica;
export type NoticiaPublica = Omit<Noticia, "pasos"> & { pasos: PasoPublico[] };

export interface RespuestaVoz {
  evaluacion: "evaluada" | "no_evaluable";
  cuenta: boolean;
  criterios: Array<{ id: string; nombre: string; cumple: boolean; cita: string; dudoso: boolean }>;
  retro: string;
  listo: boolean;
  ia: boolean;
}
