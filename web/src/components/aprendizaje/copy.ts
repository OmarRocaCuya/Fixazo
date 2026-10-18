import type { StudyValidationError } from "@/lib/aprendizaje/workspace";

export type StudyFormat = "map" | "ideas" | "cards" | "questions";

export const FORMAT_LABELS: Record<StudyFormat, string> = {
  map: "Mapa de aprendizaje",
  ideas: "Ideas clave",
  cards: "Tarjetas",
  questions: "Preguntas",
};

export const VALIDATION_COPY: Record<StudyValidationError, string> = {
  empty: "Agrega un texto antes de transformarlo.",
  "source-too-large": "El texto supera los 50.000 caracteres. Divide la fuente en partes más pequeñas.",
  "unsupported-file": "Por ahora puedes abrir archivos TXT o MD. PDF, imágenes y documentos de Word aún no están disponibles.",
  "file-too-large": "El archivo supera 1 MiB. Prueba con un archivo de texto más pequeño.",
  "invalid-file": "No pudimos leer este archivo de texto. Revisa su contenido o pega el texto directamente.",
};

// Static interface copy only. Never add document titles, excerpts or learner input.
export const LEARNING_UI_TEXTS = [
  "Transformaciones", "Mapa de aprendizaje", "Ideas clave", "Tarjetas", "Preguntas",
  "De tu texto a una forma de estudiar. Pega una fuente o abre un archivo, elige un formato y explora el resultado.",
  "Vistas del espacio de aprendizaje", "Fuente", "Formato", "Resultado",
  "Mis fuentes", "Las fuentes se conservan solo en este dispositivo. Puedes exportarlas o borrarlas desde Privacidad.",
  "Aún no tienes fuentes guardadas.", "Nueva fuente", "Tu fuente", "Título de la fuente", "Texto de la fuente",
  "Ponle un nombre para encontrarla después", "Pega aquí el texto que quieres estudiar…", "Abrir archivo TXT o MD",
  "TXT o MD · hasta 1 MiB y 50.000 caracteres. PDF e imágenes todavía no están disponibles.",
  "Leyendo archivo…", "caracteres", "Editar fuente", "Ocultar editor", "Convertir a", "Transformar texto",
  "Actualizar resultado", "Tu texto se organiza en este navegador. No se envía a servicios externos.",
  "Los archivos originales no se guardan; solo se conserva su texto al transformar.",
  "Cargando fuentes de este dispositivo…", "Guardado en este dispositivo.",
  "No se pudo guardar en este dispositivo. Mantén esta pestaña abierta o copia tu texto antes de salir.",
  "Llegaste al límite de 20 fuentes. Puedes editar una existente o exportar y borrar tus datos desde Privacidad.",
  "Ver privacidad", "Tienes cambios sin transformar.", "Conservar cambios", "Descartar y continuar",
  "La fuente cambió. Transforma de nuevo para actualizar el resultado.",
  "El resultado aparecerá aquí", "Primero agrega tu texto y elige cómo quieres estudiarlo. Puedes cambiar de formato sin volver a subirlo.",
  "Organización local y extractiva: las ideas y respuestas son fragmentos de la fuente, no una explicación creada por IA.",
  "Conceptos de esta fuente", "Selecciona un concepto para ver el fragmento que lo respalda.",
  "Las conexiones agrupan conceptos de la misma fuente; no indican causas ni relaciones comprobadas entre ellos.",
  "No encontramos conceptos suficientes para dibujar un mapa. Puedes revisar los fragmentos en Ideas clave o ampliar la fuente.",
  "Fragmento de la fuente", "Ver en la fuente", "Fragmentos para repasar", "No hay fragmentos disponibles para este texto.",
  "Abre una tarjeta para contrastar tu recuerdo con el texto original.", "Consultar fragmento", "Tu explicación",
  "Escribe con tus palabras; esta actividad no califica tu respuesta.", "Responde y vuelve a la evidencia cuando lo necesites.",
  "¿Qué dice el texto sobre", "Explica con tus palabras lo que el texto dice sobre", "y contrástalo con la cita.",
  ...Object.values(VALIDATION_COPY),
] as const;
