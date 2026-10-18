import { getIndigenousBackendConfig, getVoicePolicyStatus } from "./voice-policy";

export const INDIGENOUS_ASR_LANGUAGES = ["spa_Latn", "quy_Latn", "quz_Latn", "ayr_Latn"] as const;
export const INDIGENOUS_TRANSLATION_LANGUAGES = ["spa_Latn", "quy_Latn", "ayr_Latn"] as const;
export const INDIGENOUS_AUDIO_MAX_BYTES = 1_000_000;
export const INDIGENOUS_AUDIO_MAX_SECONDS = 30;
const ASR_MODEL = "omniASR_LLM_300M_v2";
const TRANSLATION_MODEL = "facebook/nllb-200-distilled-600M";
const MAX_RESPONSE_BYTES = 65_536;
// Public error vocabulary is owned here, not by arbitrary upstream payloads.
// Only an exact code AND its expected HTTP status may cross this boundary.
const SAFE_BACKEND_ERRORS: Record<string, { upstreamStatus: number; status: number; code: string }> = {
  "translation-input-exceeds-256-tokens": { upstreamStatus: 422, status: 422, code: "translation-input-exceeds-256-tokens" },
  "no-audio-signal": { upstreamStatus: 422, status: 422, code: "audio-not-observable" },
  "no-observable-transcript": { upstreamStatus: 422, status: 422, code: "asr-not-observable" },
  "translation-not-observable": { upstreamStatus: 422, status: 422, code: "translation-not-observable" },
  "audio-duration-invalid": { upstreamStatus: 422, status: 422, code: "audio-duration-invalid" },
  "invalid-wav": { upstreamStatus: 422, status: 422, code: "invalid-audio-use-mono-16khz-pcm16-wav" },
  "truncated-audio": { upstreamStatus: 422, status: 422, code: "invalid-audio-use-mono-16khz-pcm16-wav" },
  "wav-must-be-pcm16-mono-16000hz": { upstreamStatus: 422, status: 422, code: "invalid-audio-use-mono-16khz-pcm16-wav" },
  "audio-size-invalid": { upstreamStatus: 413, status: 413, code: "request-too-large" },
  "model-busy": { upstreamStatus: 503, status: 503, code: "indigenous-busy" },
  "asr-model-unavailable": { upstreamStatus: 503, status: 503, code: "backend-not-ready" },
  "translation-model-unavailable": { upstreamStatus: 503, status: 503, code: "backend-not-ready" },
  "research-translation-disabled": { upstreamStatus: 403, status: 503, code: "translation-research-mode-required" },
  "unsupported-asr-language": { upstreamStatus: 422, status: 422, code: "unsupported-language" },
  "unsupported-translation-language": { upstreamStatus: 422, status: 422, code: "unsupported-translation-language" },
  "translation-text-too-long-or-empty": { upstreamStatus: 422, status: 422, code: "invalid-text-length" },
  "translation-languages-must-differ": { upstreamStatus: 422, status: 422, code: "unsupported-translation-language" },
};

export class IndigenousProxyError extends Error {
  constructor(readonly code: string, readonly status: number) { super(code); }
}

/** Byte-bounded stream read: neither uploads nor upstream JSON can grow forever. */
export async function readIndigenousBody(body: ReadableStream<Uint8Array> | null, limit: number): Promise<Uint8Array> {
  if (!body) return new Uint8Array();
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > limit) { await reader.cancel(); throw new IndigenousProxyError("request-too-large", 413); }
      chunks.push(chunk.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function safeModel(value: unknown): string | null {
  return typeof value === "string" && /^[a-zA-Z0-9_./-]{1,128}$/.test(value) ? value : null;
}

async function backend(path: "health" | "transcribe" | "translate", init: RequestInit = {}, signal?: AbortSignal): Promise<Record<string, unknown>> {
  const config = getIndigenousBackendConfig();
  if (!config) throw new IndigenousProxyError("indigenous-not-configured", 503);
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timeout = setTimeout(abort, path === "health" ? 2500 : 45_000);
  signal?.addEventListener("abort", abort, { once: true });
  try {
    if (signal?.aborted) throw new Error("aborted");
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${config.token}`);
    const response = await fetch(new URL(path, config.baseUrl), {
      ...init, headers, signal: controller.signal, cache: "no-store", redirect: "error",
    });
    if (!response.ok) {
      let errorCode: unknown;
      try {
        const errorBytes = await readIndigenousBody(response.body, MAX_RESPONSE_BYTES);
        errorCode = record(JSON.parse(new TextDecoder().decode(errorBytes))).error;
      } catch { /* malformed/oversized error bodies are never reflected */ }
      const safe = typeof errorCode === "string" && Object.hasOwn(SAFE_BACKEND_ERRORS, errorCode) ? SAFE_BACKEND_ERRORS[errorCode] : null;
      if (safe && safe.upstreamStatus === response.status) throw new IndigenousProxyError(safe.code, safe.status);
      // Never reflect other bodies, tracebacks, deployment URLs or tokens.
      throw new IndigenousProxyError(response.status === 429 ? "indigenous-busy" : "indigenous-unavailable", response.status === 429 ? 429 : 502);
    }
    const bytes = await readIndigenousBody(response.body, MAX_RESPONSE_BYTES);
    return record(JSON.parse(new TextDecoder().decode(bytes)));
  } catch (error) {
    if (error instanceof IndigenousProxyError && error.code !== "request-too-large") throw error;
    throw new IndigenousProxyError("indigenous-unavailable", 502);
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}

export async function getIndigenousCapabilities(signal?: AbortSignal) {
  const policy = getVoicePolicyStatus("meta");
  const configured = getIndigenousBackendConfig() !== null;
  const researchOnly = process.env.INDIGENOUS_TRANSLATION_RESEARCH_ONLY === "true";
  let reachable = false;
  let asrReady = false;
  let asrLoading = false;
  let translationReady = false;
  let translationAvailable = false;
  let model = ASR_MODEL;
  if (policy.enabled && configured) {
    try {
      const health = await backend("health", {}, signal);
      const asr = record(health.asr);
      const translation = record(health.translation);
      if (!safeModel(asr.model) || typeof asr.ready !== "boolean" || typeof translation.ready !== "boolean") throw new Error("invalid-health");
      reachable = true;
      asrReady = asr.ready;
      asrLoading = asr.loading === true;
      model = safeModel(asr.model)!;
      translationAvailable = translation.enabled === true && researchOnly;
      translationReady = translationAvailable && translation.ready === true;
    } catch { /* configuration is not proof that a backend or model is ready */ }
  }
  return {
    ...policy, configured, backendReachable: reachable,
    asr: { model, languages: INDIGENOUS_ASR_LANGUAGES, ready: asrReady, loading: asrLoading, wordTimestamps: false },
    translation: { model: TRANSLATION_MODEL, languages: INDIGENOUS_TRANSLATION_LANGUAGES, enabled: translationAvailable, ready: translationReady, researchOnly: true },
    limits: { audioBytes: INDIGENOUS_AUDIO_MAX_BYTES, audioSeconds: INDIGENOUS_AUDIO_MAX_SECONDS, textCharacters: 1500 },
    requiresHumanReview: true,
    limitations: ["batch-not-streaming", "no-word-timestamps", "not-validated-for-children", "no-emotion-inference", "translation-noncommercial-research-only"],
  };
}

/** Validate actual PCM bytes, not a caller-controlled MIME type or duration. */
export function validateIndigenousWav(bytes: Uint8Array): number {
  const fail = () => { throw new IndigenousProxyError("invalid-audio-use-mono-16khz-pcm16-wav", 422); };
  if (bytes.byteLength > INDIGENOUS_AUDIO_MAX_BYTES) throw new IndigenousProxyError("request-too-large", 413);
  if (bytes.byteLength < 44) return fail();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (offset: number) => String.fromCharCode(...bytes.subarray(offset, offset + 4));
  if (tag(0) !== "RIFF" || tag(8) !== "WAVE" || view.getUint32(4, true) + 8 !== bytes.byteLength) return fail();
  let fmt = false;
  let dataBytes = 0;
  let hasData = false;
  let offset = 12;
  for (; offset + 8 <= bytes.byteLength;) {
    const size = view.getUint32(offset + 4, true);
    const start = offset + 8;
    if (start + size > bytes.byteLength) return fail();
    if (tag(offset) === "fmt ") {
      if (fmt || size < 16 || view.getUint16(start, true) !== 1 || view.getUint16(start + 2, true) !== 1
        || view.getUint32(start + 4, true) !== 16000 || view.getUint32(start + 8, true) !== 32000
        || view.getUint16(start + 12, true) !== 2 || view.getUint16(start + 14, true) !== 16) return fail();
      fmt = true;
    } else if (tag(offset) === "data") {
      if (hasData || size % 2 !== 0) return fail();
      dataBytes = size; hasData = true;
    }
    offset = start + size + (size % 2);
    if (offset > bytes.byteLength) return fail();
  }
  const duration = dataBytes / 32_000;
  if (offset !== bytes.byteLength || !fmt || !hasData || duration <= 0 || duration > INDIGENOUS_AUDIO_MAX_SECONDS) return fail();
  return duration;
}

export async function transcribeIndigenousAudio(file: Blob, language: string, signal?: AbortSignal) {
  if (!(INDIGENOUS_ASR_LANGUAGES as readonly string[]).includes(language)) throw new IndigenousProxyError("unsupported-language", 422);
  if (file.size > INDIGENOUS_AUDIO_MAX_BYTES) throw new IndigenousProxyError("request-too-large", 413);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const durationSeconds = validateIndigenousWav(bytes);
  const form = new FormData();
  // Never forward the family's filename or any extra form fields.
  form.set("file", new Blob([bytes as BlobPart], { type: "audio/wav" }), "sample.wav");
  form.set("language", language);
  const response = await backend("transcribe", { method: "POST", body: form }, signal);
  const model = safeModel(response.model);
  if (typeof response.text !== "string" || response.text.length > 12_000 || response.language !== language || !model
    || typeof response.durationSeconds !== "number" || !Number.isFinite(response.durationSeconds)
    || Math.abs(response.durationSeconds - durationSeconds) > 0.1) throw new IndigenousProxyError("invalid-backend-response", 502);
  return { text: response.text.trim(), language, model, durationSeconds, wordTimestamps: false, requiresHumanReview: true };
}

export async function translateIndigenousText(text: string, sourceLanguage: string, targetLanguage: string, signal?: AbortSignal) {
  if (process.env.INDIGENOUS_TRANSLATION_RESEARCH_ONLY !== "true") throw new IndigenousProxyError("translation-research-mode-required", 503);
  if (!text.trim() || text.length > 1500) throw new IndigenousProxyError("invalid-text-length", 422);
  if (sourceLanguage === targetLanguage || ![sourceLanguage, targetLanguage].every((lang) => (INDIGENOUS_TRANSLATION_LANGUAGES as readonly string[]).includes(lang))) {
    throw new IndigenousProxyError("unsupported-translation-language", 422);
  }
  const response = await backend("translate", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, sourceLanguage, targetLanguage }),
  }, signal);
  if (typeof response.text !== "string" || response.text.length > 12_000 || response.sourceLanguage !== sourceLanguage
    || response.targetLanguage !== targetLanguage || response.model !== TRANSLATION_MODEL || response.researchOnly !== true) {
    throw new IndigenousProxyError("invalid-backend-response", 502);
  }
  return { text: response.text.trim(), sourceLanguage, targetLanguage, model: TRANSLATION_MODEL, researchOnly: true, requiresHumanReview: true };
}
