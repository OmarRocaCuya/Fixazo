// Informational copy for the experimental voice-based emotion estimate.
// The MVP has no adult/guardian consent gate; the estimate is available whenever
// the private emotion2vec+ model is configured, and never invented without it.

export const EXPERIMENTAL_EMOTION_TITLE = "Estimación experimental de emociones por la voz (demo)";

export const EXPERIMENTAL_EMOTION_DESC =
  "Experimental. Estima la emoción por cómo suena la voz en cada respuesta, no de las palabras. Con el código de acceso del despliegue, hasta 15 segundos del audio de cada respuesta se envían a un servidor privado con el modelo emotion2vec+ y no se guardan. Sin audio o sin el modelo no se estima una emoción; no se usan texto ni heurísticas como sustituto. No está validada con niños ni en quechua o castellano peruano. Es una estimación, no un diagnóstico: nunca se usa para calificar y solo aparece en la vista del adulto. Si no coincide, vale la carita que eligió el niño. En el Perú, inferir emociones en educación se considera de alto riesgo (DS 115-2025-PCM, art. 24.1 i), por eso solo se muestra para demostración.";
