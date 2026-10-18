// EXPERIMENTAL emotion2vec+ proxy to the private backend (`/v1/emotion`).
// Audio stays in memory for one request and is never stored or logged.
import { getIndigenousBackendConfig, getVoicePolicyStatus } from "./voice-policy";
import { IndigenousProxyError, readIndigenousBody, validateIndigenousWav } from "./indigenous-proxy";

export const EMOTION_MODEL = "emotion2vec/emotion2vec_plus_base";
export const EMOTION_REVISION = "b318240bfe67db81a8c572ecb37ce9c3759b81c9";
export const EMOTION_MIN_SECONDS = 1;
export const EMOTION_MAX_SECONDS = 15;
const LABELS = ["angry", "disgusted", "fearful", "happy", "neutral", "other", "sad", "surprised", "unknown"];
const MAX_RESPONSE_BYTES = 16_384;

export class EmotionFallback extends Error {
  constructor(readonly code: string, readonly status = 503) { super(code); }
}

export function validateEmotionWav(bytes: Uint8Array): number {
  let seconds: number;
  try {
    seconds = validateIndigenousWav(bytes);
  } catch (error) {
    throw new EmotionFallback(error instanceof IndigenousProxyError ? error.code : "invalid-audio", error instanceof IndigenousProxyError ? error.status : 422);
  }
  if (seconds < EMOTION_MIN_SECONDS || seconds > EMOTION_MAX_SECONDS) throw new EmotionFallback("emotion-audio-duration-invalid", 422);
  // The structural validator accepts silence for other features. Emotion
  // cannot treat an all-zero microphone stream as a person's voice; inspect
  // only the actual PCM data, never a metadata chunk or the transcript.
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let signal = false;
  for (let offset = 12; offset + 8 <= bytes.byteLength;) {
    const size = view.getUint32(offset + 4, true);
    if (String.fromCharCode(...bytes.subarray(offset, offset + 4)) === "data") {
      signal = bytes.subarray(offset + 8, offset + 8 + size).some((value) => value !== 0);
      break;
    }
    offset += 8 + size + size % 2;
  }
  if (!signal) throw new EmotionFallback("audio-not-observable", 422);
  return seconds;
}

type Item = { label: string; score: number };
const isItem = (x: unknown): x is Item =>
  !!x && typeof x === "object" && typeof (x as Item).label === "string" && LABELS.includes((x as Item).label) && typeof (x as Item).score === "number"
  && Number.isFinite((x as Item).score) && (x as Item).score >= 0 && (x as Item).score <= 1;

const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

/** Public, non-secret status. Health probes never download or load weights. */
export async function getEmotionCapabilities(signal?: AbortSignal) {
  const policy = getVoicePolicyStatus("meta");
  const config = getIndigenousBackendConfig();
  const base = { ...policy, ready: false, loading: false, inferenceVerified: false, model: EMOTION_MODEL, revision: EMOTION_REVISION, experimental: true as const };
  if (!policy.enabled || !config) return base;
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timeout = setTimeout(abort, 2500);
  signal?.addEventListener("abort", abort, { once: true });
  try {
    if (signal?.aborted) throw new Error("aborted");
    const response = await fetch(new URL("health", config.baseUrl), {
      headers: { Authorization: `Bearer ${config.token}` }, signal: controller.signal, cache: "no-store", redirect: "error",
    });
    if (!response.ok) throw new Error("unavailable");
    const body = record(JSON.parse(new TextDecoder().decode(await readIndigenousBody(response.body, MAX_RESPONSE_BYTES))));
    const emotion = record(body.emotion);
    if (emotion.model !== EMOTION_MODEL || emotion.revision !== EMOTION_REVISION || emotion.experimental !== true
      || typeof emotion.enabled !== "boolean" || typeof emotion.ready !== "boolean") throw new Error("invalid");
    if (!emotion.enabled) return { ...base, enabled: false, reason: "emotion-backend-disabled" };
    const ready = emotion.ready === true && emotion.inferenceVerified === true;
    return { ...base, ready, inferenceVerified: emotion.inferenceVerified === true, loading: emotion.loading === true,
      reason: ready ? null : emotion.loading === true ? "emotion-model-loading" : "emotion-model-not-ready" };
  } catch {
    // Policy mode remains available so the family can enter access/consent;
    // an unreachable backend is not misrepresented as model readiness.
    return { ...base, reason: "emotion-backend-unavailable" };
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}

export async function estimateEmotionWithBackend(bytes: Uint8Array, signal?: AbortSignal) {
  const config = getIndigenousBackendConfig();
  if (!config) throw new EmotionFallback("emotion-backend-not-configured");
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timeout = setTimeout(abort, 30_000);
  signal?.addEventListener("abort", abort, { once: true });
  try {
    if (signal?.aborted) throw new EmotionFallback("emotion-request-aborted");
    let response: Response;
    try {
      response = await fetch(new URL("v1/emotion", config.baseUrl), {
        method: "POST",
        headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "audio/wav" },
        body: bytes.slice().buffer,
        signal: controller.signal,
        cache: "no-store",
        redirect: "error",
      });
    } catch {
      throw new EmotionFallback("emotion-backend-unavailable");
    }
    if (response.status === 404) throw new EmotionFallback("emotion-backend-disabled");
    if (!response.ok) {
      let code: unknown;
      try { code = record(JSON.parse(new TextDecoder().decode(await readIndigenousBody(response.body, MAX_RESPONSE_BYTES)))).error; } catch { /* never reflect raw errors */ }
      if (response.status === 422 && code === "no-audio-signal") throw new EmotionFallback("audio-not-observable", 422);
      const safe: Record<string, string> = {
        "emotion-model-loading": "emotion-model-loading", "emotion-model-unavailable": "emotion-model-unavailable",
        "model-busy": "emotion-backend-busy", "emotion-inference-failed": "emotion-inference-failed",
        "emotion-output-invalid": "emotion-backend-invalid",
      };
      throw new EmotionFallback(response.status === 503 && typeof code === "string" && Object.hasOwn(safe, code)
        ? safe[code] : response.status === 503 ? "emotion-backend-busy" : "emotion-backend-unavailable");
    }
    let body: Record<string, unknown>;
    try {
      body = record(JSON.parse(new TextDecoder().decode(await readIndigenousBody(response.body, MAX_RESPONSE_BYTES))));
    } catch {
      throw new EmotionFallback("emotion-backend-invalid");
    }
    const labels = body.labels;
    if (body.experimental !== true || body.requiresHumanReview !== true || body.model !== EMOTION_MODEL || body.revision !== EMOTION_REVISION || !Array.isArray(labels) || labels.length !== LABELS.length
      || !labels.every(isItem) || new Set(labels.map((l) => l.label)).size !== LABELS.length || !isItem(body.top)) {
      throw new EmotionFallback("emotion-backend-invalid");
    }
    const sorted = [...labels].sort((a, b) => b.score - a.score).map(({ label, score }) => ({ label, score }));
    if (Math.abs(sorted.reduce((sum, item) => sum + item.score, 0) - 1) > 0.001
      || body.top.label !== sorted[0].label || body.top.score !== sorted[0].score) throw new EmotionFallback("emotion-backend-invalid");
    return {
      labels: sorted,
      top: sorted[0],
      model: EMOTION_MODEL,
      revision: EMOTION_REVISION,
      license: "FunASR Model License v1.1",
      attribution: "emotion2vec+ base (Ma et al. 2024), Alibaba DAMO / FunASR",
      experimental: true as const,
      requiresHumanReview: true as const,
    };
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}
