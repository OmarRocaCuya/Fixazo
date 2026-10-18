// EXPERIMENTAL emotion estimate for one quiz voice answer, from the AUDIO only
// (emotion2vec+ on the self-hosted backend). The WAV stays in memory and is
// zeroed after sending. Any failure yields "sin modelo", never a guess.
import { EmotionClientError, requestEmotionModel } from "./emotion-client";
import { mapModelResult, unavailableAffect, type AffectEstimate } from "@/lib/signals/affect";

const MIN_BYTES = 44 + 32_000; // 1 s of 16 kHz mono PCM16
const MAX_BYTES = 44 + 480_000; // 15 s

export async function estimarEmocionRespuesta(audio: Blob, fetcher: typeof fetch = fetch, signal?: AbortSignal): Promise<AffectEstimate> {
  if (audio.size < MIN_BYTES || audio.size > MAX_BYTES) return unavailableAffect("sin modelo: la respuesta debe durar entre 1 y 15 segundos");
  let wav: Uint8Array | null = null;
  try {
    wav = new Uint8Array(await audio.arrayBuffer());
    // The Meta backend is open (same origin + per-IP limit): no access code is sent.
    return mapModelResult(await requestEmotionModel(wav, { accessCode: "", audience: "adult-demo" }, fetcher, signal));
  } catch (error) {
    const code = error instanceof EmotionClientError ? error.code : "network";
    return unavailableAffect(code === "emotion-model-loading" ? "sin modelo: emotion2vec+ aún está cargando" : "sin modelo: emotion2vec+ no respondió");
  } finally {
    wav?.fill(0);
  }
}
