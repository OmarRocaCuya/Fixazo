import { speechRecognitionSupported } from "./transcriber";

export interface VoiceSupport {
  /** API availability, not a microphone permission grant. */
  canRecord: boolean;
  /** A service may still refuse recognition after these prerequisites pass. */
  canTranscribe: boolean;
  reason: "ready" | "insecure-context" | "microphone-unavailable" | "recognition-unavailable" | "quechua-unavailable";
  browser: "opera" | "other";
  message: string;
}

/** Diagnostics only: never asks for permission or uploads audio. */
export function getVoiceSupport(lang: "es" | "qu"): VoiceSupport {
  const browser = typeof navigator !== "undefined" && /\b(?:OPR|Opera)(?:\/|\s)/i.test(navigator.userAgent) ? "opera" : "other";
  const secure = typeof window !== "undefined" && window.isSecureContext === true;
  const microphone = typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function";
  const canRecord = secure && microphone;
  const base: Pick<VoiceSupport, "canRecord" | "canTranscribe" | "browser"> = { canRecord, canTranscribe: false, browser };
  if (!secure) return { ...base, reason: "insecure-context", message: voiceErrorMessage("insecure-context") };
  if (!microphone) return { ...base, reason: "microphone-unavailable", message: "Este navegador no permite capturar el micrófono. Puedes continuar escribiendo la respuesta." };
  if (lang === "qu") return { ...base, reason: "quechua-unavailable", message: "Este MVP no tiene transcripción automática en quechua. Un adulto puede escribir lo que escucha, sin traducir ni corregir la forma de hablar." };
  if (!speechRecognitionSupported()) return { ...base, reason: "recognition-unavailable", message: browser === "opera"
    ? "Opera puede permitir el micrófono sin ofrecer transcripción. Prueba Chrome o Edge actualizados, o continúa escribiendo; no necesitas cambiar a celular."
    : voiceErrorMessage("unsupported") };
  return { ...base, canTranscribe: true, reason: "ready", message: browser === "opera"
    ? "Opera expone la API, pero eso no garantiza su servicio de transcripción. Puede enviar audio a un proveedor externo. Si falla, prueba Chrome o Edge actualizados o escribe la respuesta."
    : "Micrófono y API de transcripción disponibles. Aún necesitas dar permiso y que el servicio del navegador responda; puede requerir internet y enviar audio a un proveedor externo." };
}

export function voiceErrorMessage(code: string): string {
  switch (code) {
    case "insecure-context": return "El micrófono necesita HTTPS (o localhost en desarrollo). En el celular, abrir una IP local con HTTP no basta. Puedes continuar escribiendo.";
    case "not-allowed": return "No se permitió el micrófono. Revisa el permiso del sitio y del sistema, o continúa escribiendo.";
    case "service-not-allowed": return "El navegador no permitió su servicio de transcripción. El micrófono puede funcionar igualmente. Prueba Chrome o Edge actualizados, o escribe la respuesta.";
    case "network": return "El servicio de transcripción no respondió. Revisa internet; si persiste, prueba Chrome o Edge actualizados o escribe la respuesta. No es necesario cambiar a celular.";
    case "no-speech": return "No se obtuvo una transcripción. Revisa el micrófono y vuelve a intentarlo, o escribe la respuesta. Esto no evalúa cómo habla el niño.";
    case "audio-capture": return "No se pudo acceder al micrófono. Comprueba que esté conectado y no lo esté usando otra app, o continúa escribiendo.";
    case "language-not-supported": return "El servicio del navegador no admite el idioma solicitado. Continúa con transcripción manual.";
    case "unsupported": return "Este navegador no ofrece transcripción de voz. Prueba Chrome o Edge actualizados, o escribe la respuesta.";
    case "recognition-ended": return "El servicio de transcripción se cerró varias veces. Se detuvo para evitar reintentos continuos; puedes volver a intentarlo o escribir la respuesta.";
    case "aborted": return "La transcripción se interrumpió. Puedes volver a intentarlo o escribir la respuesta.";
    case "not-implemented": return "La transcripción automática para este idioma no está implementada. Continúa con transcripción manual.";
    default: return "No se pudo iniciar la transcripción. Puedes volver a intentarlo, probar Chrome o Edge actualizados, o escribir la respuesta.";
  }
}
